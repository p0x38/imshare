# imshare roadmap

> Last reviewed: 2026-11-19 against `main` at `bf3a38b1ffd62516f6050b3a23113945e25e541c`.
>
> Checkmarks reflect functionality found in the current source, tests, or documentation. An implemented feature may still need broader regression or interoperability coverage.

## Authentication and accounts

### Authentication and sessions

- [x] Integrate Better Auth
- [x] Support email/password authentication
- [x] Support a configurable OpenID Connect backend
    - [x] Wire the generic OAuth/OIDC provider
    - [x] Support discovery URL configuration
    - [x] Support client ID and optional client secret configuration
    - [x] Add the OIDC provider login button
    - [x] Add an authenticated-client helper
    - [x] Document callback URLs and scopes in `docs/auth-oidc.md`
    - [x] Fail clearly on partial OIDC configuration
    - [ ] Test the authorization-code flow end-to-end
    - [ ] Test account creation and linking from OIDC claims
- [x] Support account deletion
- [x] Provide session management UI
- [x] Provide TOTP authenticator enrollment and recovery-code management
- [ ] Add login history

### Account preferences and API tokens

- [x] Provide profile privacy settings
- [x] Provide per-user crawler preferences
- [x] Support browser push subscription enable/disable and test delivery
- [ ] Add per-event and per-channel notification preferences
- [x] Provide API tokens and basic management UI
    - [x] Create, list, revoke, and expire personal access tokens
    - [x] Support scoped permissions
    - [x] Store only a secure token hash and show the secret once
    - [x] Authenticate API requests with `Authorization: Bearer <token>`
    - [x] Return token metadata through the API
    - [x] Revoke individual tokens without invalidating browser sessions
    - [x] Add API-token route and authorization regression tests
    - [ ] Show token scopes, creation date, last-used date, and expiration clearly in the management UI
    - [ ] Add token-specific rate limits and audit events
    - [ ] Document token permissions and lifecycle in the endpoint reference

## Posts, moderation, and integrations

### Post management

- [x] Edit and delete posts
- [x] Hide and unhide posts
- [x] Create and manage draft posts
- [x] Support public, unlisted, and private visibility
- [x] Support scheduled publishing
- [x] Keep post revision history
- [x] Support content warnings

### Moderation

- [x] Moderation dashboard
- [x] Report review queue
- [x] User suspension and bans
- [x] Post removal workflow
- [x] Moderation audit log
- [ ] Block users

### Upload clients and publishing integrations

- [x] Support PostyBirb Custom Website uploads with token authentication and multipart handling
- [x] Provide a ShareX `.sxcu` template and setup guide
- [x] Document the generic upload endpoint, token scope, and response URL
- [x] Test upload-token acceptance and unrelated-scope denial
- [x] Test multipart image upload and image delivery
- [x] Support PostyBirb text-only publishing through the Notification URL
- [x] Support PostyBirb image-post publishing through the File URL
    - [x] Validate multipart image batches
    - [x] Create one image post for each submitted file batch
    - [x] Store uploaded images and associate them with the created post
    - [x] Map per-image alt text and source URL metadata
    - [x] Map title, description, tags, and rating metadata
    - [x] Support publication status and visibility with safe defaults
    - [x] Authenticate post creation with `posts: write` and image uploads with `uploads: write`
    - [x] Validate payloads and return useful errors
    - [x] Return the created post URL and identifier
    - [x] Test text-only submissions
    - [x] Test a multi-image submission and metadata association
    - [x] Document Notification URL and File URL configuration
    - [ ] Add a dedicated single-image File URL regression test
    - [ ] Define duplicate-submission and retry/idempotency behavior

## Discovery and search

### Recommendations

- [x] Related posts
- [x] Multi-signal related-post scoring
    - [x] Title, description, and caption similarity
    - [x] Tag and category similarity
    - [x] Author and content-type similarity
    - [x] Recency and engagement signals
    - [x] Extract a reusable recommendation scorer helper
- [x] Trending and popular posts
- [x] Recently viewed posts
- [x] Use authenticated reaction preferences for recommendation personalization
- [ ] Improve recommendation ranking quality
    - [ ] Add an explicit Top-N candidate selection and re-ranking stage
    - [ ] Add diversity and near-duplicate suppression
    - [ ] Cap repeated authors and categories per recommendation page
    - [ ] Add view-history signals to personalization
    - [ ] Normalize popularity so older posts do not dominate
    - [ ] Add deterministic tie-breaking
    - [ ] Move expensive similarity work behind cheaper candidate retrieval
- [ ] Add recommendation debug and inspection tooling

