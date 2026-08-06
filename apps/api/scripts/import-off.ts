/**
 * Importador del dump de OpenFoodFacts a food_items.
 *
 *   npm run import:off -- --file ./openfoodfacts-products.jsonl.gz
 *   npm run import:off -- --file ./dump.jsonl.gz --limit 5000 --dry-run
 *   npm run import:off -- --file ./dump.jsonl.gz --resume-from 1240000
 *
 * Va en TypeScript y no en .mjs como smoke y probe: aquellos son clientes HTTP
 * externos sin nada en común con la app, y este comparte el mapper con
 * FoodsService. Duplicarlo significaría que un filtro corregido en un lado deja
 * pasar basura por el otro. Se corre con ts-node, igual que el seed.
 *
 * Se usa el dump y no la API porque la API está limitada a pocas peticiones por
 * minuto y su política de uso prohíbe expresamente hacer bulk por ahí. El dump
 * es JSONL: un objeto por línea, así que se procesa en streaming y el pico de
 * memoria es un producto más un lote.
 *
 *
 * ANTES DE UNA CARGA MASIVA, A MANO
 * ---------------------------------
 * Los dos índices GIN de búsqueda son el costo real: millones de inserts contra
 * ellos son entre 5 y 10 veces más lentos que contra la tabla pelada.
 *
 *   DROP INDEX idx_food_name_unaccent_trgm;
 *   DROP INDEX idx_food_brand_unaccent_trgm;
 *   -- correr el importador --
 *   CREATE INDEX CONCURRENTLY idx_food_name_unaccent_trgm
 *     ON food_items USING gin (f_unaccent(name) gin_trgm_ops);
 *   CREATE INDEX CONCURRENTLY idx_food_brand_unaccent_trgm
 *     ON food_items USING gin (f_unaccent(COALESCE(brand, '')) gin_trgm_ops);
 *   ANALYZE food_items;
 *
 * No está automatizado a propósito. Bajar los índices de búsqueda en una tabla
 * viva es una decisión que alguien toma queriendo, en una ventana de
 * mantenimiento: mientras no están, /foods/search cae a seq scan.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { mapOffProduct, type MappedFood, type OffProduct, type RejectReason } from '../src/foods/off-mapper';

const prisma = new PrismaClient();

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const flag = (nombre: string) => process.argv.includes(`--${nombre}`);

const FILE = arg('file');
const LIMIT = Number(arg('limit') ?? Infinity);
const RESUME_FROM = Number(arg('resume-from') ?? 0);
const BATCH = Number(arg('batch') ?? 1000);
const DRY_RUN = flag('dry-run');

/**
 * --countries colombia
 *
 * Sin esto entra el catálogo mundial: unos 3,5 millones de productos, de los
 * que Colombia son unos pocos miles. Los otros no aparecen en ninguna góndola
 * de acá y lo único que hacen es competirle a los buenos en el ORDER BY.
 * Lo que el filtro deja afuera igual queda cubierto: si se escanea un código
 * que no está, GET /foods/barcode lo trae de OpenFoodFacts en el momento.
 */
const COUNTRIES = (arg('countries') ?? '')
  .split(',')
  .map((c) => c.trim().toLowerCase())
  .filter(Boolean);

/**
 * Los tags viajan en el JSON como ["en:argentina","en:france"], así que
 * buscarlos con comillas en la línea CRUDA descarta el 99,6% de los productos
 * sin construir el objeto. Un indexOf sobre 30 KB de texto cuesta órdenes de
 * magnitud menos que un JSON.parse, y el parseo es el grueso del trabajo.
 */
const TAGS_CRUDOS = COUNTRIES.map((c) => `"en:${c}"`);

if (!FILE) {
  console.error('Falta --file con la ruta al dump (.jsonl o .jsonl.gz)');
  process.exit(1);
}

const rechazos = new Map<RejectReason, number>();
let leidas = 0;
let insertadas = 0;
let descartadas = 0;
let ilegibles = 0;
let otroPais = 0;
let saltadasSinParsear = 0;

/**
 * Un lote entero por statement: 1000 productos en un round trip en vez de 1000.
 * El WHERE del DO UPDATE es la regla completa de convivencia: si un usuario
 * cargó ese alimento es suyo y gana siempre, aunque comparta código de barras.
 * Él tiene el paquete en la mano, OpenFoodFacts no.
 */
