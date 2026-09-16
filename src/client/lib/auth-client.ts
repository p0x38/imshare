import { createAuthClient } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: `${window.location.origin}/api/v1/auth`,
    plugins: [genericOAuthClient()],
});
