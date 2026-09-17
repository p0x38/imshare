import { createAuthClient } from "better-auth/client";
import { genericOAuthClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: `${window.location.origin}/api/v1/auth`,
    plugins: [
        genericOAuthClient(),
        twoFactorClient({
            twoFactorPage: "/account/two-factor/",
        }),
    ],
});
