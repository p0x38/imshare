ALTER TABLE "post" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "post" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "post" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "post" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "post" ADD COLUMN "hiddenAt" DATETIME;
ALTER TABLE "post" ADD COLUMN "contentWarning" TEXT;

CREATE INDEX "post_status_visibility_scheduledAt_idx"
    ON "post" ("status", "visibility", "scheduledAt");

CREATE TABLE "post_revision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "caption" TEXT,
    "sourceUrl" TEXT,
    "allowDownload" BOOLEAN NOT NULL,
    "categoryId" TEXT,
    "tagsJson" TEXT NOT NULL,
    "contentWarning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "post_revision_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_revision_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "post_revision_postId_createdAt_idx"
    ON "post_revision" ("postId", "createdAt");
CREATE INDEX "post_revision_createdById_createdAt_idx"
    ON "post_revision" ("createdById", "createdAt");
