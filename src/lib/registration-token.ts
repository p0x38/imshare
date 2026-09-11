import { createHmac } from "node:crypto";

import { env } from "./env.js";

export const REGISTRATION_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function getRegistrationToken(now = Date.now()): { token: string; expiresAt: number } {
  const bucket = Math.floor(now / REGISTRATION_TOKEN_TTL_MS);
  const token = createHmac("sha256", env.betterAuthSecret)
    .update(`imshare-registration:${bucket}`)
    .digest("base64url")
    .slice(0, 24);

  return {
    token,
    expiresAt: (bucket + 1) * REGISTRATION_TOKEN_TTL_MS,
  };
}

export function isValidRegistrationToken(token: unknown, now = Date.now()): boolean {
  return typeof token === "string" && token === getRegistrationToken(now).token;
}