async function guardar(lote: MappedFood[]) {
  const col = <K extends keyof MappedFood>(k: K) => lote.map((f) => f[k]);

  await prisma.$executeRaw`
    INSERT INTO food_items (
      barcode, name, brand, verified, source,
      serving_size_amount, serving_size_unit,
      calories, protein, carbohydrates, fat, fiber, sugar, sodium_mg)
    SELECT * FROM UNNEST(
      ${col('barcode')}::text[],
      ${col('name')}::text[],
      ${col('brand')}::text[],
      ${col('verified')}::boolean[],
      ${lote.map(() => 'openfoodfacts')}::"FoodSource"[],
      ${col('servingSizeAmount')}::numeric[],
      ${col('servingSizeUnit')}::text[],
      ${col('calories')}::int[],
      ${col('protein')}::numeric[],
      ${col('carbohydrates')}::numeric[],
      ${col('fat')}::numeric[],
      ${col('fiber')}::numeric[],
      ${col('sugar')}::numeric[],
      ${col('sodiumMg')}::numeric[])
    ON CONFLICT (barcode) DO UPDATE SET
      name = EXCLUDED.name,
      brand = EXCLUDED.brand,
      verified = EXCLUDED.verified,
      source = EXCLUDED.source,
      serving_size_amount = EXCLUDED.serving_size_amount,
      serving_size_unit = EXCLUDED.serving_size_unit,
      calories = EXCLUDED.calories,
      protein = EXCLUDED.protein,
      carbohydrates = EXCLUDED.carbohydrates,
      fat = EXCLUDED.fat,
      fiber = EXCLUDED.fiber,
      sugar = EXCLUDED.sugar,
      sodium_mg = EXCLUDED.sodium_mg
    WHERE food_items.created_by IS NULL`;
}

async function main() {
  const bruto = createReadStream(FILE!);
  const stream = FILE!.endsWith('.gz') ? bruto.pipe(createGunzip()) : bruto;
  const lineas = createInterface({ input: stream, crlfDelay: Infinity });

  // Clave por barcode: OFF trae códigos repetidos entre líneas, y ON CONFLICT
  // no puede resolver dos filas en conflicto dentro de un mismo INSERT
  // ("cannot affect row a second time"). Gana la última, que es la más nueva.
  let lote = new Map<string, MappedFood>();

  const descargar = async () => {
    if (lote.size === 0) return;
    // Lotes chicos en transacciones independientes: una transacción gigante
    // retendría locks por horas, congelaría el xmin más viejo e impediría que
    // el autovacuum limpie nada.
    if (!DRY_RUN) await guardar([...lote.values()]);
    insertadas += lote.size;
    lote = new Map();
    console.log(`  linea=${leidas} guardadas=${insertadas} descartadas=${descartadas}`);
  };

  for await (const linea of lineas) {
    leidas++;
    if (leidas <= RESUME_FROM) continue;
    if (leidas - RESUME_FROM > LIMIT) break;
    if (!linea.trim()) continue;

    // Descarte barato, antes de parsear.
    if (TAGS_CRUDOS.length && !TAGS_CRUDOS.some((t) => linea.includes(t))) {
      otroPais++;
      saltadasSinParsear++;
      continue;
    }

    let producto: OffProduct;
    try {
      producto = JSON.parse(linea);
    } catch {
      ilegibles++;
      continue;
    }

    // El filtro de arriba mira la línea entera, así que también matchea un
    // origins_tags que diga en:argentina en un producto que se vende en otro
    // lado. Con el objeto ya armado, se confirma contra el campo correcto.
    if (COUNTRIES.length) {
      const paises = (producto.countries_tags ?? []).map((t) => t.replace(/^en:/, ''));
      if (!paises.some((p) => COUNTRIES.includes(p))) {
        otroPais++;
        continue;
      }
    }

    const r = mapOffProduct(producto);
    if (!r.ok) {
      descartadas++;
      rechazos.set(r.reason, (rechazos.get(r.reason) ?? 0) + 1);
      continue;
    }

    lote.set(r.food.barcode, r.food);
    if (lote.size >= BATCH) await descargar();
  }

  await descargar();
}

main()
  .then(() => {
    const procesadas = insertadas + descartadas;
    const pct = procesadas ? ((insertadas / procesadas) * 100).toFixed(1) : '0';
    console.log(`\n${DRY_RUN ? 'Simulacro' : 'Importación'} terminada.`);
    console.log(`  leidas      ${leidas}`);
    if (COUNTRIES.length) {
      console.log(`  otro pais   ${otroPais} (${saltadasSinParsear} saltadas sin parsear)`);
    }
    console.log(`  guardadas   ${insertadas} (${pct}% de las procesadas)`);
    console.log(`  descartadas ${descartadas}`);
    if (ilegibles) console.log(`  json roto   ${ilegibles}`);

    // Por regla, para poder ajustar los umbrales con evidencia y no a ojo.
    console.log('\n  Descartes por motivo');
    for (const [motivo, n] of [...rechazos].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(8)}  ${motivo}`);
    }
  })
  .catch((e) => {
    // El número de línea es lo que hace utilizable a --resume-from.
    console.error(`\nFalló en la linea ${leidas}:`, e);
    console.error(`Reanudar con: --resume-from ${leidas - (leidas % BATCH)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
