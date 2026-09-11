ALTER TABLE "upload" ADD COLUMN "contentHash" TEXT;

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
CREATE UNIQUE INDEX "upload_userId_contentHash_key" ON "upload"("userId", "contentHash");
