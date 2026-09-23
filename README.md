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

The repository declares Node.js `>=24` and uses pnpm `11.25.0`. The current application version is `1.4.2`.

## Setup

Install dependencies:

```sh
pnpm install
```

Create the environment file from `.env.example` and set a strong `BETTER_AUTH_SECRET`.

```sh
cp .env.example .env
```

The example environment file configures a local SQLite database at `file:./dev.db` and expects `BETTER_AUTH_SECRET` to be replaced with a long random secret.

Generate the Prisma client and create/apply the development database schema:

```sh
pnpm prisma generate
pnpm prisma migrate dev
```

### Local administration

imshare can expose the normal authenticated administration dashboard through a
loopback-only HTTP proxy. It is enabled by default at `http://127.0.0.1:5107`
and forwards to the configured server port.

The local admin listener is intentionally restricted to `127.0.0.1`; it is not
intended to be exposed through a network interface. The same administrator
authentication and authorization checks are used as on the main server.

The **Instance settings** page includes a raw `config.imshare` editor. The
configuration is parsed and validated before it replaces the file. Changes to
startup-time settings require restarting imshare.

### Configuration

imshare uses its own native configuration DSL in `config.imshare`. Copy `config.sample.imshare` and edit it for your deployment.

```sh
cp config.sample.imshare config.imshare
```

The DSL uses simple blocks and assignments:

```text
server {
    host = "0.0.0.0"
    port = 5454
}

storage {
    dataDirectory = "data"
    uploadDirectory = "data/uploads"
    avatarDirectory = "data/avatars"
    maxFileSize = 25MiB

    cache {
        ttl = 30d
        useHashedDirectory = true
    }
}

features {
    imagePosts = true
    textPosts = true
    comments = true
}
```

Comments use `#` or `//`. Strings may use single or double quotes. Arrays use `[value, value]`. Size literals support `B`, `KB`, `MB`, `GB`, `KiB`, `MiB`, and `GiB`; duration literals support `ms`, `s`, `m`, `h`, and `d` and are stored internally as milliseconds.

The parser is intentionally small and format-specific to imshare, while the application itself consumes the typed `ServerConfig` model. Configuration is validated after parsing, so unknown or malformed values cannot silently become application settings.

Existing JSON/YAML/TOML configuration files are no longer the runtime configuration format. Move the values from an older configuration into `config.imshare` before starting the server.

## Development

The repository provides separate commands for the server, frontend client, checks, tests, database work, and maintenance tasks.

Start the development server with file watching:

```sh
pnpm dev
```

Start the Vite client development server separately:

```sh
pnpm dev:client
```

Build only the browser client:

```sh
pnpm build:client
```

Use this when changing React/MUI client code and you do not need the server TypeScript build.

Build the complete production application:

```sh
pnpm build
```

This generates Prisma Client, builds the client with `pnpm build:client`, and compiles the server.

Start the compiled production server:

```sh
pnpm start
```

### Development commands

Use the repository scripts instead of invoking the underlying tools directly:

| Task | Command | Purpose |
| --- | --- | --- |
| Install dependencies | `pnpm install` | Install the locked dependency set |
| Start server | `pnpm dev` | Run the Fastify server with file watching |
| Start client | `pnpm dev:client` | Run the Vite client development server |
| Generate Prisma Client | `pnpm db:generate` | Regenerate Prisma Client after schema changes |
| Apply development migrations | `pnpm db:migrate` | Create/apply Prisma development migrations |
| Validate Prisma schema | `pnpm db:validate` | Validate the Prisma schema and configuration |
| Build client | `pnpm build:client` | Type-check and bundle the React/Vite client |
| Build application | `pnpm build` | Generate Prisma Client, build client, and compile server |
| Start production build | `pnpm start` | Start the compiled server |
| Export OpenAPI | `pnpm openapi:export` | Generate the OpenAPI specification |
| Migrate uploads | `pnpm migrate:uploads` | Run the upload migration utility |
| Migrate cache | `pnpm migrate:cache` | Run the cache migration utility |
| Service unavailable page | `pnpm serve:unavailable` | Serve the maintenance/unavailable response |

For a deployed database, apply committed migrations with:

```sh
pnpm prisma migrate deploy
```

