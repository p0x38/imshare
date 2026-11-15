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
