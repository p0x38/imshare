/*
  Warnings:

  - You are about to alter the column `isBanned` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `isPublic` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `showEmail` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `showPosts` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.
  - You are about to alter the column `showProfile` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "new_comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_comment" ("body", "createdAt", "id", "postId", "updatedAt", "userId") SELECT "body", "createdAt", "id", "postId", "updatedAt", "userId" FROM "comment";
DROP TABLE "comment";
ALTER TABLE "new_comment" RENAME TO "comment";
CREATE INDEX "comment_postId_createdAt_idx" ON "comment"("postId", "createdAt");
CREATE INDEX "comment_userId_createdAt_idx" ON "comment"("userId", "createdAt");
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "bio" TEXT,
    "websiteUrl" TEXT,
    "githubUrl" TEXT,
    "avatarMode" TEXT NOT NULL DEFAULT 'initials',
    "avatarValue" TEXT,
    "profileBannerUrl" TEXT,
    "accentColor" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "showPosts" BOOLEAN NOT NULL DEFAULT true,
    "showProfile" BOOLEAN NOT NULL DEFAULT true,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "bannedAt" DATETIME,
    "bannedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_user" ("accentColor", "avatarMode", "avatarValue", "banReason", "bannedAt", "bannedUntil", "bio", "createdAt", "email", "emailVerified", "githubUrl", "id", "image", "isBanned", "isPublic", "name", "profileBannerUrl", "role", "showEmail", "showPosts", "showProfile", "updatedAt", "websiteUrl") SELECT "accentColor", "avatarMode", "avatarValue", "banReason", "bannedAt", "bannedUntil", "bio", "createdAt", "email", "emailVerified", "githubUrl", "id", "image", "isBanned", "isPublic", "name", "profileBannerUrl", "role", "showEmail", "showPosts", "showProfile", "updatedAt", "websiteUrl" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
