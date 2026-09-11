CREATE VIRTUAL TABLE "post_search" USING fts5 (
    "postId" UNINDEXED,
    "title",
    "description",
    "caption",
    tokenize = 'unicode61'
);

INSERT INTO "post_search" ("postId", "title", "description", "caption")
SELECT "id", "title", COALESCE("description", ''), COALESCE("caption", '')
FROM "post";

CREATE TRIGGER "post_search_ai" AFTER INSERT ON "post"
BEGIN
    INSERT INTO "post_search" ("postId", "title", "description", "caption")
    VALUES (new."id", new."title", COALESCE(new."description", ''), COALESCE(new."caption", ''));
END;

CREATE TRIGGER "post_search_ad" AFTER DELETE ON "post"
BEGIN
    DELETE FROM "post_search" WHERE "postId" = old."id";
END;

CREATE TRIGGER "post_search_au" AFTER UPDATE OF "title", "description", "caption" ON "post"
BEGIN
    DELETE FROM "post_search" WHERE "postId" = old."id";
    INSERT INTO "post_search" ("postId", "title", "description", "caption")
    VALUES (new."id", new."title", COALESCE(new."description", ''), COALESCE(new."caption", ''));
END;
