/**
 * Qué objetivo regía un día dado.
 *
 * `is_active` responde "cuál rige ahora", y para un día pasado esa es la
 * pregunta equivocada: quien comía a 2200 kcal en julio y hoy bajó a 1800 no
 * puede ver julio entero en rojo porque cambió de plan en agosto. Los datos ya
 * estaban, user_goals guarda effective_from y desactiva en vez de borrar.
 */

/** Lo mínimo que hace falta para elegir; el llamador pasa filas completas. */
export interface ConVigencia {
  effectiveFrom: Date;
}

/**
 * El objetivo con effective_from más alto que no supere `logDate`.
 *
 * Cuando no hay ninguno se cae al más viejo: isLogDate permite a propósito
 * cargar días anteriores al alta, y ahí el primer objetivo que se fijó es el
 * más cercano en el tiempo. Devolver null dejaría el día sin margen, que es
 * peor y además cambia una respuesta que hoy siempre trae objetivo.
 */
export function objetivoVigente<T extends ConVigencia>(
  goals: readonly T[],
  logDate: string,
): T | null {
  if (goals.length === 0) return null;

  // Comparar por texto YYYY-MM-DD y no por Date: effective_from es una columna
  // DATE y construir un Date del lado de Node mete la zona horaria en una
  // decisión que es de calendario.
  const ordenados = [...goals].sort((a, b) => dia(a).localeCompare(dia(b)));
  let elegido: T | null = null;
  for (const g of ordenados) {
    if (dia(g) > logDate) break;
    elegido = g;
  }
  return elegido ?? ordenados[0]!;
}

const dia = (g: ConVigencia): string => g.effectiveFrom.toISOString().slice(0, 10);
