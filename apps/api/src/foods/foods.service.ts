import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FoodItem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { likeContains, normalizeQuery } from './search-query';
import { mapOffProduct, type MappedFood, type OffProduct } from './off-mapper';

const OFF_API = process.env.OFF_API_URL ?? 'https://world.openfoodfacts.org';
/** OpenFoodFacts pide identificarse; sin esto responden 403 a los anónimos. */
const OFF_USER_AGENT = 'FitTrack/0.1 (https://github.com/TicoraX/FitnessApp)';

@Injectable()
export class FoodsService {
  private readonly logger = new Logger('foods');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Búsqueda difusa vía pg_trgm (L5 del blueprint).
   *
   * Usa word_similarity (operador `<%`) y no similarity (`%`): el segundo
   * compara cadenas completas, así que "pollo" contra "Pechuga de pollo
   * cocida" puntúa ~0.2 y nunca pasa el umbral. word_similarity busca el
   * término dentro del nombre. El ILIKE cubre las subcadenas que no caen en
   * límite de palabra ("integral" dentro de "pan integral"). Los tres caminos
   * entran por los índices GIN de idx_food_name_trgm/idx_food_brand_trgm.
   */
  async search(rawQuery: string, limit: number) {
    const q = normalizeQuery(rawQuery);
    if (q.length < 2) return { status: 'success', data: [] };

    // $queryRaw no aplica el mapeo @map del schema: sin estos alias, las
    // columnas snake_case llegan como undefined y salen null en el JSON.
    const rows = await this.prisma.$queryRaw<(FoodItem & { score: number })[]>`
      SELECT id, barcode, name, brand, verified, source,
             serving_size_amount AS "servingSizeAmount",
             serving_size_unit   AS "servingSizeUnit",
             calories, protein, carbohydrates, fat, fiber, sugar,
             sodium_mg           AS "sodiumMg",
             GREATEST(
               word_similarity(${q}, f_unaccent(name)),
               word_similarity(${q}, f_unaccent(COALESCE(brand, '')))
             ) AS score
      FROM food_items
      WHERE ${q} <% f_unaccent(name)
         OR ${q} <% f_unaccent(COALESCE(brand, ''))
         OR f_unaccent(name) ILIKE ${likeContains(q)}
      ORDER BY score DESC, verified DESC, name ASC
      LIMIT ${limit}`;

    return { status: 'success', data: rows.map(toResponse) };
  }

  /** Lo que el usuario ya registró, sin repetir, lo más reciente primero. */
  async recent(userId: string, limit: number) {
    const entries = await this.prisma.mealEntry.findMany({
      where: { dailyLog: { userId } },
      distinct: ['foodItemId'],
      orderBy: { loggedAt: 'desc' },
      take: limit,
      include: { foodItem: true },
    });
    return { status: 'success', data: entries.map((e) => toResponse(e.foodItem)) };
  }

  /**
   * Si el código no está en el catálogo se consulta OpenFoodFacts en vivo y, si
   * el producto pasa los mismos filtros que el importador masivo, se guarda y
   * se devuelve. Sin esto, escanear algo que el dump no trajo es un callejón
   * sin salida justo cuando el usuario tiene el paquete en la mano.
   *
   * Es un handler de lectura, fuera de toda transacción, y falla hacia el 404
   * que ya existía: si OFF no responde, tarda, o el producto es basura, el
   * usuario ve lo mismo que antes.
   */
  async findByBarcode(barcode: string) {
    const local = await this.prisma.foodItem.findUnique({ where: { barcode } });
    if (local) return { status: 'success', data: toResponse(local) };

    const remoto = await this.fetchFromOpenFoodFacts(barcode);
    if (!remoto) throw new NotFoundException('Código de barras no encontrado');

    try {
      const creado = await this.prisma.foodItem.create({
        data: { ...remoto, source: 'openfoodfacts' },
      });
      return { status: 'success', data: toResponse(creado) };
    } catch (e) {
      // Dos escaneos del mismo código a la vez: el que perdió relee en vez de
      // fallar. El alimento existe, que es lo único que le importa al usuario.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const ganador = await this.prisma.foodItem.findUnique({ where: { barcode } });
        if (ganador) return { status: 'success', data: toResponse(ganador) };
      }
      throw e;
    }
  }

  private async fetchFromOpenFoodFacts(barcode: string): Promise<MappedFood | null> {
    try {
      const res = await fetch(`${OFF_API}/api/v2/product/${barcode}.json`, {
        // Dos segundos: esto corre dentro de un request del usuario, que está
        // mirando la pantalla. Antes de esperar más, mejor el 404.
        signal: AbortSignal.timeout(2000),
        headers: { 'User-Agent': OFF_USER_AGENT },
      });
      if (!res.ok) return null;

      const body = (await res.json()) as { status?: number; product?: OffProduct };
      if (body.status !== 1 || !body.product) return null;

      // El code no siempre vuelve en el cuerpo; el consultado es el bueno.
      const mapeado = mapOffProduct({ ...body.product, code: barcode });
      if (!mapeado.ok) {
        this.logger.warn(`OFF ${barcode} descartado por ${mapeado.reason}`);
        return null;
      }
      return mapeado.food;
    } catch {
      // Timeout, DNS, OFF caído: no es un error del usuario ni nuestro.
      return null;
    }
  }

  async create(userId: string, dto: CreateFoodDto) {
    try {
      const food = await this.prisma.foodItem.create({
        data: {
          barcode: dto.barcode,
          name: dto.name,
          brand: dto.brand,
          servingSizeAmount: dto.serving_size_amount,
          servingSizeUnit: dto.serving_size_unit,
          calories: dto.calories,
          protein: dto.protein,
          carbohydrates: dto.carbohydrates,
          fat: dto.fat,
          fiber: dto.fiber ?? 0,
          sugar: dto.sugar ?? 0,
          sodiumMg: dto.sodium_mg ?? 0,
          createdById: userId,
          // verified queda en false: solo el catálogo curado se marca verificado.
        },
      });
      return { status: 'success', data: toResponse(food) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un alimento con ese código de barras');
      }
      throw e;
    }
  }
}

function toResponse(f: FoodItem & { score?: number }) {
  return {
    id: f.id,
    barcode: f.barcode,
    name: f.name,
    brand: f.brand,
    verified: f.verified,
    source: f.source,
    serving_size_amount: Number(f.servingSizeAmount),
    serving_size_unit: f.servingSizeUnit,
    calories: f.calories,
    protein: Number(f.protein),
    carbohydrates: Number(f.carbohydrates),
    fat: Number(f.fat),
    fiber: Number(f.fiber),
    sugar: Number(f.sugar),
    sodium_mg: Number(f.sodiumMg),
  };
}
