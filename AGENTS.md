# AGENTS.md

This file is guidance for coding agents working on `p0x38/imshare`.

## Project overview

`imshare` is a self-hosted image archive and sharing server.

The backend is TypeScript on Fastify. Data access uses Prisma with SQLite. Authentication uses Better Auth. The frontend is a static HTML/CSS/JavaScript application served by the backend, with shared navigation injected by `public/components.js`.

Current package metadata:

- Node.js: `>=24`
- pnpm: `11.25.0`
- TypeScript: `7.x`
- Fastify: `5.x`
- Prisma: `7.10.0`
- Better Auth: `1.7.x`
- SQLite database

The current application version is `1.0.0` in `package.json` and `config.json`.

## Repository layout

```text
.
├── public/                 # Static frontend pages and browser-side scripts
│   ├── components.js       # Shared header/footer injection
│   ├── admin/              # Administrative UI
│   └── dashboard/          # Authenticated user dashboard
├── src/
│   ├── lib/                # Auth, API helpers, config, permissions, shared logic
│   └── routes/             # Fastify API route modules
├── prisma/                 # Prisma schema and migrations
├── test/                   # Automated/integration tests
├── docs/                   # Additional documentation
├── endpoints.md            # Full endpoint reference
├── public-endpoints.md     # Public endpoint reference
├── TODO.md                 # Project TODO list
├── README.md               # Human-facing project documentation
└── CONTRIBUTING.md         # Contributor workflow
```

## Architecture

API routes are composed in `src/routes/api.ts`. Each feature generally has its own route module under `src/routes/`.

Common request/authentication helpers are in `src/lib/api.ts`:

- `getSession()` resolves the Better Auth session and rejects currently banned users.
- `requireUser()` enforces authentication.
- `requireRole()` enforces the role hierarchy.
- `ok()` wraps normal API responses as `{ data }`.
- `collection()` creates paginated collection responses.

Role definitions are centralized in `src/lib/permissions.ts`:

```text
user < moderator < admin
```

`hasRole()` compares roles by this hierarchy. Do not duplicate role-ranking logic in individual routes.

The `/v1/admin/*` API is protected server-side. The frontend must never be treated as the security boundary.

## Authentication and permissions

`GET /v1/me` is the canonical frontend endpoint for the authenticated user's profile. It currently includes the user's `role` as well as normal profile data.

For UI features that depend on permissions, prefer fetching `/v1/me` and checking the returned role rather than inventing a second permission API.

Administrative access currently begins at the `moderator` role. Administrator-only operations may require `admin` specifically; use the existing backend route checks as the source of truth.

When adding a new protected API endpoint, use `requireUser()` or `requireRole()` instead of checking cookies/sessions manually.

When adding a UI link to a protected feature:

1. Hide it from users without the necessary role.
2. Keep the actual endpoint protected server-side.
3. Do not assume that hiding a link provides authorization.

## Frontend conventions

Most pages are static HTML under `public/` and load shared browser behavior from `/components.js`.

`public/components.js` currently replaces existing `<header>`/`<footer>` elements with the shared site header/footer. Keep shared navigation changes there rather than editing the same navigation markup on every page.

Be aware that `components.js` runs in the browser. It can fetch `/v1/me` and `/v1/version`, but it cannot use server-only imports or Prisma directly.

When changing shared navigation:

- Preserve the existing dashboard/non-dashboard distinction.
- Keep links accessible to unauthenticated users unless the destination itself requires authentication.
- Use the current user's role for administrative navigation.
- Keep the footer useful on every page.

## Versioning

The configured site version lives in `config.json` under `site.version`.

The API exposes it through:

```text
GET /v1/version
```

The route is implemented in `src/routes/health.ts` and returns the configured version. Do not hardcode a second version number in frontend code when the API can provide it.

`package.json` also contains the project package version. When changing application versioning, check whether both values should move together before editing one independently.

## API conventions

API paths are versioned under `/v1`.

Use the helpers in `src/lib/api.ts` for authentication and common response shapes.

Prefer small route modules over putting unrelated endpoints into a single file.

Use existing Prisma relations and selects where possible. Do not rename or invent relations based on API terminology. For example, the Prisma `Post` model relation is `user`; the API may expose that data as an author concept at its response boundary.

