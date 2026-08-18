/*
  Warnings:

  - You are about to drop the `suscripciones_push` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "suscripciones_push" DROP CONSTRAINT "suscripciones_push_organizacion_id_fkey";

-- DropForeignKey
ALTER TABLE "suscripciones_push" DROP CONSTRAINT "suscripciones_push_usuario_id_fkey";

-- DropTable
DROP TABLE "suscripciones_push";
