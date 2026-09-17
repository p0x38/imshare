import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: `${window.location.origin}/api/v1/auth`,
    plugins: [
        twoFactorClient({
            twoFactorPage: "/account/?twoFactor=1",
        }),
    ],
});
