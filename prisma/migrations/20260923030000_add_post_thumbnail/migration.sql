ALTER TABLE "post" ADD COLUMN "thumbnail_upload_id" TEXT;

CREATE INDEX "post_thumbnail_upload_id_idx" ON "post"("thumbnail_upload_id");

ALTER TABLE "post_revision" ADD COLUMN "thumbnail_upload_id" TEXT;
