/**
 * Cronómetro de descanso entre series.
 *
 * Vive solo en el cliente: cuánto descansaste el martes pasado no es un dato
 * que alguien vaya a consultar, así que no toca la base ni el esquema.
 *
 * La cuenta sale siempre de restar contra una marca absoluta, nunca de un
 * contador que se decrementa. Un `setInterval` que descuenta de a un segundo se
 * congela cuando bloqueás el teléfono o cambiás de app, y noventa segundos de
 * descanso es exactamente cuando eso pasa: volvés y el reloj quedó parado donde
 * lo dejaste. Con la marca, el intervalo solo repinta.
 */

/** Noventa segundos. Fijo, editable en el momento con los botones de la barra. */
export const DESCANSO_MS = 90_000;

/** Cuánto suma o resta cada toque a los botones de ajuste. */
export const AJUSTE_MS = 15_000;

/**
 * Segundos que faltan hasta `hasta`, medidos contra `ahora`.
 *
 * `ahora` entra por parámetro para que la función sea pura y se pueda probar
 * sin navegador ni relojes falsos.
 */
export function segundosRestantes(hasta: number, ahora: number): number {
  return Math.max(0, Math.ceil((hasta - ahora) / 1000));
}

/** `1:30`, que es como se lee un descanso. */
export function formatear(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
