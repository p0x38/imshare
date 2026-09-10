# Public

The public website is the browser-facing interface for viewing the art archive.

Public pages should generally be accessible without authentication and should consume the `/v1/*` API rather than accessing the database directly.

---

## Home

### `GET /`

Main landing page for the archive.

**Authentication:** Public

**Purpose:**

Provides an overview of the archive and acts as the primary navigation entry point.

**Content:**

* Recently published posts
* Featured posts
* Popular tags
* Categories
* Search interface
* User/account navigation
* Login/register links for unauthenticated users
* Dashboard link for authenticated users

**Data sources:**

* `GET /v1/posts`
* `GET /v1/tags`
* `GET /v1/categories`
* `GET /v1/me` when authenticated

---

# Posts

## `GET /posts/`

Post archive.

**Authentication:** Public

Displays a paginated collection of public posts.

**Features:**

* Pagination
* Search
* Tag filtering
* Category filtering
* Author filtering
* Sorting
* Grid/list display
* Thumbnail previews

**Query parameters:**

| Parameter  | Type        | Required | Description              |
| ---------- | ----------- | -------: | ------------------------ |
| `page`     | integer     |       No | Page number              |
| `limit`    | integer     |       No | Number of posts per page |
| `q`        | string      |       No | Search query             |
| `user`     | string      |       No | Filter by user           |
| `tag`      | string      |       No | Filter by tag            |
| `category` | string      |       No | Filter by category       |
| `sort`     | string      |       No | Sort field               |
| `order`    | `asc\|desc` |       No | Sort direction           |

**API source:**

`GET /v1/posts`

---

## `GET /posts/{postId}`

Displays a single public post.

**Authentication:** Public

**Path parameters:**

| Parameter | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `postId`  | string | ID or public identifier of the post |

**Content:**

* Artwork/image
* Post title
* Description
* Author
* Tags
* Category
* Source URL
* Creation date
* Updated date
* Related posts
* Navigation to the author's profile

**Actions:**

* Open source URL
* Open author
* Open tag
* Open category
* Navigate to related posts

**API source:**

`GET /v1/posts/{postId}`

# Users

## `GET /users/`

User directory.

**Authentication:** Public

Displays users who have publicly visible profiles.

**Features:**

* User search
* Pagination
* Sorting
* Post count
* Profile thumbnails/avatars

**Query parameters:**

| Parameter | Type        | Required | Description      |
| --------- | ----------- | -------: | ---------------- |
| `q`       | string      |       No | Search users     |
| `page`    | integer     |       No | Page number      |
| `limit`   | integer     |       No | Results per page |
| `sort`    | string      |       No | Sort field       |
| `order`   | `asc\|desc` |       No | Sort direction   |

**API source:**

`GET /v1/users`

---

## `GET /users/{userId}`

Public user profile.

**Authentication:** Public

**Content:**

* Username/display name
* Avatar
* Profile information
* Account creation date
* Post count
* Recent posts
* Link to complete post archive

**Actions:**

* View user's posts
* Open individual posts
* Filter user's posts

**API sources:**

* `GET /v1/users/{userId}`
* `GET /v1/users/{userId}/posts`

---

## `GET /users/{userId}/posts`

Displays all public posts belonging to a user.

**Authentication:** Public

**Features:**

* Pagination
* Sorting
* Tag filtering
* Category filtering

**API source:**

`GET /v1/users/{userId}/posts`

# Tags

## `GET /tags/`

Tag directory.

**Authentication:** Public

Displays all available public tags.

**Features:**

* Tag search
* Alphabetical sorting
* Popularity/post-count sorting
* Post count

**Query parameters:**

| Parameter | Type        | Required | Description      |
| --------- | ----------- | -------: | ---------------- |
| `q`       | string      |       No | Search tags      |
| `page`    | integer     |       No | Page number      |
| `limit`   | integer     |       No | Results per page |
| `sort`    | string      |       No | Sort field       |
| `order`   | `asc\|desc` |       No | Sort direction   |

**API source:**

`GET /v1/tags`

---

## `GET /tags/{tagId}`

