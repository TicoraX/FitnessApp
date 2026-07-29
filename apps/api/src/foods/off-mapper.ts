/**
 * Traducción de un producto de OpenFoodFacts a una fila de food_items.
 *
 * Vive en src/ y no en scripts/ porque lo usan dos caminos: el importador
 * masivo del dump y el fallback en vivo de GET /foods/barcode/:code. Duplicarlo
 * significaría que un filtro corregido en un lado deja pasar basura por el otro.
 *
 * OpenFoodFacts es colaborativo y una parte del catálogo es incorrecta: unidades
 * confundidas, macros imposibles, energía en kJ metida en el campo de kcal.
 * Nada de eso se ve raro en la pantalla, solo da un número mal, así que los
 * filtros son la mitad del trabajo acá.
 */

/** Forma mínima de un producto de OFF. El dump trae ~200 campos más. */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  states_tags?: string[];
  countries_tags?: string[];
  nutriments?: Record<string, unknown>;
}

export interface MappedFood {
  barcode: string;
  name: string;
  brand: string | null;
  verified: boolean;
  servingSizeAmount: number;
  servingSizeUnit: 'g' | 'ml';
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
}

/** Motivo de descarte. Se cuentan por separado para poder ajustar umbrales con datos. */
export type RejectReason =
  | 'barcode'
  | 'nombre'
  | 'calorias'
  | 'macro_fuera_de_rango'
  | 'macros_suman_de_mas'
  | 'azucar_mayor_que_carbos'
  | 'fibra'
  | 'sodio'
  | 'atwater';

export type MapResult =
  | { ok: true; food: MappedFood }
  | { ok: false; reason: RejectReason };

const BARCODE = /^\d{8,14}$/;

/** kcal por gramo de cada macro, para el chequeo de Atwater. */
const ATWATER = { protein: 4, carbs: 4, fat: 9 };

/** 1 g de sal son 400 mg de sodio (la relación es 1/2.5). */
const SAL_A_SODIO_MG = 400;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Lo que falta se toma como 0: una porción enorme del dump trae nutriments
 *  parciales y sigue siendo útil. Las filas realmente incoherentes las sacan
 *  los chequeos de Atwater y de "calorías sin macros". */
const num0 = (v: unknown): number => num(v) ?? 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * ml cuando el texto de cantidad habla de volumen, g en cualquier otro caso.
 * No hay forma de saberlo desde los nutrimentos, que son por 100 g siempre.
 */
function unidad(p: OffProduct): 'g' | 'ml' {
  const texto = `${p.serving_size ?? ''} ${p.quantity ?? ''}`;
  return /\b\d*\s*(ml|cl|l|litro|litros)\b/i.test(texto) ? 'ml' : 'g';
}

function nombre(p: OffProduct): string | null {
  const bruto = p.product_name_es || p.product_name || p.generic_name || '';
  const limpio = bruto.replace(/\s+/g, ' ').trim();
  return limpio.length >= 2 ? limpio.slice(0, 255) : null;
}

/** OFF guarda las marcas como lista separada por comas; se queda la primera. */
function marca(p: OffProduct): string | null {
  const primera = (p.brands ?? '').split(',')[0]?.replace(/\s+/g, ' ').trim();
  return primera ? primera.slice(0, 255) : null;
}

/**
 * kcal por 100 g. Si falta el campo en kcal se deriva del de kJ, que es el que
 * declaran los fabricantes europeos.
 */
function calorias(n: Record<string, unknown>): number | null {
  const kcal = num(n['energy-kcal_100g']);
  if (kcal !== null) return kcal;

  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  return kj === null ? null : kj / 4.184;
}

function sodioMg(n: Record<string, unknown>): number {
  const sodio = num(n['sodium_100g']);
  if (sodio !== null) return sodio * 1000; // OFF lo guarda en gramos

  const sal = num(n['salt_100g']);
  return sal === null ? 0 : sal * SAL_A_SODIO_MG;
}

/**
 * Todo se normaliza a 100 g/ml porque los nutrimentos de OFF son por 100 g por
 * definición. Pasarlos a "por porción" exigiría confiar en serving_quantity,
 * que falta o está mal en una fracción grande del dump, y un valor malo ahí no
 * produce un número visiblemente raro: escala en silencio todos los macros de
 * ese alimento.
 */
export function mapOffProduct(p: OffProduct): MapResult {
  const barcode = (p.code ?? '').trim();
  if (!BARCODE.test(barcode)) return { ok: false, reason: 'barcode' };

  const name = nombre(p);
  if (name === null) return { ok: false, reason: 'nombre' };

  const n = p.nutriments ?? {};

  const kcalCrudas = calorias(n);
  // 100 g de grasa pura son 900 kcal: por encima es un error de unidad.
  if (kcalCrudas === null || kcalCrudas < 0 || kcalCrudas > 900) {
    return { ok: false, reason: 'calorias' };
  }
  const calories = Math.round(kcalCrudas);

  const protein = round1(num0(n['proteins_100g']));
  const carbohydrates = round1(num0(n['carbohydrates_100g']));
  const fat = round1(num0(n['fat_100g']));
  const fiber = round1(num0(n['fiber_100g']));
  const sugar = round1(num0(n['sugars_100g']));
  const sodiumMg = round1(sodioMg(n));

  const fueraDeRango = (v: number) => v < 0 || v > 100;
  if ([protein, carbohydrates, fat].some(fueraDeRango)) {
    return { ok: false, reason: 'macro_fuera_de_rango' };
  }
  // 5 de holgura: los fabricantes redondean cada macro por separado.
  if (protein + carbohydrates + fat > 105) {
    return { ok: false, reason: 'macros_suman_de_mas' };
  }
  if (sugar > carbohydrates + 5) return { ok: false, reason: 'azucar_mayor_que_carbos' };
  if (fueraDeRango(fiber)) return { ok: false, reason: 'fibra' };
  // Sal pura son 39.300 mg de sodio por 100 g.
  if (sodiumMg < 0 || sodiumMg > 40000) return { ok: false, reason: 'sodio' };

  // Este es el filtro que más rinde: atrapa los kJ declarados como kcal, un
  // error de 4,184x que ningún chequeo de rango detecta porque los macros
  // quedan perfectamente plausibles.
  //
  // De paso cubre las filas con calorías y ningún macro detrás: con los tres en
  // cero el teórico es cero, así que cualquier valor que supere la banda cae
  // acá. Una regla aparte para ese caso sería inalcanzable.
  const teorico = ATWATER.protein * protein + ATWATER.carbs * carbohydrates + ATWATER.fat * fat;
  if (Math.abs(teorico - calories) > Math.max(50, 0.3 * calories)) {
    return { ok: false, reason: 'atwater' };
  }

  return {
    ok: true,
    food: {
      barcode,
      name,
      brand: marca(p),
      // El flag de moderación de OFF. Cubre una fracción chica del dump, que es
      // justamente lo que lo mantiene significando algo: marcar tres millones
      // de filas sin revisar dejaría a verified sin sentido en el ORDER BY.
      verified: (p.states_tags ?? []).includes('en:checked'),
      servingSizeAmount: 100,
      servingSizeUnit: unidad(p),
      calories,
      protein,
      carbohydrates,
      fat,
      fiber,
      sugar,
      sodiumMg,
    },
  };
}
