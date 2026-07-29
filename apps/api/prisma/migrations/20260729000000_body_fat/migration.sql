-- El registro ya aceptaba body_fat_pct y lo usaba para calcular el BMR por
-- Katch-McArdle, pero no lo guardaba en ningún lado. En el primer recálculo de
-- objetivo (al pesarse o al editar el perfil) el dato ya no estaba y el cálculo
-- caía a Mifflin-St Jeor, moviéndole las calorías al usuario sin aviso.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "body_fat_pct" DECIMAL(4,1);
