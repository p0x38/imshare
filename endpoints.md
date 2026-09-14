# API Endpoints

Current HTTP API specification for `imshare`. The API namespace is `/v1`.

## OpenAPI

The API specification is generated at runtime from the Fastify route schemas and exposed through `@fastify/swagger` / `@fastify/swagger-ui`:

- `GET /docs` — interactive Swagger UI.
- `GET /docs/json` — generated OpenAPI 3.1 JSON document.

Use `/docs` as the canonical interactive reference; this file remains a human-oriented overview of endpoint behavior and conventions.

## Conventions

Successful resources use `{ "data": ... }`; paginated collections include `pagination` with `page`, `limit`, `total`, and `totalPages`. Errors use `{ "error": { "code": "...", "message": "..." } }`.

Authentication uses the Better Auth session cookie. Roles are `user < moderator < admin`.

## Authentication

- `GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD /v1/auth/*` — Better Auth namespace.
- `POST /v1/auth/sign-up/email` — email/password registration; imshare additionally requires `registrationToken` and removes it before forwarding to Better Auth.
- `GET /v1/registration-token` — returns the current registration token and expiration; authenticated users only.

## Current User

- `GET /v1/me` — authenticated user's profile, email, profile links, post count, and avatar URL.
- `GET /v1/me/posts` — authenticated user's posts. Query: `page`, `limit`, `order`.
- `GET /v1/me/notifications` — authenticated user's notifications, newest first. Query: `page`, `limit`.
- `GET /v1/me/notifications/unread-count` — unread count.
- `PATCH /v1/me/notifications/{notificationId}/read` — mark one owned notification read.
- `POST /v1/me/notifications/read-all` — mark all owned notifications read.
- `POST /v1/me/links` — create profile link. HTTP(S) URL, label 1–100 chars, max 20 links.
- `PATCH /v1/me/links/{linkId}` — update owned profile link.
- `DELETE /v1/me/links/{linkId}` — delete owned profile link; `204`.

## Users

- `GET /v1/users` — paginated users. Query: `page`, `limit`, `search`, `order`.
- `POST /v1/users` — create user directly; authenticated.
- `GET /v1/users/{userId}` — public profile with profile fields, post count, links, and `avatarUrl`.
- `PATCH /v1/users/{userId}` — update own profile only. Fields: `name`, `image`, `bio`, `websiteUrl`, `githubUrl`, `avatarMode`, `avatarValue`, `profileBannerUrl`, `accentColor`.
- `DELETE /v1/users/{userId}` — delete own account; `204`.
- `GET /v1/users/{userId}/posts` — user's posts. Query: `page`, `limit`, `order`.
- `GET /v1/users/{userId}/links` — public profile links.
- `GET /v1/users/{userId}/avatar` — generated/custom/Gravatar avatar response or redirect.

## Posts

- `GET /v1/posts` — public paginated posts. Query: `page`, `limit`, `user`, `tag`, `category`, `search`, `order`. Search matches title, description, and caption.
- `POST /v1/posts` — create post; authenticated. Fields: `title` (1–500), `description` (≤10000), `caption` (≤10000), `sourceUrl` (≤4096), `originalCreator` (nullable, 1–500), `originalCreatedAt` (nullable ISO date-time), `allowDownload`, `tags` (≤100), `categoryId`, `uploadIds` (≤100). Uploads must be owned and unused.
- `GET /v1/posts/{postId}` — public post view.
- `PATCH /v1/posts/{postId}` — update own post; supports `originalCreator` and `originalCreatedAt` in addition to the regular post fields.
- `DELETE /v1/posts/{postId}` — delete own post; `204`.
- `GET /v1/posts/{postId}/tags` — public post tags.
- `POST /v1/posts/{postId}/tags` — add tag; owner only; body `{ "tagId": "..." }`; upserted.
- `DELETE /v1/posts/{postId}/tags/{tagId}` — remove tag; owner only; `204`.
- `GET /v1/posts/{postId}/category` — public category or `null`.
- `PUT /v1/posts/{postId}/category` — set category; owner only.
- `DELETE /v1/posts/{postId}/category` — clear category; owner only; `204`.

