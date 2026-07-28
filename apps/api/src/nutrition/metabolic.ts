/**
 * Motor matemático del blueprint §3. Funciones puras: sin DB, sin Nest.
 */

export type Gender = 'male' | 'female' | 'other';

/** kcal por kg de tejido corporal. Estándar clínico. */
const KCAL_PER_KG = 7700;

/** Piso de seguridad: nunca prescribir por debajo de esto. */
const MIN_CALORIES = { male: 1500, female: 1200, other: 1200 } as const;

/** Reparto 30/40/30 (proteína/carbos/grasa), consistente con el ejemplo de §5.1. */
const MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 };

export function calculateAge(dob: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/**
 * Mifflin-St Jeor; Katch-McArdle si se conoce el % de grasa corporal.
 * 'other' usa el promedio de las constantes de sexo (+5 / -161) => -78.
 */
export function calculateBmr(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  bodyFatPct?: number;
}): number {
  if (input.bodyFatPct !== undefined) {
    const lbm = input.weightKg * (1 - input.bodyFatPct / 100);
    return round(370 + 21.6 * lbm);
  }
  const constant = { male: 5, female: -161, other: -78 }[input.gender];
  return round(10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + constant);
}

export function calculateTdee(bmr: number, activityLevel: number): number {
  return round(bmr * activityLevel);
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
}

/**
 * weeklyChangeKg negativo = déficit (bajar de peso), positivo = superávit.
 * ponytail: el ejemplo del SRS §5.1 muestra 2215 kcal (déficit redondo de 500).
 * Acá se usa 7700 kcal/kg => 550 kcal/día, que es el valor fisiológico correcto.
 */
export function calculateTargets(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activityLevel: number;
  weeklyChangeKg: number;
  bodyFatPct?: number;
}): NutritionTargets {
  const bmr = calculateBmr(input);
  const tdee = calculateTdee(bmr, input.activityLevel);

  const dailyAdjustment = (input.weeklyChangeKg * KCAL_PER_KG) / 7;
  const dailyCalories = Math.max(round(tdee + dailyAdjustment), MIN_CALORIES[input.gender]);

  return {
    bmr,
    tdee,
    dailyCalories,
    macros: {
      proteinG: round((dailyCalories * MACRO_SPLIT.protein) / 4),
      carbsG: round((dailyCalories * MACRO_SPLIT.carbs) / 4),
      fatG: round((dailyCalories * MACRO_SPLIT.fat) / 9),
    },
  };
}

/** EMA de peso (§3.3). alpha = 0.10 por defecto. */
export function smoothWeight(currentKg: number, previousEma: number, alpha = 0.1): number {
  return Number((currentKg * alpha + previousEma * (1 - alpha)).toFixed(2));
}

const round = (n: number) => Math.round(n);
