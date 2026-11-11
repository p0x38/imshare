# External uploaders

## ShareX

Import [`imshare.sxcu`](imshare.sxcu) from ShareX's custom uploader settings. Replace the request URL with your imshare host and set the `Authorization` header to a personal API token with the `uploads: write` permission.

The uploader sends one image in the `file` multipart field to `POST /api/v1/uploads`. On success, the response contains the uploaded image URL at `data.url`; ShareX copies that URL. Uploading media does not create an imshare post.

The `.sxcu` file contains a token placeholder. Do not put a real token in a shared or committed uploader configuration.

## PostyBirb

PostyBirb's **Custom Website** integration can send files to imshare:

1. Create an API token with the `uploads: write` permission.
2. Add a Custom Website account in PostyBirb. Set its File URL to `https://your-imshare.example/api/v1/uploads?multiple=true&client=postybirb`.
3. Add the header `Authorization: Bearer YOUR_IMSHARE_API_TOKEN` and keep the file field name as `file`.
4. Set the custom file batch limit to 20 or less. Leave the thumbnail field unset.

The endpoint accepts PostyBirb's default `title`, `description`, `tags`, and `rating` fields, along with per-file metadata, and responds with HTTP 200 after storing the images. It stores the image files in imshare's upload library; it does not create imshare posts or import PostyBirb metadata. PostyBirb's custom website documentation is [here](https://github.com/mvdicarlo/postybirb/blob/main/docs/CUSTOM_WEBSITE.md).

## Other clients

Clients that can send authenticated `multipart/form-data` requests can use `POST /api/v1/uploads` with a `file` field and a token granted `uploads: write`. They should read the returned `data.url` field.
