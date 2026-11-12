ALTER TABLE "post" ADD COLUMN "permalinkPattern" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "post" ADD COLUMN "permalinkIdType" TEXT NOT NULL DEFAULT 'internalId';
ALTER TABLE "post" ADD COLUMN "permalinkKey" TEXT;
ALTER TABLE "post" ADD COLUMN "customPostId" TEXT;

CREATE UNIQUE INDEX "post_permalinkKey_key" ON "post"("permalinkKey");
CREATE INDEX "post_userId_permalinkKey_idx" ON "post"("userId", "permalinkKey");