### Search

- [x] Full-text search
- [x] Search by user, tag, category, date, and MIME type
- [x] Tag autocomplete
- [x] Add an optional Meilisearch backend while retaining SQLite FTS5 by default
    - [x] Keep the Meilisearch URL and API key server-side
    - [x] Support full reindexing and incremental create/update/delete synchronization
    - [x] Fall back to SQLite FTS5 when Meilisearch is unconfigured or unavailable
    - [x] Document setup and reindexing in `docs/meilisearch.md`
    - [ ] Test indexing-write failures and recovery

## Content formats, rendering, and editing

### Content format support

- [x] Introduce a shared content-format registry
- [x] Support plain text, Markdown, and the supported Wikitext subset
- [x] Normalize unknown content formats to plain text
- [x] Introduce a reusable `ContentEditor`
- [x] Add Write, Split, and Preview modes
- [x] Use `ContentRenderer` for editor previews
- [x] Share the editor between text posts and image-post captions/descriptions

### Renderer and toolbar

- [x] Standardize renderer typography and spacing
- [x] Improve code-block and inline-code presentation
- [x] Improve table rendering and horizontal overflow
- [ ] Add renderer regression tests for each supported format
- [x] Add selectable heading levels
- [x] Add fenced code-block insertion for Markdown
- [ ] Implement underline support; keep the action visible but disabled until supported
- [x] Add Markdown strikethrough support
- [x] Add link insertion with editable link text and URL
- [x] Add Markdown link-title support
- [x] Keep external-link `target` and `rel` policy controlled by the renderer rather than exposing arbitrary user overrides
- [x] Add Markdown checklists and table insertion
- [x] Add format-aware toolbar capability definitions
- [x] Keep unsupported and work-in-progress actions visible but disabled
- [x] Explain disabled actions with tooltips

### Format-specific follow-up

- [x] Markdown headings 1–6, fenced code blocks, GFM strikethrough, checklists, tables, and titled links
- [ ] Expand Wikitext support
    - [ ] Add code-block syntax and rendering
    - [ ] Add strikethrough
    - [ ] Add checklists
    - [ ] Add tables
    - [ ] Expand link options where compatible with the format
- [ ] Add editor interaction and accessibility tests
    - [ ] Keyboard navigation and focus restoration
    - [ ] Toolbar labels and disabled-state explanations
    - [ ] Responsive editor behavior
- [ ] Evaluate a Tiptap-based WYSIWYG editor
    - [ ] Define a versioned structured-document schema
    - [ ] Define storage and API compatibility
    - [ ] Implement a read-only structured-document renderer
    - [ ] Implement editing and format conversion
- [ ] Design an extension API for custom markup parsers and renderers
    - [ ] Define parser and renderer interfaces
    - [ ] Define sanitization and security requirements
    - [ ] Define format registration and compatibility behavior

## Frontend, accessibility, and dashboard

### Shared frontend

- [x] Support dark mode through system preference
- [x] Provide a shared client-side API helper
- [x] Provide shared components and partials
- [x] Support responsive/mobile layouts
- [x] Migrate the main frontend to React and Material UI
    - [x] Navigation and header
    - [x] Post cards and responsive grids
    - [x] Skeleton and loading states
    - [x] Feedback components and theme system
    - [x] Mobile Drawer navigation
    - [x] Local Vite frontend bundling
- [x] Add page transitions and motion polish
- [x] Add full-width responsive navigation/header layout
- [x] Add recommendation sections and desktop sidebar
- [x] Improve empty and loading states
- [x] Add confirm-before-destructive-action dialogs
- [x] Add a floating action button for the posts page
- [ ] Make animation preferences control all shared motion components
- [ ] Apply ripple and theme preferences consistently to interactive components
- [ ] Persist appearance preferences to the authenticated account
- [ ] Support resetting, importing, and exporting appearance preferences
- [ ] Add reduced-motion support across custom animations and transitions
- [ ] Migrate remaining upload/edit forms to Material UI
- [ ] Remove legacy frontend styling where it has been replaced
- [ ] Integrate server and Vite HMR into one development workflow
- [ ] Improve keyboard navigation

### Image viewer

- [x] Provide an image viewer/lightbox
- [x] Support previous/next image navigation
- [x] Display image metadata
- [ ] Add zoom
- [ ] Add pan

### Dashboard migration

- [x] React dashboard landing page
- [x] React dashboard post listing
- [x] React dashboard post management view
- [x] React dashboard post editor
- [x] React creator analytics page
- [x] React tag and category management
- [x] React dashboard settings page
- [x] Migrate the current admin dashboard routes to React entries

