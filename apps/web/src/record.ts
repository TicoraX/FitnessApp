/**
 * ¿La serie que se acaba de registrar superó el récord del movimiento?
 *
 * La comparación ya existía: `GET /logs/strength/history` devuelve `best` y el
 * cliente lo tiene cargado desde que elegís el movimiento. Lo que faltaba era
 * decirlo. El récord se descubría semanas después entrando al detalle.
 *
 * El orden es el mismo que usa el API para elegir el mejor: primero los kilos,
 * y a igualdad de kilos, las repeticiones.
 */
export interface Marca {
  reps: number;
  weight_kg: number | null;
}

export function esRecord(mejor: Marca | null | undefined, serie: Marca): boolean {
  // La primera vez que hacés un movimiento no es un récord, es la primera vez.
  // Anunciarlo convierte el aviso en ruido y le saca el significado al que sí
  // lo es.
  if (!mejor) return false;

  const kilosAhora = serie.weight_kg ?? 0;
  const kilosMejor = mejor.weight_kg ?? 0;
  if (kilosAhora > kilosMejor) return true;
  if (kilosAhora < kilosMejor) return false;
  return serie.reps > mejor.reps;
}
