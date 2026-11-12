
-- Add equipped decoration to existing users.
ALTER TABLE "user"
ADD COLUMN "equipped_avatar_decoration_id" TEXT;

-- Create the decoration catalog.
CREATE TABLE "avatar_decoration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "event_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create user decoration ownership.
CREATE TABLE "user_avatar_decoration" (
    "user_id" TEXT NOT NULL,
    "decoration_id" TEXT NOT NULL,
    "obtained_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settings_json" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "user_avatar_decoration_pkey"
        PRIMARY KEY ("user_id", "decoration_id"),

    CONSTRAINT "user_avatar_decoration_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "user" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT "user_avatar_decoration_decoration_id_fkey"
        FOREIGN KEY ("decoration_id")
        REFERENCES "avatar_decoration" ("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX "user_avatar_decoration_decoration_id_idx"
ON "user_avatar_decoration" ("decoration_id");
