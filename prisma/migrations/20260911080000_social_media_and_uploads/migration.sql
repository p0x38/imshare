ALTER TABLE "user" ADD COLUMN "profileBannerUrl" TEXT;
ALTER TABLE "user" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "upload" ADD COLUMN "contentHash" TEXT;

CREATE TABLE "comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "body" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "comment_postId_createdAt_idx" ON "comment"("postId", "createdAt");
CREATE INDEX "comment_userId_createdAt_idx" ON "comment"("userId", "createdAt");

CREATE TABLE "notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" DATETIME,
  "actorId" TEXT,
  "recipientId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "reactionType" TEXT,
  CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "notification_recipientId_readAt_createdAt_idx" ON "notification"("recipientId", "readAt", "createdAt");
CREATE INDEX "notification_postId_idx" ON "notification"("postId");

CREATE INDEX "upload_userId_contentHash_idx" ON "upload"("userId", "contentHash");
