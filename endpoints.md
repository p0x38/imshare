# API Endpoints

Current HTTP API specification for `imshare`. The API namespace is `/v1`.

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
- `POST /v1/posts` — create post; authenticated. Fields: `title` (1–500), `description` (≤10000), `caption` (≤10000), `sourceUrl` (≤4096), `allowDownload`, `tags` (≤100), `categoryId`, `uploadIds` (≤100). Uploads must be owned and unused.
- `GET /v1/posts/{postId}` — public post view.
- `PATCH /v1/posts/{postId}` — update own post.
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
- `DELETE /v1/tags/{tagId}` — delete tag; authenticated; `204`.
- `GET /v1/tags/{tagId}/posts` — public posts for tag. Query: `page`, `limit`, `order`.

## Categories

- `GET /v1/categories` — paginated public categories. Query: `page`, `limit`, `order`.
- `POST /v1/categories` — create category; authenticated. Body requires `name` and `slug`; optional `description`.
- `GET /v1/categories/{categoryId}` — public category and post count.
- `PATCH /v1/categories/{categoryId}` — update category; authenticated.
- `DELETE /v1/categories/{categoryId}` — delete category; authenticated; `204`.
- `GET /v1/categories/{categoryId}/posts` — public category posts. Query: `page`, `limit`, `order`.

## Search

`GET /v1/search` is public. Query: `q`, `type`, `user`, `tag`, `category`, `page`, `limit`, `order`. `type` is `all`, `posts`, `users`, `tags`, or `categories`. Specific types return paginated collections; `all` returns arrays for each resource type plus combined pagination metadata.

## Uploads

- `POST /v1/uploads` — authenticated multipart image upload. Supported types: JPG/JPEG, PNG, GIF, WebP, BMP, AVIF. Validates extension, MIME type, signature, and configured size. `?multiple=true` permits up to 20 files. Returns upload object(s) containing `/v1/posts/image/{uploadId}` URLs.
- `GET /v1/uploads/{uploadId}` — own upload metadata; authenticated owner only.
- `DELETE /v1/uploads/{uploadId}` — delete own unused upload; `204`. Attached uploads return `409 UPLOAD_IN_USE`.

## Image Delivery

- `GET /v1/posts/image/{uploadId}` — public image delivery. Query: `width`, `height` (16–4096), `fit` (`cover|contain|fill|inside|outside`), `format` (`webp|jpeg|jpg|png|avif`), `download=true`. Default fit is `inside`. Transforms are cached. Downloads respect post `allowDownload`.
- `GET /v1/posts/image/{uploadId}/placeholder` — public ThumbHash PNG placeholder.

## Emojis

- `GET /v1/emojis` — public custom emoji list.
- `POST /v1/emojis` — authenticated custom emoji creation using an owned imshare image URL. Name: 1–32 lowercase letters/numbers/`_`/`+`/`-`.
- `DELETE /v1/emojis/{emojiId}` — delete own emoji; `204`.

## Recommendations

- `GET /v1/recommendations` — public paginated recommendations. Query: `page`, `limit`. Authenticated sessions use reacted post tags/categories as preferences and exclude the user's own posts.

## Moderation / Administration

- `GET /v1/admin/overview` — moderator/admin summary counts.
- `GET /v1/admin/registration-token` — admin-only registration token.
- `GET /v1/admin/users` — moderator/admin user list. Query: `page`, `limit`, `search`, `role`, `banned`; limit 1–100, default 50.
- `GET /v1/admin/reports` — moderator/admin reports. Query: `status` (`open|resolved|dismissed`, default `open`), `page`, `limit`.
- `PATCH /v1/admin/reports/{reportId}` — change report status.
- `POST /v1/admin/users/{userId}/kick` — revoke target sessions; moderator/admin.
- `POST /v1/admin/users/{userId}/ban` — ban target and revoke sessions. Body: `reason` (1–500), optional `durationHours` (0–8760; 0 is indefinite).
- `POST /v1/admin/users/{userId}/unban` — remove ban.
- `PATCH /v1/admin/users/{userId}/role` — admin-only role change. Roles: `user|moderator|admin`; cannot self-change or demote the last admin.
- `GET /v1/admin/logs` — moderator/admin latest 100 moderation logs.

## System

- `GET /v1/health` — public lightweight health response `{ "status": "ok" }`.
- `GET /v1/version` — public `{ "data": { "api": "v1", "version": "..." } }`.

## Metadata / Crawlers

These are root-level rather than `/v1`:

- `GET /sitemap.xml` — XML sitemap for static pages, public users/posts/tags/categories, with image-sitemap entries for post uploads.
- `GET /robots.txt` — crawler directives and sitemap location.

## Realtime

Socket.IO supplements the HTTP API for transient upload-status and post-reaction updates. HTTP endpoints remain authoritative for durable state.
