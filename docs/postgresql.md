# PostgreSQL

SQLite remains the default. PostgreSQL support uses a separate Prisma schema and migration history. Set the same provider when generating Prisma Client, running the application, and applying migrations so the generated client matches the database adapter.

Changing `DATABASE_PROVIDER` does not copy or migrate data between SQLite and PostgreSQL. Each provider has a separate database and migration history.

Create a PostgreSQL role and an empty database using your database administrator tools. imshare does not create database users or databases. Keep the password in the server's environment, not in source control.

Set these server environment variables:

```dotenv
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?schema=public"
```

Then generate the PostgreSQL Prisma Client and apply the committed PostgreSQL migrations:

```sh
pnpm db:generate
pnpm db:deploy
```

The SQLite schema and migration history are unchanged. PostgreSQL migrations live under `prisma/postgresql/migrations`. Full-text search uses Meilisearch when configured; without it, PostgreSQL uses a case-insensitive Prisma search rather than SQLite FTS5.

Validation has only been performed against the Prisma schema and generated migration. A live PostgreSQL server, role, and database are required to verify migrations and application queries end-to-end.
