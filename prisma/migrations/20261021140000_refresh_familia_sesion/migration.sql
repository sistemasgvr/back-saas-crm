BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE "tokens_refresco" ADD COLUMN "familia_id" UUID;
CREATE INDEX "tokens_refresco_familia_id_idx" ON "tokens_refresco"("familia_id");
COMMIT;
