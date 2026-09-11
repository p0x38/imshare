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

Generate Prisma and apply the development migrations:

```sh
pnpm prisma generate
pnpm prisma migrate dev
```

Start the development server:

```sh
pnpm dev
```

## Making changes

Keep changes focused and avoid unrelated refactors in the same commit or pull request.

When adding or changing an API endpoint:

1. Update the appropriate route in `src/routes/`.
2. Reuse the existing helpers in `src/lib/` for authentication, permissions, validation, pagination, and API responses.
3. Update `endpoints.md` and/or `public-endpoints.md` when the public API surface changes.
4. Add or update tests for the behavior.

When changing frontend behavior, prefer the existing shared components and styles under `public/` instead of duplicating navigation or UI logic across pages.

## Code style

The project uses TypeScript and ESLint. Keep code strongly typed and consistent with the existing structure.

Run formatting/lint-related checks through the repository's existing scripts rather than introducing a new formatter configuration for an individual change.

## Testing

Run the focused test suite while developing:

```sh
pnpm test
```

Run integration tests when the change affects application behavior or API/database integration:

```sh
pnpm test:integration
```

Run type checking and linting:

```sh
pnpm typecheck
pnpm lint
```

Before opening a pull request, run the complete check:

```sh
pnpm check
```

The complete check includes type checking, linting, tests, integration tests, and a production build. citeturn637file0

## Database changes

Use Prisma migrations for schema changes. Do not manually edit an existing migration that has already been applied or shared.

For a schema change during development:

```sh
pnpm prisma migrate dev --name describe-your-change
```

Review the generated migration before committing it.

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
