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
 * Suma un día completo. ponytail: se agrega en JS, no en SQL — un día son
 * decenas de filas. Si esto aparece en el perfil, pasar a SUM() en Postgres.
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

/** Lo que queda del objetivo diario. Negativo = se pasó. */
export function remaining(goal: { dailyCalories: number; proteinGrams: number; carbsGrams: number; fatGrams: number }, totals: Totals) {
  return {
    calories: goal.dailyCalories - totals.calories,
    protein_g: Number((goal.proteinGrams - totals.protein_g).toFixed(1)),
    carbs_g: Number((goal.carbsGrams - totals.carbs_g).toFixed(1)),
    fat_g: Number((goal.fatGrams - totals.fat_g).toFixed(1)),
  };
}
