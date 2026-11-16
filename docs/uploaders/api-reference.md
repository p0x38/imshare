# Upload API Reference

## Endpoint

`POST /api/v1/uploads`

| Property            | Value               |
| ------------------- | ------------------- |
| Method              | POST                |
| Content-Type        | multipart/form-data |
| File field          | `file`              |
| Authentication      | Bearer token        |
| Required permission | `uploads: write`    |

## Supported formats

JPEG, PNG, GIF, WebP, BMP, and AVIF.

Files are validated against their extension, MIME type, file signature, and configured maximum size.

## Single upload

```bash
curl -X POST \
  "https://your-imshare.example/api/v1/uploads" \
  -H "Authorization: Bearer YOUR_IMSHARE_API_TOKEN" \
  -F "file=@image.png"
```

Returns HTTP `201 Created`:

```json
{
    "data": {
        "id": "UPLOAD_ID",
        "url": "/uploads/...",
        "filename": "...",
        "mimeType": "image/png"
    }
}
```

## Multiple uploads

Add `?multiple=true` to the endpoint.

```bash
curl -X POST \
  "https://your-imshare.example/api/v1/uploads?multiple=true" \
  -H "Authorization: Bearer YOUR_IMSHARE_API_TOKEN" \
  -F "file=@first.png" \
  -F "file=@second.jpg"
```

Supports up to 20 files per request.

The response contains an array of uploaded files under `data`.

## Errors

| Status | Description                         |
| ------ | ----------------------------------- |
| 400    | Missing or invalid image            |
| 401    | Invalid, disabled, or expired token |
| 403    | Insufficient token permissions      |
| 413    | File exceeds configured size limit  |
| 500    | Upload processing failed            |

## Notes

- Uploads are stored in the authenticated user's upload library.
- Uploading files does not automatically create posts.
- The `data.url` field contains the uploaded image URL.

## PostyBirb image-post creation

`POST /api/v1/posts/postybirb`

| Property             | Value                            |
| -------------------- | -------------------------------- |
| Method               | POST                             |
| Content-Type         | multipart/form-data              |
| File field           | `file`                           |
| Authentication       | Bearer token                     |
| Required permissions | `posts: write`, `uploads: write` |
| Maximum files        | 20                               |
| Success status       | `200 OK`                         |

### Fields

| Field           | Required | Description                                                 |
| --------------- | -------- | ----------------------------------------------------------- |
| `title`         | Yes      | Post title                                                  |
| `description`   | No       | HTML description converted to plain text                    |
| `tags`          | No       | Comma-separated tags                                        |
| `rating`        | No       | Content rating; defaults to `GENERAL`                       |
| `file`          | Yes      | Image file, repeatable up to 20 times                       |
| `altText[n]`    | No       | Alt text associated with image index `n`                    |
| `sourceUrls[n]` | No       | Source URL associated with image index `n`; may be repeated |

One request creates one image post containing all submitted files.

### Query parameters

| Parameter    | Values                          | Default   |
| ------------ | ------------------------------- | --------- |
| `status`     | `draft`, `published`            | `draft`   |
| `visibility` | `public`, `unlisted`, `private` | `private` |

### Example

```bash
curl -X POST \
  "https://your-imshare.example/api/v1/posts/postybirb" \
  -H "Authorization: Bearer YOUR_IMSHARE_API_TOKEN" \
  -F "title=Example image post" \
  -F "description=<p>Example description</p>" \
  -F "tags=example,postybirb" \
  -F "rating=GENERAL" \
  -F "file=@first.png" \
  -F "file=@second.png" \
  -F "altText[0]=First image" \
  -F "sourceUrls[0]=https://example.com/source"
```

Returns HTTP `200 OK` with the created post ID, URL, status, visibility, and associated uploads.

## PostyBirb text-post creation

`POST /api/v1/posts/notification`

| Property            | Value               |
| ------------------- | ------------------- |
| Method              | POST                |
| Content-Type        | multipart/form-data |
| Authentication      | Bearer token        |
| Required permission | `posts: write`      |
| Success status      | `200 OK`            |

### Fields

| Field         | Required | Description                                     |
| ------------- | -------- | ----------------------------------------------- |
| `title`       | Yes      | Post title                                      |
| `description` | Yes      | Text content, converted from HTML to plain text |
| `tags`        | No       | Comma-separated tags                            |
| `rating`      | No       | Content rating; defaults to `GENERAL`           |

The Notification URL does not accept image files.

It supports the same `status` and `visibility` query parameters as the image-post endpoint.

## Additional errors

| Status | Description                                                                   |
| ------ | ----------------------------------------------------------------------------- |
| 400    | Invalid fields, duplicate fields, unsupported file field, or invalid metadata |
| 409    | Image already attached to a post, or duplicate image in the batch             |
| 413    | File or multipart field exceeds configured limits                             |
| 415    | Request is not multipart/form-data                                            |
