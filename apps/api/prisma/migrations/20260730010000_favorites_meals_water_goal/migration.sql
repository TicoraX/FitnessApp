-- CreateEnum
CREATE TYPE "RecipeKind" AS ENUM ('recipe', 'meal');

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN "kind" "RecipeKind" NOT NULL DEFAULT 'recipe';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "water_goal_ml" INTEGER NOT NULL DEFAULT 2000;

-- Una meta de agua de cero o de cien litros no es un objetivo, es un typo.
ALTER TABLE "users" ADD CONSTRAINT "users_water_goal_chk" CHECK ("water_goal_ml" BETWEEN 250 AND 10000);

-- CreateTable
CREATE TABLE "food_favorites" (
    "user_id" UUID NOT NULL,
    "food_item_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_favorites_pkey" PRIMARY KEY ("user_id","food_item_id")
);

-- CreateIndex
CREATE INDEX "food_favorites_user_id_created_at_idx" ON "food_favorites"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "food_favorites" ADD CONSTRAINT "food_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_favorites" ADD CONSTRAINT "food_favorites_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
