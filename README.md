# imshare

Self-hosted image archive and sharing server built with TypeScript, Fastify, Prisma, SQLite, Better Auth, and a small static frontend.

## Features

- Image uploads and serving with generated thumbnails/metadata
- Posts with descriptions, captions, tags, categories, reactions, comments, and reports
- User accounts with profiles and profile links
- Authentication with Better Auth
- Moderator/admin tools for users, reports, moderation logs, and registration tokens
- Search, recommendations, notifications, and public metadata/sitemap endpoints
- Shared site navigation and footer components

## Requirements

- Node.js 24.x
- pnpm 11.x
- SQLite

The repository declares Node.js `>=24` and uses pnpm `11.25.0`. The current application version is `1.0.0`. citeturn637file0

## Setup

Install dependencies:

```sh
pnpm install
```

Create the environment file from `.env.example` and set a strong `BETTER_AUTH_SECRET`.

```sh
cp .env.example .env
```

The example environment file configures a local SQLite database at `file:./dev.db` and expects `BETTER_AUTH_SECRET` to be replaced with a long random secret. citeturn680file0

Generate the Prisma client and create/apply the development database schema:

```sh
pnpm prisma generate
pnpm prisma migrate dev
```

Configure `config.json` for the server, storage directory, site name/version, and public authentication base URL. The checked-in example listens on `0.0.0.0:5454`, stores uploads under `uploads`, allows files up to 25 MiB, and uses `https://uhm.p0x38.mydns.jp` as its auth base URL. citeturn679file0

## Development

Start the development server with file watching:

```sh
pnpm dev
```

Build the application:

```sh
pnpm build
```

Start the compiled server:

```sh
pnpm start
```

## Checks and tests

Run type checking:

```sh
pnpm typecheck
```

Run linting:

```sh
pnpm lint
```

Run the automated tests:

```sh
pnpm test
```

Run the integration tests:

```sh
pnpm test:integration
```

Run the complete project check before submitting changes:

```sh
pnpm check
```

`pnpm check` currently runs type checking, linting, unit/API tests, integration tests, and a production build. citeturn637file0

## API

The API is versioned under `/v1`. The repository keeps endpoint documentation in:

- `endpoints.md` — full endpoint reference
- `public-endpoints.md` — publicly accessible endpoints

The API includes a public version endpoint at `GET /v1/version`, which returns the configured API version and site version. fileciteturn646file0

## Administration

Administration is role-based:

- `user` — normal account permissions
- `moderator` — moderation/admin overview and moderation operations
- `admin` — moderator permissions plus administrator-only actions

The backend enforces these permissions on admin endpoints. The frontend can expose administrative navigation based on the current user's role without replacing those server-side checks. The role hierarchy and enforcement helpers live in `src/lib/permissions.ts` and `src/lib/api.ts`. fileciteturn643file0 fileciteturn656file0

## Project structure

```text
src/
  lib/        shared configuration, auth, API, and permission helpers
  routes/     API route modules
public/       static frontend pages and shared components
prisma/       Prisma schema and migrations
test/         automated and integration tests
docs/         additional project documentation
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, testing expectations, and pull request guidance.

## License

This repository currently declares the `ISC` license in `package.json`. citeturn637file0
