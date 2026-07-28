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

/** Escapa los comodines de LIKE para que el input del usuario sea texto literal. */
export function likePrefix(query: string): string {
  return query.replace(/[\\%_]/g, '\\$&') + '%';
}
