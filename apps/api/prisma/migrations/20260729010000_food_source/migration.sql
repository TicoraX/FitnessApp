-- De dónde salió el alimento. Hasta ahora la única vía de alta era
-- POST /foods, así que 'user' es el default correcto para todo lo que ya
-- existe; el seed se reetiqueta aparte.
--
-- No alcanza con verified: ese flag responde "¿alguien revisó esto?" y este
-- responde "¿quién lo trajo?". Con el catálogo de OpenFoodFacts entrando, la
-- UI necesita distinguir un alimento propio de uno importado, y la búsqueda
-- necesita poder desempatar sin cambiar el esquema otra vez.

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('user', 'openfoodfacts', 'curated');

-- AlterTable
ALTER TABLE "food_items" ADD COLUMN "source" "FoodSource" NOT NULL DEFAULT 'user';

-- Reetiquetar el catálogo que ya está cargado. Hasta ahora verified significaba
-- exactamente "vino del seed curado", así que sirve de discriminante: sin este
-- backfill, toda base existente se queda con el seed marcado como 'user' y el
-- default correcto solo aplica a las filas nuevas.
UPDATE "food_items" SET "source" = 'curated' WHERE "verified" = true;
