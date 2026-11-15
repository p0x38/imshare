# External Uploaders

imshare supports external applications through its authenticated image upload API.

## Supported applications

| Application   | Integration               | Documentation                     |
| ------------- | ------------------------- | --------------------------------- |
| ShareX        | Custom uploader (`.sxcu`) | [ShareX](sharex.md)               |
| PostyBirb     | Custom Website            | [PostyBirb](postybirb.md)         |
| Other clients | Multipart HTTP API        | [API Reference](api-reference.md) |

## Requirements

All integrations require an API token with the `uploads: write` permission.

See the individual guides for configuration instructions.
