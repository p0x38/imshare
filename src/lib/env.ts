import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} must be configured in .env.`);
    }
    return value;
}

function optional(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

function optionalPort(name: string): number | undefined {
    const value = optional(name);
    if (!value) return undefined;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`${name} must be a valid TCP port.`);
    }
    return port;
}

export const env = {
    databaseUrl: required("DATABASE_URL"),
    betterAuthSecret: required("BETTER_AUTH_SECRET"),
    smtp: {
        host: optional("SMTP_HOST"),
        port: optionalPort("SMTP_PORT"),
        secure: optional("SMTP_SECURE") === "true",
        user: optional("SMTP_USER"),
        password: optional("SMTP_PASSWORD"),
        from: optional("SMTP_FROM"),
    },
    push: {
        publicKey: optional("VAPID_PUBLIC_KEY"),
        privateKey: optional("VAPID_PRIVATE_KEY"),
        subject: optional("VAPID_SUBJECT"),
    },
};
