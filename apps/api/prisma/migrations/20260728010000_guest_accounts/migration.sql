-- Las cuentas de invitado no tienen credenciales: se identifican solo por el
-- token. email y password_hash pasan a ser opcionales y se llenan cuando el
-- invitado vincula la cuenta.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;
