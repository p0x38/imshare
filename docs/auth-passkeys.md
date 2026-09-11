# Passkeys / WebAuthn deployment notes

Passkeys are handled by the application authentication layer, not by Caddy itself.

For imshare, the important deployment requirements are:

- The public authentication origin must be HTTPS.
- Keep one stable public hostname for the site.
- Caddy should reverse-proxy that hostname to the Fastify server on `127.0.0.1:5454`.
- Do not expose the Fastify port directly to the Internet.
- The WebAuthn relying-party ID should normally be the public hostname, without a scheme or port.
- The WebAuthn origin must exactly match the HTTPS site origin.

The current authentication configuration in `src/lib/auth.ts` uses Better Auth with email/password. Passkeys should be added there as an authentication plugin rather than implemented as a Caddy feature.

Before enabling passkeys, configure the production `auth.baseUrl` to the actual HTTPS origin instead of the development `http://localhost:5454` value.
