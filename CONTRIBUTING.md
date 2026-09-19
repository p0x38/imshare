# Contributing to imshare

Thanks for contributing to imshare!

## Before you start

Read the project README and the relevant documentation before making changes. In particular, check `endpoints.md` and `public-endpoints.md` when working on API routes.

For larger changes, open an issue first so the intended behavior and implementation can be discussed before significant work is done.

## Development setup

Requirements:

- Node.js 24.x
- pnpm 11.x
- SQLite

Install dependencies and create the local environment:

```sh
pnpm install
cp .env.example .env
```

Replace the example `BETTER_AUTH_SECRET` with a strong random value. The development database is configured as a local SQLite database by default. fileciteturn680file0

Generate Prisma Client and apply development migrations:

```sh
pnpm db:generate
pnpm db:migrate
```

Start the Fastify development server:

```sh
pnpm dev
```

When working specifically on the React/MUI client, use the separate Vite client server:

```sh
pnpm dev:client
```

For a production-style client build without rebuilding the server:

```sh
pnpm build:client
```

## Making changes

Keep changes focused and avoid unrelated refactors in the same commit or pull request.

When adding or changing an API endpoint:

1. Update the appropriate route in `src/routes/`.
2. Reuse the existing helpers in `src/lib/` for authentication, permissions, validation, pagination, and API responses.
3. Update `endpoints.md` and/or `public-endpoints.md` when the public API surface changes.
4. Add or update tests for the behavior.

When changing frontend behavior, prefer the existing React/MUI shared components under `src/client/components/` and the existing client utilities under `src/client/lib/`. Keep page-specific entry points under `src/client/entries/` rather than duplicating shared UI logic.

## Code style

The project uses TypeScript, ESLint, and Prettier. Keep code strongly typed and consistent with the existing structure.

Run formatting and lint-related checks through the repository's existing scripts:

```sh
pnpm format
pnpm format:check
pnpm lint
```

Do not introduce a new formatter configuration for an individual change.

## Testing

Run the Vitest suite while developing:

```sh
pnpm test
```

For a continuously running test process:

```sh
pnpm test:watch
```

For coverage:

```sh
pnpm test:coverage
```

Run integration tests when the change affects application behavior or API/database integration:

```sh
pnpm test:integration
```

For browser/UI behavior, use Playwright:

```sh
pnpm test:browser
pnpm test:browser:headed
pnpm test:browser:ui
```

These browser commands build the client before running Playwright.

Run TypeScript checks:

```sh
pnpm typecheck
```

Run linting:

```sh
pnpm lint
```

Run the complete check before opening a pull request:

```sh
pnpm check
```

The complete check includes type checking, linting, Vitest tests, integration tests, Playwright browser tests, and a production build.

The equivalent VS Code tasks are available in `.vscode/tasks.json` with the `imshare:` prefix. Test-related VS Code tasks regenerate Prisma Client before running. citeturn637file0

## Database changes

Use Prisma migrations for schema changes. Do not manually edit an existing migration that has already been applied or shared.

For a schema change during development:

```sh
pnpm db:migrate --name describe-your-change
```

You can also invoke Prisma directly when you need Prisma-specific options:

```sh
pnpm prisma migrate dev --name describe-your-change
```

Review the generated migration before committing it.

For a deployed database, apply committed migrations only:

```sh
pnpm prisma migrate deploy
```

Do not use `migrate dev` against a production database.

## Pull requests

A good pull request should:

- Explain what changed and why.
- Keep the scope focused.
- Include tests for new or changed behavior.
- Mention any database migration or configuration changes.
- Update API documentation when applicable.
- Confirm that `pnpm check` passes.

Use a clear, concise title such as:

```text
feat: add image report moderation
fix: prevent duplicate post reactions
docs: update endpoint reference
```

## Commits

Prefer small, logically separated commits. Use conventional commit-style prefixes where practical:

- `feat:` — new functionality
- `fix:` — bug fix
- `docs:` — documentation
- `refactor:` — code restructuring without behavior changes
- `test:` — tests
- `chore:` — maintenance/tooling

## Security issues

Do not publicly post sensitive security vulnerabilities, credentials, authentication secrets, or private user data in an issue. Report security-sensitive problems privately to the project maintainer instead.
