ALTER TABLE "post"
RENAME COLUMN "thumbnail_upload_id" TO "thumbnailUploadId";

DROP INDEX IF EXISTS "post_thumbnail_upload_id_idx";

CREATE INDEX "post_thumbnailUploadId_idx"
ON "post"("thumbnailUploadId");

ALTER TABLE "post_revision"
RENAME COLUMN "thumbnail_upload_id" TO "thumbnailUploadId";