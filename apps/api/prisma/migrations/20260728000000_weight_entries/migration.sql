-- CreateTable
CREATE TABLE "weight_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "logged_on" DATE NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "ema_kg" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weight_entries_user_id_logged_on_idx" ON "weight_entries"("user_id", "logged_on" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weight_entries_user_id_logged_on_key" ON "weight_entries"("user_id", "logged_on");

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