## SEO, indexing, and crawler policies

### Page metadata and canonical URLs

- [x] Generate server-side metadata in the initial HTML response
- [x] Generate descriptive titles and page-specific descriptions for the homepage, posts, profiles, tags, and categories
- [x] Generate Open Graph and Twitter metadata
- [x] Generate absolute canonical URLs using the configured request origin
- [x] Use post permalink generation for post canonical URLs
- [x] Normalize query-string variants out of canonical URLs
- [x] Generate canonical links and metadata through a shared SEO utility
- [ ] Audit metadata for search, discovery, and paginated listing pages
- [ ] Check consistency between document titles, visible headings, and page content across all public pages
- [ ] Audit important public links for crawlable `<a href>` markup and descriptive anchor text
- [ ] Audit redirects and URL normalization across deployments
    - [ ] HTTP-to-HTTPS behavior
    - [ ] Hostname normalization
    - [ ] Trailing-slash consistency
    - [ ] Legacy and changed permalink redirects
- [ ] Audit HTTP status codes for public, unavailable, private, and deleted pages

### Indexing policy and robots directives

- [x] Centralize user and post crawler preferences
- [x] Support separate search, AI, image, and custom crawler policy values
- [x] Support per-post overrides with inheritance from the owning user
- [x] Emit `noindex` and `noimageindex` directives when the corresponding policy denies indexing
- [x] Emit `X-Robots-Tag` restrictions for image and avatar resources
- [x] Generate crawler-specific `robots.txt` groups
- [x] Keep search crawlers able to fetch public pages whose metadata communicates `noindex`
- [x] Protect private content with application access controls rather than relying on `robots.txt`
- [ ] Define and test indexing semantics for unlisted posts, including their treatment outside the sitemap
- [ ] Add integration tests for public, unlisted, private, draft, scheduled, hidden, and deleted post states
- [ ] Add integration tests for user-level crawler settings and per-post overrides

### Structured data

- [x] Generate homepage `WebSite` structured data with the configured site name and URL
- [x] Generate `SocialMediaPosting` structured data for post pages
- [x] Include available post author, publication date, modification date, text, and image data
- [x] Generate `ProfilePage` structured data with a `Person` main entity
- [x] Avoid inventing unavailable profile images or other optional properties
- [ ] Add `alternateName` for the website only when a genuine alternative site name is configured
- [ ] Evaluate `Article`/`BlogPosting` for editorial content where it is more accurate than `SocialMediaPosting`
- [ ] Evaluate `QAPage` only if dedicated question-and-answer pages are introduced
- [ ] Evaluate image-license metadata only when genuine rights and attribution information is available
- [ ] Evaluate video indexing if public video pages are introduced

### Sitemaps

- [x] Generate an XML sitemap for static pages, eligible public profiles and posts, tags, and categories
- [x] Exclude private, unlisted, draft, hidden, scheduled, and otherwise non-indexable posts from the sitemap
- [x] Keep post sitemap URLs aligned with post permalink generation
- [x] Provide modification timestamps from available update timestamps
- [x] Include image sitemap entries for eligible post images, including multiple images per post
- [x] Advertise the sitemap from `robots.txt`
- [x] Test sitemap responses and basic indexing exclusions
- [ ] Add sitemap index files if sitemap size or URL count requires them
- [ ] Add a video sitemap if public video content is introduced

### SEO testing and operations

- [x] Add SEO title and structured-data unit tests
- [x] Add crawler-policy unit tests
- [x] Add sitemap, `robots.txt`, and server-rendered post fallback tests
- [ ] Add page-level metadata and canonical regression tests for all public page types
- [ ] Expand indexing-state integration tests
- [ ] Add automated structured-data/schema validation to development or CI
- [ ] Document the SEO validation workflow
    - [ ] Google Rich Results Test
    - [ ] Search Console URL Inspection
    - [ ] Search Console sitemap monitoring
    - [ ] Search Console indexing and crawling reports
- [ ] Document known limitations and structured-data eligibility by page type

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

## Federation

- [x] Provide initial ActivityPub federation support
    - [x] Expose WebFinger and NodeInfo discovery endpoints
    - [x] Expose Person actors, inbox, outbox, followers, and following endpoints
    - [x] Expose public posts as `Create` activities containing `Note` objects
    - [x] Process `Follow`, `Undo`, `Accept`, `Reject`, public `Create`, and `Delete` activities
    - [x] Sign outbound federation requests and verify inbound signatures
    - [x] Verify that the activity actor matches the verified signer
    - [x] Reject federation deliveries to private or local network destinations
    - [x] Add unit tests for signatures, digest validation, actor matching, and unsafe destinations
