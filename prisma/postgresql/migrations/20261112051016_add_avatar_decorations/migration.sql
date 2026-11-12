-- AlterTable
ALTER TABLE "user" ADD COLUMN     "equipped_avatar_decoration_id" TEXT;

-- CreateTable
CREATE TABLE "avatar_decoration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatar_decoration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_avatar_decoration" (
    "user_id" TEXT NOT NULL,
    "decoration_id" TEXT NOT NULL,
    "obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settings_json" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "user_avatar_decoration_pkey" PRIMARY KEY ("user_id","decoration_id")
);

-- CreateIndex
CREATE INDEX "user_avatar_decoration_decoration_id_idx" ON "user_avatar_decoration"("decoration_id");

-- AddForeignKey
ALTER TABLE "user_avatar_decoration" ADD CONSTRAINT "user_avatar_decoration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_avatar_decoration" ADD CONSTRAINT "user_avatar_decoration_decoration_id_fkey" FOREIGN KEY ("decoration_id") REFERENCES "avatar_decoration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
