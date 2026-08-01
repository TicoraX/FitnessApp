-- CreateTable
CREATE TABLE "strength_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "daily_log_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight_kg" DECIMAL(5,1),
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strength_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "strength_entries_daily_log_id_idx" ON "strength_entries"("daily_log_id");

-- AddForeignKey
ALTER TABLE "strength_entries" ADD CONSTRAINT "strength_entries_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mismos límites que valida el DTO, garantizados aunque el dato entre por otro lado.
ALTER TABLE "strength_entries" ADD CONSTRAINT "strength_entries_sets_chk" CHECK ("sets" > 0 AND "sets" <= 50);
ALTER TABLE "strength_entries" ADD CONSTRAINT "strength_entries_reps_chk" CHECK ("reps" > 0 AND "reps" <= 500);
ALTER TABLE "strength_entries" ADD CONSTRAINT "strength_entries_weight_chk" CHECK ("weight_kg" IS NULL OR ("weight_kg" >= 0 AND "weight_kg" <= 999));
