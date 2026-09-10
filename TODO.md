# imshare TODO

## Core interactions

- [x] Likes
- [x] Favorites
- [x] Saves
- [x] Realtime post reaction events
- [x] Notifications for new reactions and other user events
- [x] Commenting

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
- [x] Shared client-side API helper
- [ ] Shared components / partials
- [ ] Template engine evaluation
- [ ] Better error pages
- [ ] Infinite scroll or pagination controls

## Infrastructure

- [ ] Regenerate and commit `pnpm-lock.yaml` after dependency changes
- [ ] Add realtime integration tests
- [ ] Add image upload/proxy tests
- [ ] Add profile-link tests
- [ ] Add reaction API tests
- [x] Add migration CI check
