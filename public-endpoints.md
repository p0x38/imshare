# Public Endpoints

Current browser-facing routes implemented by `imshare`.

Public HTML pages are served from `public/`. They consume the `/v1` API where application data is needed. They do not access Prisma or SQLite directly.

## Public Pages

### `GET /`

Homepage / recent artwork view.

### `GET /posts/`

Public post archive.

### `GET /posts/{postId}`

Public post page.

### `GET /users/`

Public user directory.

### `GET /users/{userId}`

Public user profile.

### `GET /users/{userId}/posts`

Public post listing for a user.

### `GET /tags/`

Public tag directory.

### `GET /tags/{tagId}`

Public tag page.

### `GET /tags/{tagId}/posts`

Public posts associated with a tag.

### `GET /categories/`

Public category directory.

### `GET /categories/{categoryId}`

Public category page.

### `GET /categories/{categoryId}/posts`

Public posts associated with a category.

### `GET /search/`

Public search interface. Search data comes from `GET /v1/search`.

### `GET /about/`

About page.

### `GET /faq/`

FAQ page.

### `GET /github/`

Project/GitHub information page.

### `GET /privacy/`

Privacy policy page.

### `GET /terms/`

Terms of service page.

## Account Pages

### `GET /account/`

Authenticated account overview. The page uses the current session and `/v1/me` data.

### `GET /account/login/`

Email/password login page. Authentication is performed through Better Auth at `/v1/auth/*`.

### `GET /account/register/`

Registration page. Registration uses `POST /v1/auth/sign-up/email` and requires the current registration access token.

### `GET /account/logout/`

Logs the current user out through `POST /v1/auth/sign-out` and redirects to `/`.

### `GET /account/profile/`

Authenticated profile editing page.

### `GET /notifications/`

Authenticated notification interface using the `/v1/me/notifications*` API.

## Dashboard Pages

Dashboard routes are authenticated management interfaces.

### `GET /dashboard/`

Dashboard overview.

### `GET /dashboard/posts/`

Current user's post management page.

### `GET /dashboard/posts/new/`

New-post creation page.

### `GET /dashboard/posts/{postId}/`

Management view for a post.

### `GET /dashboard/posts/{postId}/edit/`

Post editing page.

### `GET /dashboard/tags/`

Tag management page.

### `GET /dashboard/categories/`

Category management page.

### `GET /dashboard/settings/`

Authenticated application/account settings page.

## Image URLs Used by Public Pages

Public post images are served through:

`GET /v1/posts/image/{uploadId}`

The image endpoint supports resizing, fitting, format conversion, and optional downloads. See [`endpoints.md`](./endpoints.md).

User avatars are served through:

`GET /v1/users/{userId}/avatar`

## SEO / Crawler Endpoints

### `GET /sitemap.xml`

Generated XML sitemap containing static public pages plus public users, posts, tags, and categories. Post entries include Google image-sitemap entries for attached uploads.

### `GET /robots.txt`

Generated crawler policy with a link to `/sitemap.xml`. Current disallowed paths are `/v1/`, `/dashboard/`, `/account/`, and `/admin/`.

## Post Gallery Layout

Post-listing pages use the shared `.post-grid` gallery style. The desktop layout is 8 columns, changing to 6 columns at narrower desktop/tablet widths and progressively fewer columns on small screens.

The same gallery styling is intended for public post collections rather than maintaining separate grid implementations per page.

## Public vs Authenticated

The public archive pages can be viewed without a session. Account and dashboard pages require authentication at the application/API layer.

A public page may still call an authenticated API endpoint when rendering account-specific controls or personalized data; the server remains authoritative for authorization.
