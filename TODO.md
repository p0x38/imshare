# imshare TODO

## Current roadmap

### 1. Authentication

- [x] Better Auth integration
- [x] Email/password authentication
- [x] Configurable OpenID Connect backend integration
    - [x] Generic OAuth/OIDC plugin wiring
    - [x] Discovery URL configuration
    - [x] Client ID / optional client secret configuration
    - [ ] Add OIDC provider login button to the frontend
    - [ ] Add authenticated-client helper for Better Auth
    - [ ] Verify OIDC callback URL for `/api/v1/auth`
    - [ ] Test authorization-code flow end-to-end
    - [ ] Test account creation/linking from OIDC claims
    - [ ] Document required provider-side redirect URI and scopes
    - [ ] Handle missing/invalid OIDC configuration with a clear startup error
- [ ] Account/session management
    - [ ] Account deletion
    - [ ] Session management UI
    - [ ] Login history

### 2. Discovery and recommendations

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

- [ ] Regenerate and commit `pnpm-lock.yaml` after dependency changes
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
- [ ] Add OIDC authentication test coverage
- [ ] Add recommendation scorer test fixtures
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
- [ ] Document OIDC authentication endpoints and callback behavior
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

## Discovery

- [x] Full-text search
- [x] Search filters
    - [x] User
    - [x] Tag
    - [x] Category
    - [x] Date
    - [x] MIME type
- [x] Tag autocomplete
- [x] Related posts
- [x] Trending/popular posts
- [x] Recently viewed posts

## Moderation / safety

- [ ] Moderation dashboard
- [ ] Report review queue
- [ ] User suspension / ban
- [ ] Post removal workflow
- [ ] Audit log
- [ ] Block users
- [ ] Content warning support

## Accounts

- [ ] Account deletion
- [ ] Session management
- [ ] Login history
- [ ] Profile privacy settings
- [ ] Notification preferences
- [ ] API tokens
    - [ ] Personal access tokens for external API clients and scripts
    - [ ] Token creation, listing, revocation, and expiration
    - [ ] Scoped permissions (for example: read-only, posts, uploads, account)
    - [ ] Store only a secure token hash and show the secret only once
    - [ ] Authentication via `Authorization: Bearer <token>`
    - [ ] Per-token name, creation date, last-used date, and expiration
    - [ ] Revoke individual tokens without invalidating browser sessions
    - [ ] Rate-limit and audit token-authenticated requests
    - [ ] Document token authentication in OpenAPI and API documentation
    - [ ] Add frontend token management UI
    - [ ] Add API-token tests and security regression coverage
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
