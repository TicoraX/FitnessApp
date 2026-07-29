-- Recuperación de contraseña.
--
-- Se guarda el sha256 del token y nunca el token: si alguien lee esta tabla no
-- puede entrar a ninguna cuenta. El UNIQUE sobre el hash sirve de dos cosas, de
-- índice de búsqueda y de garantía de que no se repita.

CREATE TABLE "password_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sube con cada cambio de contraseña y viaja dentro del token. Sin esto,
-- resetear la contraseña no echa al que te robo la cuenta: su token sigue
-- sirviendo hasta que venza, que son dias.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
