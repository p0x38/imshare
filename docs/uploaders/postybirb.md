# PostyBirb

imshare supports PostyBirb through its Custom Website integration.

## Setup

1. Create an API token with `uploads: write`.
2. Add a Custom Website account in PostyBirb.
3. Configure the following settings:

| Setting            | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| File URL           | `https://your-imshare.example/api/v1/uploads?multiple=true&client=postybirb` |
| Method             | POST                                                                         |
| File field         | `file`                                                                       |
| Authorization      | `Bearer YOUR_IMSHARE_API_TOKEN`                                              |
| Thumbnail field    | Leave unset                                                                  |
| Maximum batch size | 20                                                                           |

## Compatibility

The `client=postybirb` parameter enables compatibility with PostyBirb's metadata fields and returns HTTP `200 OK` on successful uploads.

PostyBirb metadata is accepted but is not imported into imshare posts. Uploaded images are stored in the user's upload library.

See the [PostyBirb Custom Website documentation](https://github.com/mvdicarlo/postybirb/blob/main/docs/CUSTOM_WEBSITE.md).

See [API Reference](api-reference.md) for upload details.
