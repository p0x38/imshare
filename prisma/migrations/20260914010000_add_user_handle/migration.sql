ALTER TABLE "user" ADD COLUMN "handle" TEXT;

CREATE UNIQUE INDEX "user_handle_key" ON "user"("handle");
