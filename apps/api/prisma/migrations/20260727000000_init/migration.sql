-- Extensiones requeridas por el blueprint (§4)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "UnitPreference" AS ENUM ('metric', 'imperial');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "dob" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "height_cm" DECIMAL(5,2) NOT NULL,
    "activity_level" DECIMAL(4,3) NOT NULL DEFAULT 1.200,
    "unit_preference" "UnitPreference" NOT NULL DEFAULT 'metric',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "target_weight_kg" DECIMAL(5,2) NOT NULL,
    "weekly_change_kg" DECIMAL(3,2) NOT NULL,
    "daily_calories" INTEGER NOT NULL,
    "protein_grams" INTEGER NOT NULL,
    "carbs_grams" INTEGER NOT NULL,
    "fat_grams" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "barcode" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "brand" VARCHAR(255),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "serving_size_amount" DECIMAL(8,2) NOT NULL,
    "serving_size_unit" VARCHAR(50) NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" DECIMAL(6,2) NOT NULL,
    "carbohydrates" DECIMAL(6,2) NOT NULL,
    "fat" DECIMAL(6,2) NOT NULL,
    "fiber" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "sugar" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "sodium_mg" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "micros_json" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "water_ml" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "daily_log_id" UUID NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "food_item_id" UUID NOT NULL,
    "servings_consumed" DECIMAL(6,2) NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_goals_user_id_is_active_idx" ON "user_goals"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "food_items_barcode_key" ON "food_items"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_user_id_log_date_key" ON "daily_logs"("user_id", "log_date");

-- CreateIndex
CREATE INDEX "meal_entries_daily_log_id_idx" ON "meal_entries"("daily_log_id");

-- AddForeignKey
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_entries" ADD CONSTRAINT "meal_entries_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Índices de búsqueda difusa (GIN + trigramas)
CREATE INDEX "idx_food_barcode" ON "food_items"("barcode");
CREATE INDEX "idx_food_name_trgm" ON "food_items" USING gin (name gin_trgm_ops);
CREATE INDEX "idx_food_brand_trgm" ON "food_items" USING gin (brand gin_trgm_ops);
