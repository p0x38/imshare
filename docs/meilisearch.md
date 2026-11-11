# Meilisearch

Meilisearch is an optional full-text search backend. When `MEILISEARCH_URL` and `MEILISEARCH_API_KEY` are unset, imshare continues to use SQLite FTS5.

Configure these server environment variables:

```dotenv
MEILISEARCH_URL="http://127.0.0.1:7700"
MEILISEARCH_API_KEY="your-server-side-index-key"
MEILISEARCH_INDEX_UID="imshare_posts"
```

Keep the API key on the server. It must permit searching, managing settings, and adding or deleting documents in the configured index. Use a dedicated index: `pnpm search:reindex` deletes all documents in that index before rebuilding it from imshare.

Run the reindex command after enabling Meilisearch, restoring a database, or recovering from an indexing failure. Until a full index is ready, searches continue using SQLite FTS5. Successful post changes are synchronized incrementally; search results are still filtered through Prisma visibility and privacy conditions. Only posts currently visible to the public are sent to Meilisearch.

If Meilisearch is unavailable, search falls back to SQLite FTS5 and post writes continue. The error is logged; run the reindex command after the service recovers if synchronization was interrupted.