Displays a tag's information.

**Authentication:** Public

**Content:**

* Tag name
* Tag slug
* Description, if supported
* Number of associated posts
* Recent posts

**Actions:**

* View all posts using the tag
* Open individual posts

**API source:**

`GET /v1/tags/{tagId}`

---

## `GET /tags/{tagId}/posts`

Displays all public posts associated with a tag.

**Authentication:** Public

**Features:**

* Pagination
* Sorting
* Post grid
* Search within tag results

**API source:**

`GET /v1/tags/{tagId}/posts`

# Categories

## `GET /categories/`

Category directory.

**Authentication:** Public

Displays all public categories.

**Content:**

* Category name
* Description
* Post count
* Recent posts

**API source:**

`GET /v1/categories`

---

## `GET /categories/{categoryId}`

Displays a category.

**Authentication:** Public

**Content:**

* Category name
* Slug
* Description
* Number of posts
* Recent posts

**API source:**

`GET /v1/categories/{categoryId}`

---

## `GET /categories/{categoryId}/posts`

Displays all posts belonging to a category.

**Authentication:** Public

**Features:**

* Pagination
* Sorting
* Post grid
* Tag filtering

**API source:**

`GET /v1/categories/{categoryId}/posts`

# Search

## `GET /search/`

Global search interface.

**Authentication:** Public

Provides a user-facing interface to the search API.

**Search targets:**

* Posts
* Users
* Tags
* Categories

**Query parameters:**

| Parameter | Type    | Required | Description      |
| --------- | ------- | -------: | ---------------- |
| `q`       | string  |       No | Search query     |
| `type`    | string  |       No | Result type      |
| `page`    | integer |       No | Page number      |
| `limit`   | integer |       No | Results per page |

**Supported result types:**

* `posts`
* `users`
* `tags`
* `categories`
* `all`

**API source:**

`GET /v1/search`

**Example:**

```text
/search/?q=landscape&type=posts
```

The search page should preserve the query in the URL so that searches can be bookmarked and shared.

#=== Account ===#

Account-related pages.

These pages manage the currently authenticated user's account and authentication state.

## `GET /account/`

Account overview.

**Authentication:** Required

**Content:**

* Display name
* Email address
* Avatar
* Account information
* Account settings
* Dashboard link
* Logout action

**API sources:**

* `GET /v1/me`
* `GET /v1/me/posts`

Unauthenticated users should be redirected to:

`/account/login/`

# Authentication

## `GET /account/login/`

Login page.

**Authentication:** Public

Provides the email/password login form.

**Form fields:**

| Field      | Type     | Required | Description      |
| ---------- | -------- | -------: | ---------------- |
| `email`    | email    |      Yes | Account email    |
| `password` | password |      Yes | Account password |

**Action:**

The frontend submits the credentials to:

`POST /v1/auth/sign-in/email`

On success:

1. Better Auth creates a session.
2. The browser receives the authentication cookie.
3. The user is redirected to the dashboard or the original requested page.

**Additional links:**

* Register
* Account recovery, if implemented

## `GET /account/register/`

Registration page.

**Authentication:** Public

Provides the account creation form.

**Form fields:**

| Field                  | Type     | Required | Description                       |
| ---------------------- | -------- | -------: | --------------------------------- |
| `name`                 | string   |      Yes | Display name                      |
| `email`                | email    |      Yes | Account email                     |
| `password`             | password |      Yes | Account password                  |
| `passwordConfirmation` | password |      Yes | Client-side password confirmation |

**Action:**

The frontend submits the registration data to:

`POST /v1/auth/sign-up/email`

On success, the user is authenticated and redirected to the dashboard or account page.

## `GET /account/logout/`

Logout page/action.

**Authentication:** Required

Terminates the current Better Auth session.

The actual logout operation should call:

`POST /v1/auth/sign-out`

The page may immediately perform the operation and redirect to `/`.

**Recommended behavior:**

```text
/account/logout/
        ↓
POST /v1/auth/sign-out
        ↓
redirect /
```

#=== Dashboard ===#