- [ ] Expand federation interoperability and protocol coverage
    - [ ] Add route-level tests for discovery, actor, inbox, and outbox endpoints
    - [ ] Test interoperability with other ActivityPub implementations
    - [ ] Document supported activities and known limitations

## Platform, storage, and operations

### Infrastructure and observability

- [x] Enforce lockfile consistency in CI with `pnpm install --frozen-lockfile`
- [x] Add migration validation/deployment checks to CI
- [x] Provide health and readiness endpoints
- [x] Add security headers
- [x] Add CSRF protection
- [x] Provide OpenTelemetry tracing, metrics, and logs configuration with Prometheus support
- [ ] Add realtime integration tests
- [x] Add image upload and image-proxy regression coverage
- [ ] Add profile-link API tests
- [ ] Implement a managed background job system with bounded concurrency, retries, and shutdown handling
- [ ] Move thumbnail and image processing from fire-and-forget scheduling to managed jobs
- [ ] Add an operational metrics dashboard
- [ ] Add structured audit logging beyond the existing moderation audit log
- [ ] Add automated dependency updates

### Storage

- [x] Support local filesystem storage for uploads and avatars
- [ ] Introduce a pluggable storage-provider abstraction
- [ ] Add an S3-compatible storage provider

### Database providers

- [x] Use SQLite as the default provider (`Prisma` + `better-sqlite3`)
- [x] Add PostgreSQL-specific Prisma schema, adapter, configuration, and initial migration
- [x] Avoid SQLite-only FTS5 SQL when PostgreSQL is selected
- [x] Document PostgreSQL setup in `docs/postgresql.md`
- [ ] Run provider-specific integration tests against a PostgreSQL server
- [ ] Document production backup and upgrade procedures
- [ ] Decide whether MySQL/MariaDB should be supported
- [ ] Add automated database backups

## Testing, quality, and documentation

### Test infrastructure

- [x] Add the Vitest unit/API test suite
- [x] Migrate API and integration tests from `node:test` to Vitest
- [x] Add a dedicated integration-test runner with database setup and cleanup
- [x] Add the Playwright browser test suite
- [x] Add public frontend smoke tests
- [x] Add desktop and mobile navigation browser coverage
- [x] Configure browser tests to use a single worker for stable local execution
- [x] Add Playwright scripts to `package.json`
- [x] Add VS Code tasks for unit, integration, browser, headed browser, and browser UI tests
- [x] Add a VS Code build task as the default build task
- [x] Add VS Code formatting and format-check tasks
- [x] Ignore Playwright, test-results, and coverage artifacts in `.gitignore`
- [x] Add OIDC configuration unit tests
- [x] Add recommendation API behavior tests for anonymous and reaction-personalized results
- [ ] Add recommendation scorer unit tests with representative fixtures
- [ ] Benchmark recommendation ranking cost with larger candidate pools
- [ ] Add content renderer and editor interaction tests
- [ ] Add accessibility regression tests for navigation, dialogs, forms, interactive cards, and the editor
- [ ] Add performance regression tests

### API and project documentation

- [x] Generate OpenAPI documentation
- [x] Filter and group OpenAPI routes
- [x] Add OpenAPI request and response examples
- [x] Document expected response statuses
- [x] Fix Swagger UI CSP configuration
- [x] Fix Swagger UI metadata/header interference
- [x] Fix OpenAPI schema and route tagging issues
- [x] Document OIDC setup and callback behavior in `docs/auth-oidc.md`
- [ ] Document recommendation scoring inputs and outputs

## Architecture and developer experience

- [x] Replace runtime `esm.sh` MUI dependencies with local bundling
- [x] Introduce the frontend build pipeline
- [x] Define the frontend component architecture
- [x] Define API and client-state conventions
- [x] Consolidate duplicated client-side code
- [ ] Define a shared design-token layer for spacing, motion, and accent colors
- [x] Implement the `config.imshare` parser
- [x] Validate parsed configuration against the typed server configuration model
- [x] Implement the `config.imshare` formatter/serializer
- [x] Add configuration DSL tests for parsing, formatting, round-tripping, duplicate keys, and malformed values
- [x] Add the `imshare-cli` configuration commands
    - [x] Validate configuration files
    - [x] Show individual effective configuration properties
    - [x] List effective values with file/default/environment provenance
    - [x] Resolve and display the selected configuration path
    - [x] Support `IMSHARE__...` environment overrides in both the CLI and server
