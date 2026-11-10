ALTER TABLE "user"
ADD COLUMN "allowAiCrawler" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "user"
ADD COLUMN "allowImageCrawler" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "user"
ADD COLUMN "allowCustomCrawler" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "post"
ADD COLUMN "allowSearchEngineIndex" BOOLEAN;

ALTER TABLE "post"
ADD COLUMN "allowAiCrawler" BOOLEAN;

ALTER TABLE "post"
ADD COLUMN "allowImageCrawler" BOOLEAN;

ALTER TABLE "post"
ADD COLUMN "allowCustomCrawler" BOOLEAN;

ALTER TABLE "post_revision"
ADD COLUMN "allowSearchEngineIndex" BOOLEAN;

ALTER TABLE "post_revision"
ADD COLUMN "allowAiCrawler" BOOLEAN;

ALTER TABLE "post_revision"
ADD COLUMN "allowImageCrawler" BOOLEAN;

ALTER TABLE "post_revision"
ADD COLUMN "allowCustomCrawler" BOOLEAN;
