UPDATE "post"
SET "permalinkKey" = "id"
WHERE "permalinkKey" IS NULL
  AND "permalinkIdType" = 'internalId';
