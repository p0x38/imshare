# API

## Authentication

### `* /v1/auth/*`

Better Auth endpoint namespace.

Handles authentication, sessions, account creation, login, logout, and other Better Auth operations.

The application should not implement password/session logic separately from Better Auth.

#### `GET /v1/auth/get-session`

Returns the currently authenticated session.

**Authentication:** Optional

**Response:**

```json
{
  "session": {
    "id": "...",
    "expiresAt": "..."
  },
  "user": {
    "id": "...",
    "name": "...",
    "email": "..."
  }
}
```

Returns `null`/an unauthenticated response when no valid session exists.

---

#### `POST /v1/auth/sign-in/email`

Authenticates a user using email and password.

**Authentication:** Public

**Request:**

```json
{
  "email": "user@example.com",
  "password": "..."
}
```

Creates a Better Auth session and sets the appropriate authentication cookie.

---

#### `POST /v1/auth/sign-up/email`

Creates a new user account.

**Authentication:** Public

**Request:**

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "..."
}
```

Creates the User and associated credential Account.

---

#### `POST /v1/auth/sign-out`

Terminates the current session.

**Authentication:** Required

Invalidates the current Better Auth session and clears the authentication cookie.

## Current User

### `GET /v1/me`

Returns information about the currently authenticated user.

**Authentication:** Required

**Response:**

```json
{
  "data": {
    "id": "...",
    "name": "...",
    "email": "...",
    "image": "..."
  }
}
```

---

### `GET /v1/me/posts`

Returns posts owned by the currently authenticated user.

**Authentication:** Required

**Query parameters:**

* `page` — Page number
* `limit` — Number of posts per page
* `sort` — Sort field
* `order` — `asc` or `desc`

**Response:**

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 0,
    "totalPages": 0
  }
}
```

# Users

### `GET /v1/users`

Returns a paginated list of users.

**Authentication:** Public

**Query parameters:**

* `page`
* `limit`
* `search`
* `sort`
* `order`

---

### `POST /v1/users`

Creates a user.

**Authentication:** Restricted

Normal account registration should use Better Auth instead.

This endpoint should only exist if administrative/user-management functionality requires direct user creation.

---

### `GET /v1/users/{userId}`

Returns a public user profile.

**Authentication:** Public

**Path parameters:**

* `userId` — User ID or supported public identifier

**Response includes:**

* User information
* Public artwork/post count
* Creation date
* Other public profile metadata

Private account information such as password credentials must never be returned.

---

### `PATCH /v1/users/{userId}`

Updates a user's profile.

**Authentication:** Required

The authenticated user may modify their own profile.

Administrative users may modify other users if administration functionality is implemented.

**Request example:**

```json
{
  "name": "New Name",
  "image": "/uploads/avatar.webp"
}
```

---

### `DELETE /v1/users/{userId}`

Deletes a user account.

**Authentication:** Required

Normally restricted to the account owner or administrator.

Associated private data should be handled according to the application's deletion policy.

---

### `GET /v1/users/{userId}/posts`

Returns posts belonging to a specific user.

**Authentication:** Public

Supports pagination and sorting.

# Posts

## `GET /v1/posts`

Returns a paginated collection of posts.

**Authentication:** Public

**Query parameters:**

* `page`
* `limit`
* `user`
* `tag`
* `category`
* `search`
* `sort`
* `order`

**Example:**

```text
/v1/posts?page=1&limit=24&tag=landscape
```

---

## `POST /v1/posts`

Creates a new post.

**Authentication:** Required

A post represents the logical published artwork entry.

A post may reference one or more uploaded files.

**Request example:**

```json
{
  "title": "Example Artwork",
  "description": "An example post.",
  "sourceUrl": "https://example.com/source",
  "tags": ["digital-art", "landscape"],
  "categoryId": "..."
}
```

**Response:** `201 Created`

Returns the newly created post.

---

## `GET /v1/posts/{postId}`

Returns a single post.

**Authentication:** Public

Returns:

* Post metadata
* Author
* Images/uploads
* Tags
* Category
* Creation/update timestamps

---

## `PATCH /v1/posts/{postId}`

Updates an existing post.

**Authentication:** Required

The post owner or administrator may modify it.

---

## `DELETE /v1/posts/{postId}`

Deletes a post.

**Authentication:** Required

Deletes the post and handles its associated relationships/uploads according to the application's deletion policy.

## Post Tags

### `GET /v1/posts/{postId}/tags`

Returns all tags assigned to a post.

**Authentication:** Public

---

