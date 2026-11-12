DROP INDEX IF EXISTS "upload_userId_contentHash_key";

ALTER TABLE "upload" ADD COLUMN "storageArea" TEXT NOT NULL DEFAULT 'uploads';

CREATE UNIQUE INDEX "upload_userId_contentHash_storageArea_key"
ON "upload"("userId", "contentHash", "storageArea");

CREATE INDEX "upload_storageArea_createdAt_idx"
ON "upload"("storageArea", "createdAt");
