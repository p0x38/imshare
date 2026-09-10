# imshare TODO

## Core interactions

- [x] Likes
- [x] Favorites
- [x] Saves
- [x] Realtime post reaction events
- [x] Notifications for new reactions and other user events
- [ ] Commenting
    - [x] Create a comment
    - [ ] Edit a comment
    - [ ] Remove a comment (commenter or original image poster himself)
    - [ ] Likes
- [ ] Report abuse stuff
- [ ] Recommended for you (or recommended sidebar on invididual pages such as post, category, and tag page)
- [ ] Image caption stuff (under the image on post page)
- [ ] Accessibility support (incase)
- [ ] Ability to download the image (if image creator allows)

## Profiles

- [x] Extensible profile links
- [x] Server-generated default avatar
- [x] Initials/text avatar
- [x] Identicon avatar
- [x] Gravatar support
- [x] Custom avatar reference
- [x] Profile settings UI for avatar mode and links
- [x] Profile banner / accent color

## Images and uploads

- [x] Content-hashed stored image filenames
- [x] Thumbnail resizing through Sharp
- [x] WebP/AVIF output support
- [x] Lazy-loaded post thumbnails
- [x] Lazy-loaded post images
- [x] Upload progress indicator
- [x] Persistent transformed-image cache
- [ ] Background thumbnail generation
- [x] Upload cancellation
- [x] Multiple-file uploads
- [x] Duplicate-content deduplication at the database layer
- [ ] Updated pages
    - [ ] Profile page
        - [ ] Customizable Widgets (Prebuilt / Community / Custom)
            - [ ] Basic information (Join date, total views, description and etc)
            - [ ] Recent posts
            - [ ] Popular posts

## Realtime

- [x] Socket.IO server
- [x] Post rooms
- [x] Reaction broadcasts
- [x] Presence / online state
- [ ] Live upload status
- [x] Server-side notification events

## Frontend

- [x] Dark mode via system preference
- [x] Responsive image sizes
    - [ ] "Fit" thumbnail, or just scale it to 64 ~ 128 px around for grid stuff
    - [ ] Use thumbhash while loading if possible (https://evanw.github.io/thumbhash/)
- [ ] Add some pages (or just add it on navigation bar)
    - [ ] About (or version of the webapp)
    - [ ] FAQ?
    - [ ] GitHub (i guess, need to warn people that the project uses AI)
- [x] Shared client-side API helper
- [ ] Shared components / partials
- [ ] Template engine evaluation
- [ ] Better error pages
    - [ ] Make some well-known error pages (suc as 404, 500, 400, 403, 401, and 429)
- [ ] Add rate-limits
    - [ ] Upload limits (30 per day)
    - [ ] View rate limit (50 ~ 75+ per minute followed by server performance i guess)
- [ ] Infinite scroll or pagination controls
- [ ] Unification of header and footer
- [ ] SEO / OpenGraph stuff for each pages

## Infrastructure

- [ ] Regenerate and commit `pnpm-lock.yaml` after dependency changes
- [ ] Add realtime integration tests
- [ ] Add image upload/proxy tests
- [ ] Add profile-link tests
- [ ] Add reaction API tests
- [x] Add migration CI check
