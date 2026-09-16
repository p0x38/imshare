ALTER TABLE "user" ADD COLUMN "followApprovalRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "follow" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

CREATE INDEX "follow_followingId_status_createdAt_idx" ON "follow"("followingId", "status", "createdAt");
CREATE INDEX "follow_followerId_status_createdAt_idx" ON "follow"("followerId", "status", "createdAt");
