CREATE TABLE "post_view" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_view_postId_fkey"
        FOREIGN KEY ("postId") REFERENCES "post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "post_view_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "post_view_postId_viewedAt_idx"
    ON "post_view" ("postId", "viewedAt");
CREATE INDEX "post_view_userId_viewedAt_idx"
    ON "post_view" ("userId", "viewedAt");
