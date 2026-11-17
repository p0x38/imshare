# imshare TODO

## Current roadmap

### Authentication

- [x] Better Auth integration
- [x] Email/password authentication
- [x] Configurable OpenID Connect backend integration
    - [x] Generic OAuth/OIDC plugin wiring
    - [x] Discovery URL configuration
    - [x] Client ID / optional client secret configuration
    - [x] Add OIDC provider login button to the frontend
    - [x] Add authenticated-client helper for Better Auth
    - [ ] Test authorization-code flow end-to-end
    - [ ] Test account creation/linking from OIDC claims
    - [x] Document callback URL and scopes in `docs/auth-oidc.md`
    - [x] Fail clearly on partial OIDC configuration
- [ ] Account/session management
    - [x] Account deletion
    - [x] Session management UI
    - [ ] Login history

### Discovery and recommendations

- [x] Related posts
- [x] Multi-signal related-post scorer
    - [x] Title similarity
    - [x] Description similarity
    - [x] Caption similarity
    - [x] Tag similarity
    - [x] Category similarity
    - [x] Author similarity
    - [x] Content-type similarity
    - [x] Recency score
    - [x] Engagement score
    - [x] Extract reusable recommendation scorer helper
- [ ] Improve recommendation ranking quality
    - [ ] Add explicit Top-N candidate selection/re-ranking stage
    - [ ] Add diversity / duplicate suppression to avoid near-identical results
    - [ ] Cap repeated authors/categories in a recommendation page
    - [ ] Add personalized signals from views/reactions
    - [ ] Normalize popularity so older posts do not dominate
    - [ ] Add deterministic tie-breaking
    - [ ] Add scorer unit tests with representative fixtures
    - [ ] Benchmark ranking cost with larger candidate pools
    - [ ] Move expensive similarity work behind a cheaper candidate-retrieval stage
- [x] Trending/popular posts
- [x] Recently viewed posts
- [ ] Add recommendation debug/inspection tooling for development

## Frontend

- [x] Dark mode via system preference
- [x] Shared client-side API helper
- [x] Shared components / partials
- [x] Responsive/mobile layout
- [x] React + Material UI frontend migration
    - [x] Navigation/header
    - [x] Post cards and responsive post grids
    - [x] Skeleton/loading states
    - [x] Feedback components
    - [x] Theme system
    - [x] Mobile Drawer navigation
    - [x] Local Vite frontend bundling
- [x] Page transitions and motion polish
- [x] Full-width responsive navigation/header layout
- [x] Recommendation sections and desktop sidebar
- [x] Better empty states
- [x] Better loading states
- [x] Confirm-before-destructive-action dialogs
- [x] Floating action button for posts page
- [ ] Make the animation preference control all shared motion components
- [ ] Make ripple/theme preferences apply consistently to all interactive components
- [ ] Persist theme preferences to the authenticated account
- [ ] MUI form components for remaining upload/edit pages
- [ ] Remove remaining legacy frontend styling where replaced
- [ ] Browser live reload / HMR
- [ ] Keyboard navigation improvements
- [ ] Accessibility regression tests for navigation, dialogs, forms, and interactive cards
- [ ] Reduced-motion support across custom animations and transitions
- [x] Image viewer / lightbox
    - [ ] Zoom
    - [ ] Pan
    - [x] Previous/next image
    - [x] Image metadata

## Infrastructure

- [x] Enforce lockfile consistency in CI with `pnpm install --frozen-lockfile`
- [ ] Add realtime integration tests
- [ ] Add image upload/proxy tests
- [ ] Add profile-link tests
- [x] Add reaction API tests
- [x] Add migration CI check
- [ ] Background job system
- [ ] Image processing queue
- [ ] Storage abstraction
    - [ ] Local filesystem
    - [ ] S3-compatible storage
- [ ] Automated database backups
- [x] Health/readiness endpoints
- [ ] Metrics dashboard
- [ ] Structured audit logging
- [x] Security headers
- [x] CSRF protection
- [ ] Automated dependency updates

## Database providers (P3: structural change)

- [x] SQLite as the current default (Prisma + `better-sqlite3`)
- [ ] Evaluate PostgreSQL as the first alternative provider
    - [x] Add provider-specific Prisma schema, adapter, configuration, and initial migration
    - [x] Avoid SQLite-only FTS5 SQL when PostgreSQL is selected
    - [x] Document PostgreSQL setup in `docs/postgresql.md`
    - [ ] Run provider-specific integration tests against a PostgreSQL server
    - [ ] Document production backup and upgrade procedures