### `POST /v1/posts/{postId}/tags`

Adds a tag to a post.

**Authentication:** Required

**Request:**

```json
{
  "tagId": "..."
}
```

If the relationship already exists, the endpoint should return an appropriate conflict response or remain idempotent according to the API policy.

---

### `DELETE /v1/posts/{postId}/tags/{tagId}`

Removes a tag from a post.

**Authentication:** Required

## Post Category

### `GET /v1/posts/{postId}/category`

Returns the category assigned to a post.

**Authentication:** Public

---

### `PUT /v1/posts/{postId}/category`

Assigns or replaces the post's category.

**Authentication:** Required

**Request:**

```json
{
  "categoryId": "..."
}
```

---

### `DELETE /v1/posts/{postId}/category`

Removes the category from a post.

**Authentication:** Required

# Tags

### `GET /v1/tags`

Returns available tags.

**Authentication:** Public

**Query parameters:**

* `page`
* `limit`
* `search`
* `sort`
* `order`

---

### `POST /v1/tags`

Creates a tag.

**Authentication:** Required

**Request:**

```json
{
  "name": "landscape",
  "slug": "landscape"
}
```

---

### `GET /v1/tags/{tagId}`

Returns information about a tag.

**Authentication:** Public

Includes basic metadata and post count.

---

### `PATCH /v1/tags/{tagId}`

Updates a tag.

**Authentication:** Required

---

### `DELETE /v1/tags/{tagId}`

Deletes a tag.

**Authentication:** Required

The API must define whether deleting a tag also removes its post relationships.

Recommended behavior: remove the relationships while leaving posts intact.

---

### `GET /v1/tags/{tagId}/posts`

Returns posts associated with a tag.

**Authentication:** Public

Supports pagination and sorting.

# Categories

### `GET /v1/categories`

Returns all categories.

**Authentication:** Public

---

### `POST /v1/categories`

Creates a category.

**Authentication:** Required

**Request:**

```json
{
  "name": "Illustration",
  "slug": "illustration",
  "description": "Illustration artwork."
}
```

---

### `GET /v1/categories/{categoryId}`

Returns a category and its metadata.

**Authentication:** Public

---

### `PATCH /v1/categories/{categoryId}`

Updates a category.

**Authentication:** Required

---

### `DELETE /v1/categories/{categoryId}`

Deletes a category.

**Authentication:** Required

Recommended behavior is to remove the category from associated posts rather than deleting the posts.

---

### `GET /v1/categories/{categoryId}/posts`

Returns posts belonging to a category.

**Authentication:** Public

Supports pagination and sorting.

# Search

### `GET /v1/search`

Searches across the archive.

**Authentication:** Public

**Query parameters:**

* `q` — Search query
* `type` — `posts`, `users`, `tags`, `categories`, or `all`
* `user`
* `tag`
* `category`
* `page`
* `limit`
* `sort`
* `order`

**Example:**

```text
/v1/search?q=landscape&type=posts
```

**Response:**

```json
{
  "data": {
    "posts": [],
    "users": [],
    "tags": [],
    "categories": []
  },
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 0,
    "totalPages": 0
  }
}
```

# Uploads

### `POST /v1/uploads`

Uploads an image/file to the archive.

**Authentication:** Required

**Content-Type:**

`multipart/form-data`

The upload system should validate:

* File type
* File size
* File extension
* Actual file content
* Filename
* Storage path

Uploads should be separate from posts so that an uploaded asset can exist before being attached to a post.

---

### `GET /v1/uploads/{uploadId}`

Returns upload metadata.

**Authentication:** Required or public depending on asset visibility.

Does not need to expose internal filesystem paths.

---

### `DELETE /v1/uploads/{uploadId}`

Deletes an uploaded asset.

**Authentication:** Required

The server should prevent deletion of assets still referenced by posts unless the operation explicitly supports cascading cleanup.

# System

### `GET /v1/health`

Health-check endpoint.

**Authentication:** Public

**Response:**

```json
{
  "status": "ok"
}
```

Should be lightweight and suitable for monitoring/reverse-proxy health checks.

---

### `GET /v1/version`

Returns API/server version information.

**Authentication:** Public

**Response example:**

```json
{
  "data": {
    "api": "v1",
    "version": "1.0.0"
  }
}
```

#=== Public ===#

Public website pages.

These routes return HTML rather than JSON and should use the same API internally where possible.

## Home

### `GET /`

Main archive homepage.

Should provide:

* Featured/recent posts
* Search
* Navigation
* Categories
* Popular/recent tags
* Login/account controls

