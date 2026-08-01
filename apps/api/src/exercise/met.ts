import { ACTIVITIES, Activity } from './catalog';
import { MOVEMENTS, Movement } from './movements';
import { nombreEs } from './movements-es';
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

/** Lo que ve el cliente: el nombre real y, si está curado, el de español. */
export type MovementDto = Movement & { name_es: string | null };

export const conNombreEs = (m: Movement): MovementDto => ({ ...m, name_es: nombreEs(m.name) });

/**
 * Búsqueda de movimientos de gimnasio.
 *
 * Mira el nombre en inglés, el curado en español, y además zona, equipo y
 * músculo objetivo. El dataset solo trae los nombres en inglés, así que sin eso
 * escribir en español no llegaría a nada.
 */
export function searchMovements(
  raw: string,
  limit = 20,
  filtros: { body?: string; equipment?: string } = {},
): MovementDto[] {
  const q = normalizeQuery(raw);
  const pasa = (m: Movement) =>
    (!filtros.body || m.body === filtros.body) &&
    (!filtros.equipment || m.equipment === filtros.equipment);

  if (!q) return MOVEMENTS.filter(pasa).slice(0, limit).map(conNombreEs);

  // El exacto va primero: buscar "dominadas" tiene que dar "Dominadas" y no
  // "Dominadas asistidas", que también empieza igual. Se recorre el catálogo
  // entero sin cortar al llenar el cupo: cortando antes, un exacto que estuviera
  // más abajo en la lista no llegaba nunca. Son 1324 comparaciones en memoria.
  const exactos: Movement[] = [];
  const empiezan: Movement[] = [];
  const contienen: Movement[] = [];

  for (const m of MOVEMENTS) {
    if (!pasa(m)) continue;
    const n = normalizeQuery(m.name);
    // El nombre en español, cuando está curado, pesa igual que el original:
    // buscar "sentadilla" tiene que encontrar "barbell full squat".
    const es = nombreEs(m.name);
    const nEs = es ? normalizeQuery(es) : '';

    if (n === q || nEs === q) exactos.push(m);
    else if (n.startsWith(q) || (nEs && nEs.startsWith(q))) empiezan.push(m);
    else if (
      n.includes(q) ||
      (nEs && nEs.includes(q)) ||
      normalizeQuery(m.body).includes(q) ||
      normalizeQuery(m.equipment).includes(q) ||
      normalizeQuery(m.target).includes(q)
    ) {
      contienen.push(m);
    }
  }

  return [...exactos, ...empiezan, ...contienen].slice(0, limit).map(conNombreEs);
}

/** Los valores que existen de verdad, para las chips de exploración. */
export function movementFacets(): { body: string[]; equipment: string[] } {
  const zonas = new Set<string>();
  const equipos = new Set<string>();
  for (const m of MOVEMENTS) {
    zonas.add(m.body);
    equipos.add(m.equipment);
  }
  return {
    body: [...zonas].sort((a, b) => a.localeCompare(b, 'es')),
    equipment: [...equipos].sort((a, b) => a.localeCompare(b, 'es')),
  };
}

/**
 * La zona que trabaja un movimiento registrado. Se resuelve por nombre porque
 * las series guardan el texto, no una referencia al catálogo; lo que ya no
 * está en el catálogo cuenta como "otros" en vez de desaparecer del resumen.
 */
export function bodyOf(name: string): string {
  return porNombre().get(normalizeQuery(name)) ?? 'otros';
}

let indice: Map<string, string> | null = null;
/** El resumen resuelve una zona por serie: 1324 comparaciones cada vez, no. */
function porNombre(): Map<string, string> {
  indice ??= new Map(MOVEMENTS.map((m) => [normalizeQuery(m.name), m.body]));
  return indice;
}

/** El MET del catálogo para un nombre exacto, o null si es una actividad libre. */
export function metOf(name: string): number | null {
  const n = normalizeQuery(name);
  return ACTIVITIES.find((a) => normalizeQuery(a.name) === n)?.met ?? null;
}
