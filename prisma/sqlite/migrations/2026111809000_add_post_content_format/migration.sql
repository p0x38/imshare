ALTER TABLE "post"
ADD COLUMN "contentFormat" TEXT NOT NULL DEFAULT 'plain';

ALTER TABLE "post_revision"
ADD COLUMN "textContent" TEXT;

ALTER TABLE "post_revision"
ADD COLUMN "contentFormat" TEXT NOT NULL DEFAULT 'plain';