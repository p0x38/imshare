import { parseArgs } from "node:util";
import { ConfigDslError } from "../lib/config-dsl.js";
import { runConfigCommand } from "./config.js";

export interface CliIO {
    stdout: { write(value: string): unknown };
    stderr: { write(value: string): unknown };
    cwd: string;
    env: NodeJS.ProcessEnv;
}

const defaultIO: CliIO = {
    stdout: process.stdout,
    stderr: process.stderr,
    cwd: process.cwd(),
    env: process.env,
};

function printHelp(io: CliIO): void {
    io.stdout.write(
        [
            "imshare-cli",
            "",
            "Usage: imshare-cli <command> [options]",
            "",
            "Commands:",
            "  config  Inspect and validate the imshare configuration",
            "",
            "Global options:",
            "  -c, --config <path>  Use a specific configuration file",
            "  -h, --help           Show help",
        ].join("\n") + "\n",
    );
}

export async function runCli(argv = process.argv.slice(2), io: CliIO = defaultIO): Promise<number> {
    try {
        const parsed = parseArgs({
            args: argv,
            options: {
                config: { type: "string", short: "c" },
                help: { type: "boolean", short: "h" },
            },
            allowPositionals: true,
            strict: true,
        });

        if (parsed.values.help) {
            if (parsed.positionals[0] === "config") {
                return await runConfigCommand(undefined, [], parsed.values.config, io);
            }

            printHelp(io);
            return 0;
        }

        if (parsed.positionals.length === 0) {
            printHelp(io);
            return 0;
        }

        const [group, command, ...args] = parsed.positionals;
        if (group !== "config") {
            throw new Error(`Unknown command: ${group}. Run 'imshare-cli --help' for usage.`);
        }

        return await runConfigCommand(command, args, parsed.values.config, io);
    } catch (error) {
        if (error instanceof ConfigDslError) {
            const detail = error.message.replace(/^Config error at \d+:\d+: /, "");
            io.stderr.write(
                `Configuration syntax error at line ${error.line}, column ${error.column}: ${detail}\n`,
            );
        } else {
            io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        }
        return 1;
    }
}
