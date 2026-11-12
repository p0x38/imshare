ALTER TABLE "user" ADD COLUMN "interestedTagsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "user" ADD COLUMN "interestedCategoryIdsJson" TEXT NOT NULL DEFAULT '[]';
