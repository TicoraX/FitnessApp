/**
 * Cómo se llama la tecla modificadora en ESTA máquina.
 *
 * El manejador de atajos acepta `ctrlKey || metaKey`, así que Ctrl+K funciona
 * en Windows y Cmd+K en Mac. Lo que estaba mal era la etiqueta: decía siempre
 * "⌘K", que en Windows nombra una tecla que el teclado no tiene.
 *
 * `userAgentData.platform` es lo actual; `navigator.platform` está deprecado
 * pero sigue siendo lo único que responde en Safari y Firefox. Sin ninguno de
 * los dos se cae a Ctrl, que es lo más probable.
 */
export function teclaModificadora(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';

  const conDatos = navigator as Navigator & { userAgentData?: { platform?: string } };
  const plataforma = conDatos.userAgentData?.platform ?? navigator.platform ?? '';

  return /mac|iphone|ipad|ipod/i.test(plataforma) ? '⌘' : 'Ctrl+';
}
