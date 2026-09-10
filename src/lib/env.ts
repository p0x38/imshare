import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured in .env.`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: required("BETTER_AUTH_URL"),
};
