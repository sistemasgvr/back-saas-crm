-- AlterTable
ALTER TABLE "meta_conexiones" ADD COLUMN     "app_id" VARCHAR(64),
ADD COLUMN     "app_secret_cifrado" TEXT,
ALTER COLUMN "meta_user_id" DROP NOT NULL,
ALTER COLUMN "token_cifrado" DROP NOT NULL;
