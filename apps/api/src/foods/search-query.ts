/**
 * Normaliza el texto de búsqueda antes de pasarlo a pg_trgm.
 * No escapa nada: la query va parametrizada. Esto es solo calidad de resultados.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // acentos: "platano" encuentra "plátano"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 100);
}

/**
 * Patrón de subcadena para ILIKE, con los comodines del input escapados.
 * Es subcadena y no prefijo porque el término buscado casi nunca abre el
 * nombre: "pollo" tiene que encontrar "Pechuga de pollo cocida".
 */
export function likeContains(query: string): string {
  return '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
}
