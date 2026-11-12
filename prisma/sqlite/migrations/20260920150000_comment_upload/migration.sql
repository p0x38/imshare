ALTER TABLE "comment" ADD COLUMN "uploadId" TEXT;

CREATE UNIQUE INDEX "comment_uploadId_key"
    ON "comment" ("uploadId");
