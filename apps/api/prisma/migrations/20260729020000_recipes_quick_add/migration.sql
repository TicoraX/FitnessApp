-- Recetas y quick add.
--
-- Loguear una receta expande a N filas de meal_entries, una por componente,
-- marcadas con un recipe_group_id compartido, y el API las colapsa de vuelta a
-- una sola línea al leer el día. La alternativa (una fila apuntando a la
-- receta) parece más limpia y tiene un problema que decide solo: si la receta
-- se edita después, todos los días pasados se reescriben. Con la expansión cada
-- fila lleva su propio servings_consumed y nada vuelve a mirar la definición de
-- la receta después de escribir.

CREATE TABLE "recipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "total_servings" DECIMAL(6,2) NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recipe_components" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipe_id" UUID NOT NULL,
    "food_item_id" UUID NOT NULL,
    "quantity" DECIMAL(6,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "recipe_components_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recipes_user_id_is_archived_idx" ON "recipes"("user_id", "is_archived");
CREATE INDEX "recipe_components_recipe_id_idx" ON "recipe_components"("recipe_id");

ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT: un alimento usado en una receta no se puede borrar por debajo.
ALTER TABLE "recipe_components" ADD CONSTRAINT "recipe_components_food_item_id_fkey"
  FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Expansión de recetas sobre el diario.
ALTER TABLE "meal_entries"
  ADD COLUMN "recipe_id" UUID,
  ADD COLUMN "recipe_group_id" UUID,
  ADD COLUMN "recipe_servings" DECIMAL(6,2);

ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_recipe_id_fkey"
  FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice completo y no parcial aunque la mayoría de las filas tenga NULL acá:
-- Prisma no sabe expresar el WHERE, así que la versión parcial le genera drift
-- en cada migrate dev y termina "arreglándolo" sola. El espacio que se ahorra
-- no paga esa trampa.
CREATE INDEX "meal_entries_recipe_group_id_idx" ON "meal_entries"("recipe_group_id");

-- Quick add: calorías sueltas sin alimento detrás.
ALTER TABLE "meal_entries"
  ALTER COLUMN "food_item_id" DROP NOT NULL,
  ADD COLUMN "quick_name" VARCHAR(100),
  ADD COLUMN "quick_calories" INTEGER,
  ADD COLUMN "quick_protein" DECIMAL(6,2),
  ADD COLUMN "quick_carbs" DECIMAL(6,2),
  ADD COLUMN "quick_fat" DECIMAL(6,2);

-- El invariante que Prisma no sabe modelar: o hay alimento, o hay quick add
-- completo. Sin esto, un bug de servicio deja una fila que no suma nada y no se
-- puede renderizar. Prisma ignora los CHECK, así que sobrevive a los
-- migrate dev futuros. NOT VALID + VALIDATE evita el ACCESS EXCLUSIVE largo
-- sobre la tabla ya poblada.
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_food_or_quick_chk" CHECK (
  ("food_item_id" IS NOT NULL AND "quick_name" IS NULL)
  OR
  ("food_item_id" IS NULL AND "quick_name" IS NOT NULL
   AND "quick_calories" IS NOT NULL AND "quick_protein" IS NOT NULL
   AND "quick_carbs" IS NOT NULL AND "quick_fat" IS NOT NULL)
) NOT VALID;

ALTER TABLE "meal_entries" VALIDATE CONSTRAINT "meal_entries_food_or_quick_chk";
