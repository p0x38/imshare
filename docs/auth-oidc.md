# OpenID Connect authentication

imshare supports an optional OpenID Connect provider through Better Auth's Generic OAuth plugin.

## Configuration

Set these environment variables on the server:

```dotenv
OIDC_PROVIDER_ID="oidc"
OIDC_CLIENT_ID="..."
OIDC_CLIENT_SECRET="..."
OIDC_DISCOVERY_URL="https://issuer.example.com/.well-known/openid-configuration"
```

All four variables are optional as a group. If none are configured, the normal email/password authentication remains unchanged. If any OIDC variable is configured, `OIDC_PROVIDER_ID`, `OIDC_CLIENT_ID`, and `OIDC_DISCOVERY_URL` must all be present.

`OIDC_CLIENT_SECRET` may be omitted for a public OAuth client when the identity provider supports a public-client token exchange.

## Provider callback

With imshare's Better Auth base path of `/api/v1/auth`, register this callback URL with the identity provider:

```text
https://your-imshare-host.example/api/v1/auth/callback/<OIDC_PROVIDER_ID>
```

Better Auth's current Generic OAuth implementation uses `/callback/:providerId` and the configured auth base URL for this callback. PKCE and OIDC issuer/ID-token verification are enabled by the current plugin by default when the discovery document provides the required metadata.

## Browser flow

When OIDC is configured, the login and registration pages display **Continue with OpenID Connect**. The browser starts Better Auth's standard `signIn.social` flow and returns to `/dashboard/` after authentication.

The browser receives only the provider ID through `/api/v1/config`; the client ID, client secret, and discovery URL remain server-side.

## Provider requirements

The discovery document should provide a usable authorization endpoint and token exchange. For OIDC identity-token verification, it should also advertise a `jwks_uri` and issuer metadata.

Provider-specific claims or non-standard user profiles may require additional Generic OAuth configuration in `src/lib/openid.ts`.
