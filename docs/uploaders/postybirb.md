# PostyBirb

imshare supports PostyBirb's Custom Website integration for image-post publishing and text-only ost creation.

See the [PostyBirb Custom Website documentation](https://github.com/mvdicarlo/postybirb/blob/main/docs/CUSTOM_WEBSITE.md) for details about its integration.

## Authentication

Create an API token with:

- `posts: write` for post creation
- `uploads: write` for image uploads

Both permissions are required for the File URL. The Notification URL requires only `posts: write`.

## File URL: Image posts

| Setting            | Value                                                 |
| ------------------ | ----------------------------------------------------- |
| File URL           | `https://your-imshare.example/api/v1/posts/postybirb` |
| Method             | `POST`                                                |
| File field         | `file`                                                |
| Authorization      | `Bearer YOUR_IMSHARE_API_TOKEN`                       |
| Alt text field     | `altText`                                             |
| Source URLs field  | `sourceUrls`                                          |
| Thumbnail field    | Leave unset                                           |
| Maximum batch size | `20`                                                  |

Each File URL request creates one image post containing the submitted batch.

PostyBirb's `title`, `description`, `tags`, and `rating` fields are imported. Per-image `altTextn]` and `sourceUrls[n]` fields are associated with their corresponding images.

Descriptions are converted from HTML to plain text. Alt text and source URLs are preserved with ach image.

## Notification URL: Text-only posts

| Setting           | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Notification URL  | `https://your-imshare.example/api/v1/posts/notification` |
| Method            | `POST`                                                   |
| Authorization     | `Bearer YOUR_IMSHARE_API_TOKEN`                          |
| Title field       | `title`                                                  |
| Description field | `description`                                            |
| Tag field         | `tags`                                                   |
| Rating field      | `rating`                                                 |

The Notification URL creates a text-only post. It does not upload or attach images.

## Publication settings

Both endpoints support query parameters:

| Parameter    | Allowed values                  | Default   |
| ------------ | ------------------------------- | --------- |
| `status`     | `draft`, `published`            | `draft`   |
| `visibility` | `public`, `unlisted`, `private` | `private` |

For immediate public publishing, append:

`?status=published&visibility=public`

Be careful when enabling automatic public publishing.

The rating field maps `GENERAL` to `isNSFW: false`. Other rating values map to `isNSFW: true`.

## Important behavior

- File URL submissions create image posts, not unattached uploads.
- Notification URL submissions create text posts.
- Each File URL batch becomes one post.
- The two submission flows do not automatically combine into the same post.
- The regular `/api/v1/uploads` endpoint remains available for upload-only clients.
- An image already attached to a post cannot be attached again through this integration.

Successful PostyBirb submissions return HTTP `200 OK`.

See [API Reference](api-reference.md) for endpoint details.