The dashboard is the authenticated management interface.

Unlike public pages, dashboard pages are intended for modifying the user's content.

All dashboard pages require authentication unless explicitly stated otherwise.

## `GET /dashboard/`

Dashboard overview.

**Authentication:** Required

**Content:**

* Total post count
* Recent posts
* Total upload count
* Recent uploads
* Tag count
* Category count
* Quick-create button
* Account information

**Primary actions:**

* Create post
* Manage posts
* Manage tags
* Manage categories
* Open settings

# Dashboard Posts

## `GET /dashboard/posts/`

Post management page.

**Authentication:** Required

Displays the authenticated user's posts.

**Features:**

* Post list/grid
* Search
* Pagination
* Filtering
* Sorting
* Edit
* Delete
* Create new post

**API source:**

`GET /v1/me/posts`

---

## `GET /dashboard/posts/new/`

New-post editor.

**Authentication:** Required

Provides the interface for creating a post.

**Workflow:**

```text
Select/upload artwork
        ↓
Enter post metadata
        ↓
Select category
        ↓
Assign tags
        ↓
Set source URL
        ↓
Create post
```

**Fields:**

| Field         | Type     | Required | Description         |
| ------------- | -------- | -------: | ------------------- |
| `title`       | string   |      Yes | Post title          |
| `description` | string   |       No | Post description    |
| `sourceUrl`   | URL      |       No | Original/source URL |
| `categoryId`  | string   |       No | Category            |
| `tags`        | string[] |       No | Assigned tags       |
| `uploads`     | file[]   |      Yes | Artwork files       |

**API sources:**

* `POST /v1/uploads`
* `POST /v1/posts`
* `POST /v1/posts/{postId}/tags`
* `PUT /v1/posts/{postId}/category`

## `GET /dashboard/posts/{postId}/`

Dashboard post view.

**Authentication:** Required

Displays a management-oriented view of a specific post.

**Content:**

* Full artwork
* Metadata
* Uploads
* Tags
* Category
* Creation/update information
* Ownership information

**Actions:**

* Edit
* Delete
* Manage tags
* Change category
* Replace/add uploads
* Open public post

**Authorization:**

The user must own the post or have administrative permissions.

## `GET /dashboard/posts/{postId}/edit/`

Post editor.

**Authentication:** Required

Allows modification of an existing post.

**Editable data:**

* Title
* Description
* Source URL
* Tags
* Category
* Associated uploads

**API sources:**

* `PATCH /v1/posts/{postId}`
* `POST /v1/posts/{postId}/tags`
* `DELETE /v1/posts/{postId}/tags/{tagId}`
* `PUT /v1/posts/{postId}/category`
* `DELETE /v1/posts/{postId}/category`

# Dashboard Tags

## `GET /dashboard/tags/`

Tag management interface.

**Authentication:** Required

Allows authorized users to manage tags.

**Features:**

* List tags
* Search tags
* Create tags
* Rename tags
* Edit slugs
* Delete tags
* View post usage count

**API sources:**

* `GET /v1/tags`
* `POST /v1/tags`
* `PATCH /v1/tags/{tagId}`
* `DELETE /v1/tags/{tagId}`

# Dashboard Categories

## `GET /dashboard/categories/`

Category management interface.

**Authentication:** Required

Allows authorized users to manage categories.

**Features:**

* List categories
* Create categories
* Edit categories
* Delete categories
* View post counts

**API sources:**

* `GET /v1/categories`
* `POST /v1/categories`
* `PATCH /v1/categories/{categoryId}`
* `DELETE /v1/categories/{categoryId}`

# Dashboard Settings

## `GET /dashboard/settings/`

Application/account settings.

**Authentication:** Required

Potential settings include:

### Profile

* Display name
* Avatar
* Public profile information

### Account

* Email
* Password
* Session management

### Privacy

* Profile visibility
* Post visibility, if private posts are supported

### Interface

* Theme
* Gallery layout
* Pagination preferences

The settings page should only expose settings actually supported by the backend.

#=== Other ===#

## `GET /about/`

About page.

**Authentication:** Public

