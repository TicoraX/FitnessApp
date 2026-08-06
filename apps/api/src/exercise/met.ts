import { ACTIVITIES, Activity } from './catalog';
import { MOVEMENTS, Movement } from './movements';
import { nombreEs } from './movements-es';
import { mediaDe } from './movements-media';
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

/**
 * Lo que ve el cliente: el nombre real, el de español si está curado, y el
 * nombre del archivo de media.
 *
 * `media` es un nombre de archivo, no una URL: quién la sirve lo decide el
 * cliente con su propia base, porque las imágenes no están en este repo. Ver
 * movements-media.ts para el motivo.
 */
export type MovementDto = Movement & { name_es: string | null; media: string | null };

export const conNombreEs = (m: Movement): MovementDto => ({
  ...m,
  name_es: nombreEs(m.name),
  media: mediaDe(m.id),
});

/**
 * Búsqueda de movimientos de gimnasio.
 *
 * Mira el nombre en inglés, el curado en español, y además zona, equipo y
 * músculo objetivo. El dataset solo trae los nombres en inglés, así que sin eso
 * escribir en español no llegaría a nada.
 */
/** Todos los que matchean, en orden de relevancia, sin recortar. */
function matchMovements(raw: string, filtros: { id?: string; body?: string; equipment?: string }): Movement[] {
  const q = normalizeQuery(raw);
  const pasa = (m: Movement) =>
    (!filtros.id || m.id === filtros.id) &&
    (!filtros.body || m.body === filtros.body) &&
    (!filtros.equipment || m.equipment === filtros.equipment);

  if (!q) return MOVEMENTS.filter(pasa);

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

  return [...exactos, ...empiezan, ...contienen];
}

export function searchMovements(
  raw: string,
  limit = 20,
  filtros: { id?: string; body?: string; equipment?: string } = {},
  offset = 0,
): MovementDto[] {
  return matchMovements(raw, filtros).slice(offset, offset + limit).map(conNombreEs);
}

/** Cuántos matchean en total, para el paginador del catálogo. */
export function countMovements(raw: string, filtros: { id?: string; body?: string; equipment?: string } = {}): number {
  return matchMovements(raw, filtros).length;
}

/**
 * Los valores que existen de verdad, para las chips de exploración.
 *
 * Con una zona elegida, el equipo se filtra a los que de verdad tienen
 * movimientos ahí: sin esto, elegir "core" y después "banda deslizante"
 * (que no tiene ningún movimiento de core) daba una lista vacía sin
 * explicación. La zona no se filtra por equipo: es el primer filtro que se
 * elige, así que siempre muestra el universo completo.
 */
export function movementFacets(filtros: { body?: string } = {}): { body: string[]; equipment: string[] } {
  const zonas = new Set<string>();
  const equipos = new Set<string>();
  for (const m of MOVEMENTS) {
    zonas.add(m.body);
    if (!filtros.body || m.body === filtros.body) equipos.add(m.equipment);
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
  return movementByName(name)?.body ?? 'otros';
}

let indiceMovimiento: Map<string, MovementDto> | null = null;
/** Resuelve un movimiento por su nombre exacto en inglés o español. */
export function movementByName(name: string): MovementDto | null {
  if (!indiceMovimiento) {
    indiceMovimiento = new Map();
    for (const m of MOVEMENTS) {
      const dto = conNombreEs(m);
      indiceMovimiento.set(normalizeQuery(m.name), dto);
      if (dto.name_es) {
        indiceMovimiento.set(normalizeQuery(dto.name_es), dto);
      }
    }
  }
  return indiceMovimiento.get(normalizeQuery(name)) ?? null;
}

/** El MET del catálogo para un nombre exacto, o null si es una actividad libre. */
export function metOf(name: string): number | null {
  const n = normalizeQuery(name);
  return ACTIVITIES.find((a) => normalizeQuery(a.name) === n)?.met ?? null;
}