- [ ] Decide whether MySQL/MariaDB should be supported

## Testing and quality

- [x] Vitest unit/API test suite
- [x] Migrate API tests from `node:test` to Vitest
- [x] Migrate integration tests from `node:test` to Vitest
- [x] Dedicated integration-test runner with database setup/cleanup
- [x] Playwright browser test suite
- [x] Public frontend smoke tests
- [x] Desktop navigation browser coverage
- [x] Mobile navigation browser coverage
- [x] Browser-test single-worker configuration for stable local execution
- [x] Add Playwright scripts to `package.json`
- [x] Add VS Code tasks for unit, integration, browser, headed browser, and browser UI tests
- [x] Add VS Code build task as the default build task
- [x] Add VS Code formatting and format-check tasks
- [x] Ignore Playwright, test-results, and coverage artifacts in `.gitignore`
- [x] Add OIDC configuration unit tests
- [ ] Add recommendation ranking regression tests

## API / documentation

- [x] OpenAPI documentation generation
- [x] OpenAPI route filtering/grouping
- [x] OpenAPI request examples
- [x] OpenAPI response examples
- [x] OpenAPI expected status documentation
- [x] Fix Swagger UI CSP configuration
- [x] Fix Swagger UI metadata/header interference
- [x] Fix OpenAPI schema/route tagging issues
- [x] Document OIDC setup and callback behavior in `docs/auth-oidc.md`
- [ ] Document recommendation scoring inputs/outputs

## Posts

- [x] Edit post
- [x] Delete post
- [x] Hide/unhide post
- [x] Draft posts
- [x] Post visibility
    - [x] Public
    - [x] Unlisted
    - [x] Private
- [x] Scheduled publishing
- [x] Post revision history

## Federation

- [ ] Plan federation architecture and interoperability model

## Dashboard

- [x] React dashboard landing page
- [x] React dashboard post listing
- [ ] React dashboard post management view
- [ ] React dashboard post editor
- [x] React dashboard tag management
- [x] React dashboard category management
- [x] React dashboard settings page
- [ ] Complete migration of remaining dashboard management pages to React

## Search

- [x] Full-text search
- [x] Search filters
    - [x] User
    - [x] Tag
    - [x] Category
    - [x] Date
    - [x] MIME type
- [x] Tag autocomplete
- [x] Add an optional Meilisearch backend while retaining SQLite FTS5 as the default
    - [x] Keep the Meilisearch URL and API key server-side
    - [x] Add full reindexing and incremental create/update/delete synchronization
    - [x] Fall back to SQLite FTS5 when Meilisearch is unconfigured or unavailable
    - [ ] Test indexing-write failures and recovery
    - [x] Document setup and reindexing in `docs/meilisearch.md`

## SEO / Search visibility

### Page metadata and site identity

- [ ] Audit SEO metadata across all public page types
    - [ ] Homepage
    - [ ] Post pages
    - [ ] User profile pages
    - [ ] Tag and category pages
    - [ ] Search and discovery pages
    - [ ] Pagination and other indexable listing pages
- [ ] Generate unique, descriptive page titles that accurately reflect visible page content
- [ ] Generate page-specific meta descriptions without relying on them being used verbatim as search snippets
- [ ] Keep document titles, visible headings, and page content consistent
- [ ] Ensure metadata is present in the initial HTML response
- [ ] Validate generated `<head>` markup and ensure metadata elements use valid HTML
- [ ] Audit supported robots and search metadata directives
    - [ ] `robots`
    - [ ] `googlebot`
    - [ ] `nosnippet`
    - [ ] `max-snippet`
    - [ ] `data-nosnippet`
- [ ] Add homepage `WebSite` structured data
    - [ ] Provide the canonical site name and homepage URL
    - [ ] Add `alternateName` when a genuine alternative site name exists

### Canonicalization and crawlable links

- [ ] Audit canonical URL generation across all page types
    - [ ] Use absolute canonical URLs with the configured public origin
    - [ ] Keep canonical URLs consistent with post permalink generation
    - [ ] Check custom post IDs and alternative permalink patterns
    - [ ] Handle query parameters and duplicate URL variants consistently
    - [ ] Keep canonical URLs consistent with internal links and sitemaps
- [ ] Audit redirects and URL normalization
    - [ ] HTTP to HTTPS
    - [ ] Hostname normalization
    - [ ] Trailing slash consistency
    - [ ] Legacy and changed permalink redirects
