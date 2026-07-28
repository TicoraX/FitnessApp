-- Búsqueda insensible a acentos: "brocoli" tiene que encontrar "Brócoli".
-- El servicio normaliza la consulta en JS; esto normaliza el otro lado.
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- unaccent() es STABLE, no IMMUTABLE, así que no se puede indexar directo.
-- Fijar el diccionario por nombre la vuelve determinística.
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

CREATE INDEX idx_food_name_unaccent_trgm
  ON food_items USING gin (f_unaccent(name) gin_trgm_ops);
CREATE INDEX idx_food_brand_unaccent_trgm
  ON food_items USING gin (f_unaccent(brand) gin_trgm_ops);

-- Los índices sobre las columnas crudas quedaron sin consultas que los usen:
-- todas las búsquedas pasan ahora por f_unaccent(). Un índice GIN que nadie
-- lee sigue costando en cada INSERT, y esta tabla apunta a 20M de filas.
DROP INDEX IF EXISTS idx_food_name_trgm;
DROP INDEX IF EXISTS idx_food_brand_trgm;

-- Duplicaba el índice único que ya crea la constraint UNIQUE de barcode.
DROP INDEX IF EXISTS idx_food_barcode;
