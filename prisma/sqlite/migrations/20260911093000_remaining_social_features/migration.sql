ALTER TABLE "post" ADD COLUMN "caption" TEXT;
ALTER TABLE "post" ADD COLUMN "allowDownload" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "upload" ADD COLUMN "thumbhash" TEXT;

CREATE TABLE "comment_reaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'like',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  CONSTRAINT "comment_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_reaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "comment_reaction_userId_commentId_type_key" ON "comment_reaction"("userId", "commentId", "type");
CREATE INDEX "comment_reaction_commentId_type_idx" ON "comment_reaction"("commentId", "type");

CREATE TABLE "report" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reporterId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  CONSTRAINT "report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "report_status_createdAt_idx" ON "report"("status", "createdAt");
CREATE INDEX "report_postId_idx" ON "report"("postId");
CREATE INDEX "report_commentId_idx" ON "report"("commentId");

CREATE TABLE "emoji" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creatorId" TEXT NOT NULL,
  CONSTRAINT "emoji_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "emoji_name_key" ON "emoji"("name");
CREATE INDEX "emoji_creatorId_createdAt_idx" ON "emoji"("creatorId", "createdAt");
