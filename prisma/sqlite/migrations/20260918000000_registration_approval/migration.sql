-- Add registration approval state. Existing accounts remain approved.
ALTER TABLE "user" ADD COLUMN "registrationStatus" TEXT NOT NULL DEFAULT 'approved';

CREATE INDEX "user_registrationStatus_createdAt_idx" ON "user"("registrationStatus", "createdAt");
