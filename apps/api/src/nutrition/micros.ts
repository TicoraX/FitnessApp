/**
 * Micronutrientes que se siguen, con su unidad y su valor diario de referencia.
 *
 * La lista es corta a propósito. OpenFoodFacts declara decenas de nutrimentos,
 * pero la mayoría viene vacía en casi todo el catálogo: seguir quince campos
 * que son cero el 95% de las veces da una pantalla de ceros, no información.
 * Estos seis son los que el etiquetado obligatorio cubre mejor.
 *
 * Los VDR son los NRV del reglamento europeo de etiquetado (1169/2011), que es
 * de donde sale la mayor parte del catálogo de OFF. No dependen de la persona:
 * son referencia de etiqueta, no un objetivo personalizado como las calorías.
 */
export const MICROS = {
  saturated_fat_g: { label: 'Grasa saturada', unit: 'g', rdi: 20 },
  cholesterol_mg: { label: 'Colesterol', unit: 'mg', rdi: 300 },
  potassium_mg: { label: 'Potasio', unit: 'mg', rdi: 2000 },
  calcium_mg: { label: 'Calcio', unit: 'mg', rdi: 800 },
  iron_mg: { label: 'Hierro', unit: 'mg', rdi: 14 },
  vitamin_c_mg: { label: 'Vitamina C', unit: 'mg', rdi: 80 },
} as const;

export type MicroKey = keyof typeof MICROS;
export type Micros = Record<MicroKey, number>;

export const MICRO_KEYS = Object.keys(MICROS) as MicroKey[];

export const emptyMicros = (): Micros =>
  Object.fromEntries(MICRO_KEYS.map((k) => [k, 0])) as Micros;

/**
 * Lee el micros_json de un alimento tolerando lo que haya: la columna existió
 * mucho antes que esta feature con default '{}', y el importador viejo pudo
 * dejar cualquier cosa. Lo que no sea un número finito y positivo cuenta cero.
 */
export function parseMicros(raw: unknown): Micros {
  const out = emptyMicros();
  if (!raw || typeof raw !== 'object') return out;

  const obj = raw as Record<string, unknown>;
  for (const k of MICRO_KEYS) {
    const n = Number(obj[k]);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** Suma los micros de las entradas del día, cada uno escalado por sus porciones. */
export function sumMicros(entries: { micros: Micros; servings: number }[]): Micros {
  const total = emptyMicros();
  for (const e of entries) {
    for (const k of MICRO_KEYS) total[k] += e.micros[k] * e.servings;
  }
  for (const k of MICRO_KEYS) total[k] = Number(total[k].toFixed(1));
  return total;
}
