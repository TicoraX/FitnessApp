-- Una fila cargada desde una rutina nace pendiente. Lo que ya existe se cargó a
-- mano, así que el default de true deja el historial como estaba.
ALTER TABLE "strength_entries" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "routines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- Dos rutinas con el mismo nombre no se distinguen en una lista.
CREATE UNIQUE INDEX "routines_user_id_name_key" ON "routines"("user_id", "name");

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "routine_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "routine_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight_kg" DECIMAL(5,1),
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routine_items_routine_id_idx" ON "routine_items"("routine_id");

-- AddForeignKey
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los mismos límites que valida el DTO.
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_sets_chk" CHECK ("sets" > 0 AND "sets" <= 50);
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_reps_chk" CHECK ("reps" > 0 AND "reps" <= 500);
ALTER TABLE "routine_items" ADD CONSTRAINT "routine_items_weight_chk" CHECK ("weight_kg" IS NULL OR ("weight_kg" >= 0 AND "weight_kg" <= 999));
