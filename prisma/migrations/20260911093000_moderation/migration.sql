ALTER TABLE "user" ADD COLUMN "isBanned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN "bannedAt" DATETIME;
ALTER TABLE "user" ADD COLUMN "bannedUntil" DATETIME;

CREATE TABLE "moderation_log" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME,
  "actorId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  CONSTRAINT "moderation_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "moderation_log_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "moderation_log_createdAt_idx" ON "moderation_log"("createdAt");
CREATE INDEX "moderation_log_targetUserId_createdAt_idx" ON "moderation_log"("targetUserId", "createdAt");