Describes:

* What the archive is
* Purpose of the project
* Software/project information
* Credits
* Contact information, if applicable

## `GET /privacy/`

Privacy policy.

**Authentication:** Public

Describes how the application handles:

* Account information
* Uploaded artwork
* Session data
* Cookies
* Logs
* Analytics, if any
* Data deletion

## `GET /terms/`

Terms of service.

**Authentication:** Public

Defines the rules governing use of the archive.

This page should be treated as application/legal content rather than API functionality.

#=== Website Architecture ===#

The website should be a presentation layer over the API.

```text
                    ┌──────────────────┐
                    │     Browser      │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
        Public / Dashboard          Account pages
                │                         │
                └────────────┬────────────┘
                             │
                             ▼
                       /v1/* API
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
             Prisma       Better Auth   Storage
                │
                ▼
             SQLite
```

The frontend should **not** directly access Prisma or SQLite.

All application data should flow through the API layer.

This keeps the website and future clients—such as mobile applications or external tools—using the same backend contract.

#=== URL Design ===#

Public URLs should be human-readable.

Recommended:

```text
/posts/{postId}
/users/{userId}
/tags/{tagId}
/categories/{categoryId}
```

If slugs are introduced, these can eventually become:

```text
/posts/{slug}
/users/{username}
/tags/{slug}
/categories/{slug}
```

The API can continue using immutable IDs internally while the website uses human-readable public identifiers.

#=== Frontend Navigation ===#

Recommended global navigation:

```text
Home
├── Posts
├── Tags
├── Categories
├── Search
└── Account
    ├── Login
    └── Register

Authenticated:
Account
└── Dashboard
    ├── Overview
    ├── Posts
    │   ├── All Posts
    │   └── New Post
    ├── Tags
    ├── Categories
    └── Settings
```

A post should be reachable from multiple discovery paths:

```text
Home
 └── Post

Posts
 └── Post

User
 └── User Posts
      └── Post

Tag
 └── Tagged Posts
      └── Post

Category
 └── Category Posts
      └── Post

Search
 └── Search Results
      └── Post
```

#=== Client/API Relationship ===#

| Website page                      | Primary API                               |
| --------------------------------- | ----------------------------------------- |
| `/`                               | `/v1/posts`, `/v1/tags`, `/v1/categories` |
| `/posts/`                         | `/v1/posts`                               |
| `/posts/{postId}`                 | `/v1/posts/{postId}`                      |
| `/users/`                         | `/v1/users`                               |
| `/users/{userId}`                 | `/v1/users/{userId}`                      |
| `/users/{userId}/posts`           | `/v1/users/{userId}/posts`                |
| `/tags/`                          | `/v1/tags`                                |
| `/tags/{tagId}`                   | `/v1/tags/{tagId}`                        |
| `/tags/{tagId}/posts`             | `/v1/tags/{tagId}/posts`                  |
| `/categories/`                    | `/v1/categories`                          |
| `/categories/{categoryId}`        | `/v1/categories/{categoryId}`             |
| `/categories/{categoryId}/posts`  | `/v1/categories/{categoryId}/posts`       |
| `/search/`                        | `/v1/search`                              |
| `/account/`                       | `/v1/me`                                  |
| `/account/login/`                 | `/v1/auth/sign-in/email`                  |
| `/account/register/`              | `/v1/auth/sign-up/email`                  |
| `/account/logout/`                | `/v1/auth/sign-out`                       |
| `/dashboard/`                     | `/v1/me`, `/v1/me/posts`                  |
| `/dashboard/posts/`               | `/v1/me/posts`                            |
| `/dashboard/posts/new/`           | `/v1/uploads`, `/v1/posts`                |
| `/dashboard/posts/{postId}/`      | `/v1/posts/{postId}`                      |
| `/dashboard/posts/{postId}/edit/` | `/v1/posts/{postId}`                      |
| `/dashboard/tags/`                | `/v1/tags`                                |
| `/dashboard/categories/`          | `/v1/categories`                          |
| `/dashboard/settings/`            | `/v1/me`                                  |
