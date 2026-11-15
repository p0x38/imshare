# ShareX

imshare supports ShareX through its custom uploader configuration.

## Installation

1. Open ShareX.
2. Navigate to **Destinations → Custom uploader settings**.
3. Import [`sharex.sxcu`](sharex.sxcu).
4. Replace `https://your-imshare.example` with your imshare server URL.
5. Replace `YOUR_IMSHARE_API_TOKEN` with your API token.
6. Select ImShare as your image uploader.

## Configuration

| Setting             | Value             |
| ------------------- | ----------------- |
| Method              | POST              |
| Endpoint            | `/api/v1/uploads` |
| File field          | `file`            |
| Authentication      | Bearer token      |
| Required permission | `uploads: write`  |
| Response URL        | `data.url`        |

## Security

Never share or commit a configuration containing a real API token.

See [API Reference](api-reference.md) for upload details.