- [ ] Ensure important public pages are discoverable through crawlable `<a href>` links
- [ ] Use descriptive anchor text for links to posts, profiles, tags, and categories
- [ ] Audit HTTP response status codes for public, unavailable, and deleted pages

### Indexing and crawler policies

- [ ] Define a centralized indexing policy for pages and posts
    - [ ] Public posts
    - [ ] Unlisted posts
    - [ ] Private posts
    - [ ] Draft posts
    - [ ] Scheduled posts
    - [ ] Hidden and deleted posts
    - [ ] User profiles and profile visibility settings
    - [ ] Per-user and per-post search-engine indexing preferences
- [ ] Ensure crawler directives consistently reflect the indexing policy
- [ ] Distinguish crawling restrictions from indexing restrictions
    - [ ] Use `noindex` when a crawlable page must not be indexed
    - [ ] Do not rely on `robots.txt` to prevent indexing
    - [ ] Avoid blocking pages that Google must crawl to discover `noindex`
    - [ ] Protect private content with actual access controls
- [ ] Audit `robots.txt` rules for Googlebot and other supported crawlers
- [ ] Test indexing directives for representative page visibility states

### Structured data

- [ ] Audit JSON-LD generation for correctness and page-type consistency
    - [ ] Use structured data that accurately represents visible page content
    - [ ] Avoid emitting unavailable, fabricated, or misleading properties
    - [ ] Keep structured data synchronized with the rendered page
    - [ ] Validate JSON-LD syntax and schema types
- [ ] Implement or improve `WebSite` structured data on the homepage
- [ ] Improve post structured data
    - [ ] Use `SocialMediaPosting` when it accurately represents the post
    - [ ] Verify the type against `DiscussionForumPosting` where appropriate
    - [ ] Provide the required `author` and `author.name` properties
    - [ ] Provide `datePublished` using the actual publication timestamp
    - [ ] Provide at least one applicable `text`, `image`, or `video` property
    - [ ] Provide `author.url` when an author profile URL is available
    - [ ] Provide `dateModified` when a genuine modification timestamp is available
    - [ ] Keep post titles and other descriptive properties consistent with visible content
- [ ] Add `ProfilePage` structured data to eligible public profile pages
    - [ ] Identify the profile subject through `mainEntity`
    - [ ] Represent the subject using the appropriate `Person` or `Organization` type
    - [ ] Include available profile information without exposing private data
- [ ] Evaluate `Article` / `BlogPosting` for editorial content only
- [ ] Evaluate `QAPage` only if dedicated question-and-answer pages are introduced
- [ ] Evaluate image license metadata
    - [ ] Support `ImageObject` where genuine rights and attribution information is available
    - [ ] Do not infer ownership, creator, or license information from the uploader
- [ ] Evaluate video indexing support when public video pages are available

### Sitemaps

- [ ] Audit XML sitemap generation and submission
    - [ ] Include canonical, public, indexable URLs only
    - [ ] Exclude private, draft, deleted, and otherwise non-indexable content
    - [ ] Keep sitemap URLs consistent with canonical URLs
    - [ ] Provide accurate `lastmod` values when meaningful modification timestamps exist
    - [ ] Support sitemap index files when the number of URLs requires them
- [ ] Evaluate image sitemap support
    - [ ] Include relevant crawlable image URLs from indexable pages
    - [ ] Support multiple images associated with a page where appropriate
- [ ] Evaluate video sitemap support if public video content is introduced
- [ ] Verify sitemap accessibility, response status, XML validity, and robots.txt discovery

### Testing and monitoring

- [ ] Add SEO metadata regression tests
    - [ ] Homepage metadata and site identity
    - [ ] Post metadata and structured data
    - [ ] Profile metadata and structured data
    - [ ] Canonical URL generation
    - [ ] Robots and indexing directives
    - [ ] Visibility and publication-state handling
    - [ ] Sitemap inclusion and exclusion rules
- [ ] Add structured data validation to the development or CI workflow
- [ ] Document the SEO validation workflow
    - [ ] Google Rich Results Test
    - [ ] Search Console URL Inspection
    - [ ] Search Console sitemap monitoring
    - [ ] Search Console indexing and crawling reports
- [ ] Document known limitations and structured data eligibility per page type

### Google Search Central references

