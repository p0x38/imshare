ALTER TABLE "user" ADD COLUMN "showHandle" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "showFollowers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "showFollowings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "allowSearchEngineIndex" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "defaultCategoryId" TEXT;
ALTER TABLE "user" ADD COLUMN "defaultPostVisibility" TEXT NOT NULL DEFAULT 'public';
ALTER TABLE "user" ADD COLUMN "defaultAllowDownload" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN "defaultContentWarning" TEXT;

CREATE INDEX "user_defaultCategoryId_idx" ON "user"("defaultCategoryId");

CREATE TABLE "follow" (
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("followerId", "followingId")
);
CREATE INDEX "follow_followingId_createdAt_idx" ON "follow"("followingId", "createdAt");
CREATE INDEX "follow_followerId_createdAt_idx" ON "follow"("followerId", "createdAt");
