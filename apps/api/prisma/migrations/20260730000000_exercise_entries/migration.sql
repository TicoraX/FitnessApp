-- CreateTable
CREATE TABLE "exercise_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "daily_log_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "calories_burned" INTEGER NOT NULL,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_entries_daily_log_id_idx" ON "exercise_entries"("daily_log_id");

-- AddForeignKey
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_daily_log_id_fkey" FOREIGN KEY ("daily_log_id") REFERENCES "daily_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una sesión de cero minutos o de calorías negativas no existe; el DTO ya lo
-- valida, esto lo garantiza aunque el dato entre por otro lado.
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_duration_chk" CHECK ("duration_min" > 0 AND "duration_min" <= 1440);
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_calories_chk" CHECK ("calories_burned" >= 0);