Keep user-visible API errors structured like:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message."
  }
}
```

## Metadata and HTML responses

The server modifies HTML responses in `src/app.ts` to provide dynamic page metadata.

When changing metadata generation:

- Escape attribute values before inserting them into HTML.
- Do not emit optional metadata when there is no value.
- Avoid duplicate `description`, Open Graph, canonical, or similar tags when a page already provides them.
- Post metadata should come from the post record and related user/tags/upload data rather than generic fallback values when the post exists.

## Configuration and secrets

Runtime configuration is stored in `config.json`.

Environment variables are documented in `.env.example`.

Never commit real authentication secrets, database credentials, or production-only environment values.

Do not expose private user information through public API selects or metadata.

## Database / Prisma

Prisma schema changes belong under `prisma/` and should be accompanied by an appropriate migration when the database structure changes.

After schema changes, regenerate the Prisma client before type checking/building.

Useful commands:

```sh
pnpm prisma generate
pnpm prisma validate
pnpm prisma migrate dev
```

Do not hand-edit generated Prisma client output.

## Commands

Development:

```sh
pnpm dev
```

Production build/start:

```sh
pnpm build
pnpm start
```

Checks:

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm check
```

`pnpm check` is the preferred full validation command before submitting a non-trivial change.

## Testing expectations

When changing behavior, add or update tests in `test/` when practical.

At minimum, run the narrowest relevant checks while iterating and run `pnpm check` before considering the change complete when the environment permits it.

For authentication/authorization changes, test both allowed and denied roles. In particular, check that unauthorized requests cannot access the protected API even if a user manually navigates to the URL.

## Coding style

Follow the existing TypeScript style rather than introducing a new formatting or architecture convention.

Prefer clear, strongly typed code and existing shared helpers.

Avoid unnecessary dependencies for small frontend behavior; the frontend is intentionally lightweight.

Avoid broad refactors while implementing unrelated features.

Do not silently swallow meaningful errors. Existing code may intentionally have narrow fallbacks, but new code should preserve enough context to debug failures.

## Documentation

Keep these files aligned when relevant:

- `README.md` for project setup and user-facing overview
- `CONTRIBUTING.md` for contributor workflow
- `AGENTS.md` for coding-agent guidance
- `endpoints.md` for the complete API reference
- `public-endpoints.md` for the public subset
- `TODO.md` for planned work

When an endpoint changes, update the relevant endpoint documentation instead of leaving stale route descriptions behind.

## Git workflow

Use focused commits. Avoid mixing unrelated fixes, formatting-only changes, dependency churn, or generated-file updates into a feature commit unless they are required by that feature.

### Conventional Commits

Commit messages should follow the Conventional Commits shape:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Use these common types:

- `feat:` — introduce new user-facing or developer-facing functionality
- `fix:` — correct a behavior or bug
- `docs:` — documentation-only changes
- `refactor:` — restructure code without changing intended behavior
- `test:` — add or change tests without changing production behavior
- `chore:` — maintenance/tooling/dependency work
- `perf:` — performance improvement
- `build:` — build system or dependency/build configuration changes
- `ci:` — CI/CD configuration changes
- `revert:` — revert a previous commit

Use a scope when it adds useful context, for example:

```text
feat(admin): add moderator dashboard navigation
fix(metadata): avoid duplicate Open Graph tags
test(auth): cover moderator role checks
chore(deps): update fastify
```

Keep the subject concise and imperative-style. Do not end the subject with a period.

Use `BREAKING CHANGE:` in the footer for breaking changes, or use the `!` form when appropriate:

```text
feat(api)!: change post response shape
```

Do not use a breaking-change marker for a normal internal refactor.

### Commit boundaries

Prefer one logical change per commit. For example, a feature that requires implementation, tests, and documentation may reasonably contain all three when they are part of the same behavior change; unrelated cleanup should be separate.

Do not create meaningless commits solely to record intermediate thinking.

Avoid rewriting public/shared history unless explicitly requested.

Before committing, inspect the diff and make sure no secrets, local database files, build output, generated artifacts, or unrelated edits are included.

### Branches and pull requests

Use descriptive branch names, preferably based on the change, for example:

```text
feat/admin-navigation
fix/dynamic-metadata
chore/docs-agent-guidance
```

Open a pull request when the change benefits from review or when working collaboratively. The PR description should explain what changed, why it changed, relevant testing, and any migration/configuration implications.

### GitHub API note

When modifying repository files through GitHub's API, first fetch the current file and use its current blob SHA for an update. Do not update a file using a stale SHA.

Prefer atomic, reviewable changes. When multiple related files must change, make the smallest coherent set of file updates necessary.

## Important pitfalls

- The frontend cannot enforce security; backend authorization is mandatory.
- `moderator` and `admin` are different roles even though both can access parts of `/v1/admin/*`.
- The Prisma `Post` relation is `user`, not `author`.
- `/v1/me` requires authentication; public pages should handle a `401` response gracefully.
- `/v1/version` is the existing source for the runtime-configured site version.
- `public/components.js` is shared across pages, so changes there can affect nearly the whole site.
- `config.json` contains deployment-specific values such as the public auth base URL; avoid casually changing them while working on unrelated features.
- `pnpm check` includes integration tests and a build, so a change that looks frontend-only can still expose type/build issues.

## Working principle

Understand the existing implementation first, reuse existing helpers, make the smallest correct change, and validate the behavior end-to-end where possible.
