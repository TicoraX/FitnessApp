import { ACTIVITIES, Activity } from './catalog';
import { normalizeQuery } from '../foods/search-query';

/**
 * Calorías de una sesión: MET x peso en kg x horas.
 *
 * Es la fórmula del compendio: un MET es el gasto en reposo, ~1 kcal por kg y
 * por hora, y cada actividad se expresa como múltiplo de eso. No descuenta el
 * metabolismo basal que igual se habría gastado en esa hora, que es lo que hace
 * MyFitnessPal: sobreestima entre un 5 y un 15%, y así es como el usuario espera
 * ver el número.
 */
export function caloriesBurned(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60));
}

/** Búsqueda por subcadena sobre el catálogo, sin acentos. Devuelve los mejores primero. */
export function searchActivities(raw: string, limit = 20): Activity[] {
  const q = normalizeQuery(raw);
  if (!q) return ACTIVITIES.slice(0, limit);

  const normalizado = (a: Activity) => normalizeQuery(a.name);
  // Los que empiezan con el término van arriba: buscar "cor" tiene que dar
  // "Correr" antes que "Entrenamiento en circuito".
  const empiezan: Activity[] = [];
  const contienen: Activity[] = [];

  for (const a of ACTIVITIES) {
    const n = normalizado(a);
    if (n.startsWith(q)) empiezan.push(a);
    else if (n.includes(q)) contienen.push(a);
  }

  return [...empiezan, ...contienen].slice(0, limit);
}

/** El MET del catálogo para un nombre exacto, o null si es una actividad libre. */
export function metOf(name: string): number | null {
  const n = normalizeQuery(name);
  return ACTIVITIES.find((a) => normalizeQuery(a.name) === n)?.met ?? null;
}