Do not use `pnpm db:migrate` for production database deployment.

## Checks and tests

Run formatting:

```sh
pnpm format
```

Check formatting without changing files:

```sh
pnpm format:check
```

Run TypeScript checks:

```sh
pnpm typecheck
```

Run ESLint:

```sh
pnpm lint
```

Run the Vitest suite:

```sh
pnpm test
```

Run Vitest in watch mode:

```sh
pnpm test:watch
```

Run Vitest with V8 coverage:

```sh
pnpm test:coverage
```

Run the application integration tests:

```sh
pnpm test:integration
```

Run Playwright browser tests:

```sh
pnpm test:browser
```

Run Playwright browser tests with a visible browser:

```sh
pnpm test:browser:headed
```

Open the Playwright UI runner:

```sh
pnpm test:browser:ui
```

The Playwright commands build the client before starting the browser tests.

Run the complete project check before submitting changes:

```sh
pnpm check
```

`pnpm check` runs type checking, linting, Vitest tests, integration tests, Playwright browser tests, and the production build.

VS Code exposes the same repository commands through `.vscode/tasks.json`, with tasks prefixed by `imshare:`. The test and coverage Tasks regenerate Prisma Client before running.

## API

The API is versioned under `/v1`. The repository keeps endpoint documentation in:

- `endpoints.md` — full endpoint reference
- `public-endpoints.md` — publicly accessible endpoints

The API includes a public version endpoint at `GET /v1/version`, which returns the configured API version and site version.

## Observability

Server observability is optional and disabled by default. Configure it entirely in `config.imshare`. The observability configuration supports separate traces, metrics, and logs signals, OTLP gRPC or HTTP/protobuf transports, trace sampling, batching, Prometheus scraping, service/environment/instance identity, and trace-context correlation for logs.

For a setup similar to a local OpenTelemetry Collector plus Loki:

```text
observability {
    enabled = true

    serviceName = "imshare"
    serviceVersion = "1.0.0"
    environment = "production"
    instanceId = "main"

    batch {
        exportIntervalMs = 15000
        maxExportBatchSize = 512
        maxQueueSize = 2048
    }

    traces {
        enabled = true
        endpoint = "127.0.0.1:4317"
        protocol = "grpc"
        samplingRatio = 1.0
    }

    metrics {
        enabled = true

        prometheus {
            enabled = true
            path = "/metrics"
        }

        otlp {
            enabled = true
            endpoint = "127.0.0.1:4319"
            protocol = "grpc"
        }
    }

    logs {
        enabled = true
        includeTraceContext = true

        otlp {
            enabled = true
            endpoint = "http://127.0.0.1:3100/otlp/v1/logs"
            protocol = "http/protobuf"
        }
    }
}
```

The Prometheus endpoint is served by the existing Fastify server at the configured path. HTTP requests are traced with OpenTelemetry HTTP instrumentation, Pino logs are bridged to the OpenTelemetry Logs SDK, and logs can carry the active trace and span IDs for correlation. Loki 3.x recommends its native OTLP endpoint for OpenTelemetry logs. Keep the metrics endpoint behind a trusted network boundary or reverse-proxy authentication if it should not be public.

The admin **Analytics** page provides first-party aggregates from the existing database, including post views, signed-in unique viewers, new users/posts, comments, reactions, uploads, daily view trends, and most-viewed posts. Anonymous visitors are not treated as unique viewers.

## Administration

Administration is role-based:

- `user` — normal account permissions
- `moderator` — moderation/admin overview and moderation operations
- `admin` — moderator permissions plus administrator-only actions

The backend enforces these permissions on admin endpoints. The frontend can expose administrative navigation based on the current user's role without replacing those server-side checks. The role hierarchy and enforcement helpers live in `src/lib/permissions.ts` and `src/lib/api.ts`.

## Project structure

```text
src/
  client/     React/MUI frontend entries and shared components
  lib/        shared configuration, auth, API, permission helpers, and utilities
  routes/     Fastify API and page route modules
public/       static assets and service-worker resources
prisma/       Prisma schema and migrations
test/         Vitest and Playwright tests
docs/         additional project documentation
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow, testing expectations, and pull request guidance.

## License

This repository currently declares the `ISC` license in `package.json`.