## Reactions

Post reaction types are `like`, `favorite`, and `save`.

- `GET /v1/posts/{postId}/reactions` — counts plus current user's active state when authenticated.
- `PUT /v1/posts/{postId}/{type}` — add reaction; authenticated.
- `DELETE /v1/posts/{postId}/{type}` — remove reaction; authenticated.

## Comments

- `GET /v1/posts/{postId}/comments` — paginated public comments, oldest first. Query: `page`, `limit`.
- `POST /v1/posts/{postId}/comments` — create comment; body `{ "body": "..." }`; 1–5000 chars.
- `PATCH /v1/comments/{commentId}` — edit own comment.
- `DELETE /v1/comments/{commentId}` — delete own comment or a comment on own post; `204`.
- `PUT /v1/comments/{commentId}/like` — like comment.
- `DELETE /v1/comments/{commentId}/like` — remove comment like.

## Reports

- `POST /v1/reports` — authenticated user reports exactly one post or comment. Reasons: `spam`, `copyright`, `harassment`, `illegal`, `sexual`, `violence`, `other`. Optional `details` ≤2000 chars. Duplicate open reports return `409 REPORT_EXISTS`.

## Tags

- `GET /v1/tags` — paginated public tags. Query: `page`, `limit`, `search`, `order`.
- `POST /v1/tags` — create tag; authenticated. Body requires `name` and slug matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `GET /v1/tags/{tagId}` — public tag and post count.
- `PATCH /v1/tags/{tagId}` — update tag; authenticated.
- `DELETE /v1/tags/{tagId}` — delete tag; `204`.
- `GET /v1/tags/{tagId}/posts` — paginated public posts for a tag.

## Categories

- `GET /v1/categories` — paginated public categories. Query: `page`, `limit`, `order`.
- `POST /v1/categories` — create category; authenticated. Body requires `name` and `slug`; `description` is optional.
- `GET /v1/categories/{categoryId}` — public category and post count.
- `PATCH /v1/categories/{categoryId}` — update category; authenticated.
- `DELETE /v1/categories/{categoryId}` — delete category; `204`.
- `GET /v1/categories/{categoryId}/posts` — paginated public posts for a category.

## Search & Recommendations

- `GET /v1/search` — searches posts, users, tags, and categories. Query: `q`, `type`, `user`, `tag`, `category`, `page`, `limit`, `order`.
- `GET /v1/recommendations` — paginated public post recommendations based on authenticated reaction preferences when available.

## Uploads & Images

- `POST /v1/uploads` — multipart image upload; supports JPG/JPEG, PNG, GIF, WebP, BMP, AVIF and optional multi-upload mode.
- `GET /v1/uploads/{uploadId}` — upload metadata for an owned upload.
- `DELETE /v1/uploads/{uploadId}` — delete an unused owned upload; attached uploads return `409`.
- `GET /v1/posts/image/{uploadId}` — public image delivery with optional resize and format conversion.
- `GET /v1/posts/image/{uploadId}/placeholder` — public ThumbHash PNG placeholder.

## Emojis

- `GET /v1/emojis` — public custom emoji list.
- `POST /v1/emojis` — create a custom emoji from an owned image URL.
- `DELETE /v1/emojis/{emojiId}` — delete an owned custom emoji; `204`.

## Administration

- `GET /v1/admin/overview` — moderation/admin overview counts.
- `GET /v1/admin/registration-token` — current registration token; admin only.
- `GET /v1/admin/users` — paginated moderation user list.
- `GET /v1/admin/reports` — paginated moderation reports.
- `PATCH /v1/admin/reports/{reportId}` — update report status.
- `POST /v1/admin/users/{userId}/kick` — revoke all active sessions for a user.
- `POST /v1/admin/users/{userId}/ban` — ban a user and revoke sessions.
- `POST /v1/admin/users/{userId}/unban` — remove a user ban.

## Health

- `GET /v1/health` — lightweight health check.
- `GET /v1/ready` — readiness check including database connectivity.
- `GET /v1/version` — API and application version information.
