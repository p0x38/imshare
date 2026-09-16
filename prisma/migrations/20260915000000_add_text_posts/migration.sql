ALTER TABLE "post" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "post" ADD COLUMN "textContent" TEXT;
CREATE INDEX "post_contentType_createdAt_idx" ON "post"("contentType", "createdAt");