## Posts

### `GET /posts/`

Post archive/index.

Supports:

* Pagination
* Search/filtering
* Tag filtering
* Category filtering
* Sorting

---

### `GET /posts/{postId}`

Displays a single public post.

Should show:

* Artwork
* Title
* Description
* Author
* Tags
* Category
* Source URL
* Creation date
* Related posts

## Users

### `GET /users/`

User directory.

Displays public users and basic profile information.

---

### `GET /users/{userId}`

Public user profile.

Displays:

* Profile information
* User's posts
* Statistics

---

### `GET /users/{userId}/posts`

Displays posts belonging to the specified user.

## Tags

### `GET /tags/`

Tag directory.

Should support searching/sorting tags.

---

### `GET /tags/{tagId}`

Displays information about a tag.

---

### `GET /tags/{tagId}/posts`

Displays all public posts associated with a tag.

## Categories

### `GET /categories/`

Category directory.

---

### `GET /categories/{categoryId}`

Displays category information.

---

### `GET /categories/{categoryId}/posts`

Displays posts in the category.

## Search

### `GET /search/`

Search interface.

The page should provide a UI for `/v1/search` and display results across posts, users, tags, and categories.

#=== Account ===#

## `GET /account/`

Account overview.

For authenticated users, displays:

* Profile information
* Account settings
* Dashboard link
* Logout option

Unauthenticated users should be redirected to login.

---

## `GET /account/login/`

Login page.

Uses Better Auth email/password authentication through the API.

---

## `GET /account/register/`

Registration page.

Creates accounts through Better Auth.

---

## `GET /account/logout/`

Logs the user out and redirects to an appropriate public page.

The actual session invalidation should be performed through Better Auth rather than merely deleting frontend state.

#=== Dashboard ===#

Authenticated management interface.

## `GET /dashboard/`

Dashboard overview.

Displays:

* Post count
* Upload count
* Recent posts
* Recent uploads
* Tag/category information
* Quick actions

## Posts

### `GET /dashboard/posts/`

Management interface for the user's posts.

Provides:

* Post listing
* Search/filtering
* Edit actions
* Delete actions
* Create-post action

---

### `GET /dashboard/posts/new/`

Create-post interface.

Allows the user to:

* Upload artwork
* Enter metadata
* Assign tags
* Select category
* Set source URL
* Publish the post

---

### `GET /dashboard/posts/{postId}/`

Dashboard view of a specific post.

Provides management-oriented information and actions.

---

### `GET /dashboard/posts/{postId}/edit/`

Edit interface for an existing post.

## Tags

### `GET /dashboard/tags/`

Tag management interface.

Allows authorized users to:

* Create tags
* Rename tags
* Change slugs
* Delete tags
* View usage

## Categories

### `GET /dashboard/categories/`

Category management interface.

Allows authorized users to:

* Create categories
* Edit categories
* Delete categories
* View post counts

## Settings

### `GET /dashboard/settings/`

Dashboard/account settings.

Potential settings include:

* Display name
* Avatar
* Account preferences
* Privacy
* API-related settings

#=== Other ===#

## `GET /about/`

About page describing the archive/project.

---

## `GET /privacy/`

Privacy policy.

---

## `GET /terms/`

Terms of service.

# API Conventions

## Response Format

Successful single-resource responses should use:

```json
{
  "data": {}
}
```

Collection responses should use:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 120,
    "totalPages": 5
  }
}
```

## Error Format

All API errors should use a consistent structure:

```json
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Post not found."
  }
}
```

## HTTP Status Codes

| Status | Meaning                                  |
| -----: | ---------------------------------------- |
|  `200` | Successful request                       |
|  `201` | Resource created                         |
|  `204` | Successful request with no response body |
|  `400` | Invalid request                          |
|  `401` | Authentication required                  |
|  `403` | Insufficient permissions                 |
|  `404` | Resource not found                       |
|  `409` | Resource conflict                        |
|  `413` | Upload/request too large                 |
|  `422` | Validation failed                        |
|  `429` | Rate limit exceeded                      |
|  `500` | Internal server error                    |

# Data Model

The API should treat a **Post** as the main public artwork entity.

Recommended relationship:

```text
User
 └──< Post
       ├──< Upload
       ├──< PostTag >── Tag
       └──── Category
```

Tags should be relational rather than stored as a comma-separated string.

Users, tags, and categories should preferably have stable IDs and public slugs where human-readable URLs are desirable.

Uploads should be separate from posts so that one post can contain multiple images/files and uploaded assets can be managed independently.
