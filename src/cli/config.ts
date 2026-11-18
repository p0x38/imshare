import {
    loadConfigSnapshot,
    resolveConfigPath,
    type ConfigSnapshot,
    type ConfigValueSource,
} from "../lib/config.js";

export interface ConfigCommandIO {
    stdout: { write(value: string): unknown };
    stderr: { write(value: string): unknown };
    cwd: string;
    env: NodeJS.ProcessEnv;
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return JSON.stringify(value);
    if (value === undefined) return "undefined";
    return JSON.stringify(value) ?? String(value);
}

function formatSource(source: ConfigValueSource | undefined): string {
    if (source?.type === "environment") return ` [*] (env: ${source.name})`;
    if (source?.type === "default") return " [!] (default)";
    return "";
}

function flattenValues(value: unknown, prefix = ""): Array<[string, unknown]> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return prefix ? [[prefix, value]] : [];
    }

    return Object.entries(value).flatMap(([key, child]) =>
        flattenValues(child, prefix ? `${prefix}.${key}` : key),
    );
}

function getProperty(value: unknown, propertyPath: string): unknown {
    const segments = propertyPath.split(".");

    if (
        segments.some(
            (segment) => !segment || ["__proto__", "prototype", "constructor"].includes(segment),
        )
    ) {
        throw new Error(`Invalid property path: ${propertyPath}`);
    }

    let current: unknown = value;

    for (const segment of segments) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            throw new Error(`Unknown configuration property: ${propertyPath}`);
        }

        if (!Object.prototype.hasOwnProperty.call(current, segment)) {
            throw new Error(`Unknown configuration property: ${propertyPath}`);
        }

        current = (current as Record<string, unknown>)[segment];
    }

    if (current === undefined) {
        throw new Error(`Configuration property is not set: ${propertyPath}`);
    }

    return current;
}

async function loadSnapshot(
    configFile: string | undefined,
    io: ConfigCommandIO,
): Promise<ConfigSnapshot> {
    const configPath = resolveConfigPath(configFile, io.cwd, io.env);
    return loadConfigSnapshot(configPath, io.env);
}

export async function runConfigCommand(
    command: string | undefined,
    args: string[],
    configFile: string | undefined,
    io: ConfigCommandIO,
): Promise<number> {
    if (!command || command === "--help" || command === "-h") {
        io.stdout.write(
            [
                "Usage: imshare-cli config <command> [options]",
                "",
                "Commands:",
                "  validate             Validate the configuration file",
                "  show <propertyPath>  Show one effective configuration value",
                "  list                 List effective configuration values and their sources",
                "  path                 Show the resolved configuration file path",
                "",
                "Options:",
                "  -c, --config <path>  Use a specific configuration file",
            ].join("\n") + "\n",
        );
        return 0;
    }

    if (command === "path") {
        if (args.length) throw new Error("Usage: imshare-cli config path [--config <path>]");
        io.stdout.write(resolveConfigPath(configFile, io.cwd, io.env) + "\n");
        return 0;
    }

    switch (command) {
        case "validate": {
            if (args.length)
                throw new Error("Usage: imshare-cli config validate [--config <path>]");
            await loadSnapshot(configFile, io);
            io.stdout.write(`✓ Configuration syntax is valid.\n`);
            io.stdout.write(`✓ Configuration values are valid.\n`);
            io.stdout.write(`✓ All checks passed.\n`);
            return 0;
        }

        case "show": {
            if (args.length !== 1) {
                throw new Error("Usage: imshare-cli config show <propertyPath> [--config <path>]");
            }

            const snapshot = await loadSnapshot(configFile, io);
            const propertyPath = args[0]!;
            const value = getProperty(snapshot.config, propertyPath);
            const source = snapshot.sources[propertyPath];

            io.stdout.write(`Key: ${propertyPath}\n`);
            io.stdout.write(`Value: ${formatValue(value)}\n`);
            if (source?.type === "environment") {
                io.stdout.write(`Source: environment (${source.name})\n`);
            } else {
                io.stdout.write(`Source: ${source?.type ?? "unknown"}\n`);
            }
            return 0;
        }

        case "list": {
            if (args.length) throw new Error("Usage: imshare-cli config list [--config <path>]");
            const snapshot = await loadSnapshot(configFile, io);

            for (const [propertyPath, value] of flattenValues(snapshot.config)) {
                io.stdout.write(
                    `${propertyPath}: ${formatValue(value)}${formatSource(snapshot.sources[propertyPath])}\n`,
                );
            }
            return 0;
        }

        default:
            throw new Error(
                `Unknown config command: ${command}. Run 'imshare-cli config --help' for usage.`,
            );
    }
}