- Site appearance:
    - [Site names](https://developers.google.com/search/docs/appearance/site-names?hl=ja)
    - [Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet?hl=ja)
    - [Title links](https://developers.google.com/search/docs/appearance/title-link?hl=ja)
- Structured data:
    - [Introduction to structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data?hl=ja)
    - [Article](https://developers.google.com/search/docs/appearance/structured-data/article?hl=ja)
    - [Discussion Forum and SocialMediaPosting](https://developers.google.com/search/docs/appearance/structured-data/discussion-forum?hl=ja)
    - [Image license metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata?hl=ja)
    - [ProfilePage](https://developers.google.com/search/docs/appearance/structured-data/profile-page?hl=ja)
    - [QAPage](https://developers.google.com/search/docs/appearance/structured-data/qapage?hl=ja)
- Crawling and indexing:
    - [URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure?hl=ja)
    - [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable?hl=ja)
    - [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview?hl=ja)
    - [Image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps?hl=ja)
    - [Video sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps?hl=ja)
    - [Troubleshooting crawling errors](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors?hl=ja)
    - [Robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro?hl=ja)
    - [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization?hl=ja)
    - [Canonicalization troubleshooting](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting?hl=ja)
    - [Valid page metadata](https://developers.google.com/search/docs/crawling-indexing/valid-page-metadata?hl=ja)
    - [Supported meta tags and attributes](https://developers.google.com/search/docs/crawling-indexing/special-tags?hl=ja)

## Uploaders

- [x] Support PostyBirb Custom Website uploads with token auth and compatible multipart handling
- [x] Add a ShareX `.sxcu` template and setup guide
- [x] Document the generic upload endpoint, token scope, and response URL
- [x] Test that upload tokens are accepted and unrelated scopes remain denied
- [x] Add an end-to-end multipart image-upload and response-format test
- [ ] Support PostyBirb post publishing through its Custom Website integration
    - [x] Review PostyBirb's text-only submission payload and notification behavior
    - [x] Review PostyBirb's File URL submission payload and batch behavior
    - [x] Define separate API contracts for text and image post creation
    - [ ] Support text-only posts through the Notification URL
    - [ ] Support image posts through the File URL
        - [ ] Accept and validate multiple image files per submission
        - [ ] Create one image post for each submitted file batch
        - [ ] Store uploaded images and associate them with the created post
        - [ ] Map per-image alt text metadata
        - [ ] Map per-image source URL metadata
    - [ ] Map PostyBirb title, description, tags, and rating metadata
    - [ ] Support publication status and visibility with safe defaults
    - [ ] Authenticate using API tokens with `posts: write` permission
    - [ ] Validate payloads and return useful error responses
    - [ ] Return the created post URL and identifier
    - [ ] Handle duplicate submissions and retry behavior
    - [ ] Add API and integration tests for text-only submissions
    - [ ] Add integration tests for single-image and multi-image submissions
    - [ ] Test metadata association across image batches
    - [ ] Document PostyBirb Notification URL configuration
    - [ ] Document PostyBirb File URL configuration

## Moderation / safety

- [x] Moderation dashboard
- [x] Report review queue
- [x] User suspension / ban
- [x] Post removal workflow
- [x] Moderation audit log
- [ ] Block users
- [x] Content warning support

## Accounts

- [x] Profile privacy settings
- [ ] Notification preferences
- [x] API tokens (API and basic management UI)
    - [x] Personal access tokens for external API clients and scripts
    - [x] Create, list, revoke, and expire tokens through the API
    - [x] Scoped permissions through the API
    - [x] Store only a secure token hash and show the secret only once
    - [x] Authenticate with `Authorization: Bearer <token>`
    - [x] Return per-token name, creation date, last-used date, and expiration in the API
    - [x] Revoke individual tokens without invalidating browser sessions
    - [ ] Show token scopes, creation date, and expiration in the management UI
    - [ ] Add token-specific rate limits and audit events
    - [x] Document bearer authentication in OpenAPI
    - [ ] Document token permissions and lifecycle in the endpoint reference
    - [x] Add API-token management UI
    - [x] Add API route and authorization regression tests
- [ ] Account-synced appearance/theme preferences
- [ ] Reset appearance/theme preferences to defaults
- [ ] Import/export appearance/theme preferences

## Architecture

- [x] Replace runtime `esm.sh` MUI dependencies with local bundling
- [x] Introduce frontend build pipeline
- [ ] Add browser HMR/live reload
- [x] Define frontend component architecture
- [x] Define API/client state conventions
- [x] Consolidate duplicated client-side code
- [x] Add end-to-end tests
- [ ] Add accessibility regression tests
- [ ] Add performance regression tests
- [ ] Define a shared design-token layer for spacing, motion, and accent colors
- [ ] Keep theme preferences independent from page-specific styling

## Code security / quality

## Configuration DSL

- [ ] Add validator and formatter for .imshare DSL
