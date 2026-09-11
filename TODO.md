# imshare TODO

## Core interactions

- [x] Commenting
    - [x] Create a comment
    - [x] Edit a comment
    - [x] Remove a comment (commenter or original image poster himself)
    - [x] Likes
    - [x] Custom emoji / emoticon support
- [x] Report abuse stuff
- [x] Recommended for you (or recommended sidebar on individual pages such as post, category, and tag page)
- [x] Image caption stuff (under the image on post page)
- [x] Accessibility support (in case)
- [x] Ability to download the image (if image creator allows)
- [ ] Notifications
    - [ ] Notification model
    - [ ] Notification API
    - [ ] Realtime notification delivery
    - [ ] Notification center UI
    - [ ] Mark as read
    - [ ] Mark all as read

## Profiles

- [x] Extensible profile links
- [x] Server-generated default avatar
- [x] Initials/text avatar
- [x] Identicon avatar
- [x] Gravatar support
- [x] Custom avatar reference
- [x] Profile settings UI for avatar mode and links
- [x] Profile banner / accent color
- [ ] Updated pages
    - [x] Profile page
        - [ ] Customizable Widgets (Prebuilt / Community / Custom)
            - [x] Basic information (Join date, total views, description and etc)
            - [x] Recent posts
            - [x] Popular posts

## Images and uploads

- [x] Content-hashed stored image filenames
- [x] Thumbnail resizing through Sharp
- [x] WebP/AVIF output support
- [x] Lazy-loaded post thumbnails
- [x] Lazy-loaded post images
- [x] Upload progress indicator
- [x] Persistent transformed-image cache
- [x] Background thumbnail generation
- [x] Upload cancellation
- [x] Multiple-file uploads
- [x] Duplicate-content deduplication at the database layer
- [x] Responsive thumbnail variants
    - [x] "Fit" thumbnail, or just scale it to 64 ~ 128 px around for grid stuff
    - [x] Use thumbhash while loading if possible (https://evanw.github.io/thumbhash/)
    - [ ] Original-image metadata
    - [ ] Dimensions
    - [ ] File size
    - [ ] MIME type
    - [ ] EXIF information
- [ ] EXIF privacy stripping
- [ ] Color profile handling
- [ ] Orientation normalization
- [ ] Blurhash/thumbhash placeholders
- [ ] Progressive image loading
- [ ] CDN/cache headers
- [ ] Optional original-file download

## Realtime

- [x] Socket.IO server
- [x] Post rooms
- [x] Reaction broadcasts
- [x] Presence / online state
- [x] Live upload status
- [x] Server-side notification events

## Frontend

- [x] Dark mode via system preference
- [x] Shared client-side API helper
- [x] Shared components / partials
- [x] Template engine evaluation
- [x] Better error page system
    - [x] HTML/JSON error handling
    - [x] Make dedicated well-known error pages (such as 404, 500, 400, 403, 401, and 429)
- [x] Add some pages (or just add it on navigation bar)
    - [x] About (or version of the webapp)
    - [x] FAQ
    - [x] GitHub (i guess, need to warn people that the project uses AI)
- [x] Add rate-limits
    - [x] Upload limits (30 per day)
    - [x] View rate limit (50 ~ 75+ per minute followed by server performance i guess)
- [x] Infinite scroll or pagination controls
- [x] Unification of header and footer
- [x] SEO / OpenGraph stuff for each pages
- [x] Accessibility support
- [ ] Modernize UI with Material UI
  - [x] Initial MUI integration
  - [x] React runtime/import-map setup
  - [ ] Replace navigation/header with finalized MUI component
  - [ ] Add MUI-based post cards
  - [ ] Add MUI Skeleton loading states
  - [ ] Add MUI form components for upload/edit pages
  - [ ] Add MUI dialogs / confirmation UI where appropriate
  - [ ] Make MUI theme follow system dark/light preference
  - [ ] Remove remaining legacy frontend styling where replaced
  - [ ] Replace `esm.sh` runtime dependencies with a local frontend bundle
- [ ] Improve development workflow
  - [x] Watch EJS templates and TypeScript with nodemon
  - [ ] Add browser live reload / HMR
  - [ ] Add frontend build pipeline
- [ ] Responsive/mobile layout
- [ ] Keyboard navigation improvements
- [ ] Image viewer / lightbox
    - [ ] Zoom
    - [ ] Pan
    - [ ] Previous/next image
    - [ ] Image metadata
- [ ] Drag-and-drop upload UI
- [ ] Upload queue UI
    - [ ] Retry failed uploads
    - [ ] Reorder uploads
    - [ ] Remove queued files
- [ ] Toast / snackbar notification system
- [ ] Optimistic reactions
- [ ] Copy image URL button
- [ ] Copy Markdown/HTML embed code
- [ ] Share button / Web Share API
- [ ] Better empty states
- [ ] Better loading states
- [ ] Confirm-before-destructive-action dialogs

## Infrastructure

- [ ] Regenerate and commit `pnpm-lock.yaml` after dependency changes
- [ ] Add realtime integration tests
- [ ] Add image upload/proxy tests
- [ ] Add profile-link tests
- [ ] Add reaction API tests
- [x] Add migration CI check
- [ ] Background job system
- [ ] Image processing queue
- [ ] Storage abstraction
    - [ ] Local filesystem
    - [ ] S3-compatible storage
- [ ] Automated database backups
- [ ] Health/readiness endpoints
- [ ] Metrics dashboard
- [ ] Structured audit logging
- [ ] Security headers
- [ ] CSP
- [ ] CSRF protection
- [ ] Automated dependency updates

## Posts

- [ ] Edit post
- [ ] Delete post
- [ ] Hide/unhide post
- [ ] Draft posts
- [ ] Post visibility
    - [ ] Public
    - [ ] Unlisted
    - [ ] Private
- [ ] Scheduled publishing
- [ ] Post revision history

## Discovery

- [ ] Full-text search
- [ ] Search filters
    - [ ] User
    - [ ] Tag
    - [ ] Category
    - [ ] Date
    - [ ] MIME type
- [ ] Tag autocomplete
- [ ] Related posts
- [ ] Trending/popular posts
- [ ] Recently viewed posts

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

## Architecture

- [ ] Replace runtime `esm.sh` MUI dependencies with local bundling
- [ ] Introduce frontend build pipeline
- [ ] Add browser HMR/live reload
- [ ] Define frontend component architecture
- [ ] Define API/client state conventions
- [ ] Consolidate duplicated client-side code
- [ ] Add end-to-end tests
- [ ] Add accessibility regression tests
- [ ] Add performance regression tests