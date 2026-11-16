# External Uploaders

imshare supports external applications through its authenticated image upload API.

## Supported applications

| Application   | Integration               | Documentation                     |
| ------------- | ------------------------- | --------------------------------- |
| ShareX        | Custom uploader (`.sxcu`) | [ShareX](sharex.md)               |
| PostyBirb     | Custom Website            | [PostyBirb](postybirb.md)         |
| Other clients | Multipart HTTP API        | [API Reference](api-reference.md) |

## Requirements

- ShareX and image-upload clients require an API token with `uploads: write`.
- PostyBirb's Notification URL requires `posts: write`.
- PostyBirb's File URL requires both `posts: write` and `uploads: write`.
- To use both PostyBirb URLs with one token, grant it both permissions.

See the individual guides for configuration instructions.
