/** Acepta Decimal de Prisma o number; ambos responden a Number(). */
type Numeric = { toString(): string };

export interface EntryForTotals {
  servingsConsumed: Numeric;
  foodItem: {
    calories: number;
    protein: Numeric;
    carbohydrates: Numeric;
    fat: Numeric;
    fiber: Numeric;
    sugar: Numeric;
    sodiumMg: Numeric;
  };
}

export interface Totals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

/**
 * Suma un día completo. ponytail: se agrega en JS, no en SQL, porque un día
 * son decenas de filas. Si aparece en el perfil, pasar a SUM() en Postgres.
 */
export function sumEntries(entries: EntryForTotals[]): Totals {
  const t: Totals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
  };

  for (const e of entries) {
    const s = Number(e.servingsConsumed);
    const f = e.foodItem;
    t.calories += f.calories * s;
    t.protein_g += Number(f.protein) * s;
    t.carbs_g += Number(f.carbohydrates) * s;
    t.fat_g += Number(f.fat) * s;
    t.fiber_g += Number(f.fiber) * s;
    t.sugar_g += Number(f.sugar) * s;
    t.sodium_mg += Number(f.sodiumMg) * s;
  }

  t.calories = Math.round(t.calories);
  for (const k of ['protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'] as const) {
    t[k] = Number(t[k].toFixed(1));
  }
  return t;
}

/**
 * Escala unos totales por un factor. Existe para las porciones de una receta:
 * se suman los componentes con sumEntries y se divide por cuánto rinde.
 */
export function scaleTotals(t: Totals, factor: number): Totals {
  return {
    calories: Math.round(t.calories * factor),
    protein_g: Number((t.protein_g * factor).toFixed(1)),
    carbs_g: Number((t.carbs_g * factor).toFixed(1)),
    fat_g: Number((t.fat_g * factor).toFixed(1)),
    fiber_g: Number((t.fiber_g * factor).toFixed(1)),
    sugar_g: Number((t.sugar_g * factor).toFixed(1)),
    sodium_mg: Number((t.sodium_mg * factor).toFixed(1)),
  };
}

/**
 * Los nutrientes de una entrada, venga de un alimento o de un quick add.
 *
 * Un quick add es estructuralmente "un alimento con estos macros, una porción
 * consumida", así que sintetizar acá la forma de foodItem deja a sumEntries sin
 * enterarse de que existen dos clases de entrada.
 */
export function nutrientsOf(e: {
  foodItem: EntryForTotals['foodItem'] | null;
  quickCalories: number | null;
  quickProtein: Numeric | null;
  quickCarbs: Numeric | null;
  quickFat: Numeric | null;
}): EntryForTotals['foodItem'] {
  if (e.foodItem) return e.foodItem;
  // El quick add no pide fibra, azúcar ni sodio: existe para cuando no se
  // saben ni los macros. Cero es el valor honesto, no una estimación.
  return {
    calories: e.quickCalories ?? 0,
    protein: e.quickProtein ?? 0,
    carbohydrates: e.quickCarbs ?? 0,
    fat: e.quickFat ?? 0,
    fiber: 0,
    sugar: 0,
    sodiumMg: 0,
  };
}

/** Lo que queda del objetivo diario. Negativo = se pasó. */
export function remaining(goal: { dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number }, totals: Totals) {
  return {
    calories: goal.dailyCalories - totals.calories,
    protein_g: Number((goal.proteinGrams - totals.protein_g).toFixed(1)),
    carbs_g: Number((goal.carbsGrams - totals.carbs_g).toFixed(1)),
    fat_g: Number((goal.fatGrams - totals.fat_g).toFixed(1)),
  };
}
