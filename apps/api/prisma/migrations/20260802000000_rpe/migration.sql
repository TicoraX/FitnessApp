-- Esfuerzo percibido (RPE), escala de 1 a 10 en pasos de 0.5. Nulo para todo lo
-- ya registrado: no se puede reconstruir cuánto costó una serie de la semana
-- pasada, y un default inventado ensuciaría el historial.
ALTER TABLE "strength_entries" ADD COLUMN "rpe" DECIMAL(3,1);
ALTER TABLE "routine_items" ADD COLUMN "rpe" DECIMAL(3,1);

-- Los mismos límites que valida el DTO. El paso de 0.5 también: un RPE de 7.3
-- no significa nada, la escala no tiene esa resolución.
ALTER TABLE "strength_entries" ADD CONSTRAINT "strength_entries_rpe_chk"
  CHECK ("rpe" IS NULL OR ("rpe" >= 1 AND "rpe" <= 10 AND ("rpe" * 2) = FLOOR("rpe" * 2)));
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_rpe_chk"
  CHECK ("rpe" IS NULL OR ("rpe" >= 1 AND "rpe" <= 10 AND ("rpe" * 2) = FLOOR("rpe" * 2)));
