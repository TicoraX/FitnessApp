-- ponytail: Prisma no genera extensiones ni operator classes GIN por sí solo.
-- Pegar este bloque al inicio de la primera migración generada
-- (prisma migrate dev --create-only) o ejecutarlo a mano una vez.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE INDEX IF NOT EXISTS idx_food_barcode ON food_items(barcode);
CREATE INDEX IF NOT EXISTS idx_food_name_trgm ON food_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_brand_trgm ON food_items USING gin (brand gin_trgm_ops);
