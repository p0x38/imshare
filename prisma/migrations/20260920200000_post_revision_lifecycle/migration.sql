ALTER TABLE "post_revision" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "post_revision" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "post_revision" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "post_revision" ADD COLUMN "publishedAt" DATETIME;
