ALTER TABLE "user" ADD COLUMN "avatarMode" TEXT NOT NULL DEFAULT 'initials';
ALTER TABLE "user" ADD COLUMN "avatarValue" TEXT;

CREATE TABLE "post_reaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  CONSTRAINT "post_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "post_reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "post_reaction_userId_postId_type_key" ON "post_reaction"("userId", "postId", "type");
CREATE INDEX "post_reaction_postId_type_idx" ON "post_reaction"("postId", "type");
CREATE INDEX "post_reaction_userId_type_idx" ON "post_reaction"("userId", "type");

CREATE TABLE "profile_link" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "profile_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "profile_link_userId_position_idx" ON "profile_link"("userId", "position");
