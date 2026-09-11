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

## Infrastructure

- [ ] Regenerate and commit `pnpm-lock.yaml` after dependency changes
- [ ] Add realtime integration tests
- [ ] Add image upload/proxy tests
- [ ] Add profile-link tests
- [ ] Add reaction API tests
- [x] Add migration CI check
