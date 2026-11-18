import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, type CliIO } from "../src/cli/command.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => rm(directory, { recursive: true, force: true })),
    );
});

async function createConfigFile(content = validConfig): Promise<string> {
    const directory = await mkdtemp(path.join(tmpdir(), "imshare-cli-"));
    temporaryDirectories.push(directory);
    const configPath = path.join(directory, "config.imshare");
    await writeFile(configPath, content, "utf8");
    return configPath;
}

function createIO(
    env: NodeJS.ProcessEnv = {},
): CliIO & { stdoutText: () => string; stderrText: () => string } {
    let stdout = "";
    let stderr = "";

    return {
        cwd: process.cwd(),
        env,
        stdout: { write: (value) => (stdout += value) },
        stderr: { write: (value) => (stderr += value) },
        stdoutText: () => stdout,
        stderrText: () => stderr,
    };
}

const validConfig = `
server {
    host = "127.0.0.1"
    port = 5454
}

storage {
    maxFileSize = 25MiB
}

site {
    name = "imshare test"
    version = "1.0.0"
}

auth {
    registration {
        enabled = true
        public = false
        manualApproval = false
    }
}
`;

describe("imshare-cli config commands", () => {
    it("validates a configuration file", async () => {
        const configPath = await createConfigFile();
        const io = createIO();

        const exitCode = await runCli(["config", "validate", "--config", configPath], io);

        expect(exitCode).toBe(0);
        expect(io.stdoutText()).toContain("Configuration syntax is valid.");
        expect(io.stdoutText()).toContain("All checks passed.");
        expect(io.stderrText()).toBe("");
    });

    it("shows a property and its source", async () => {
        const configPath = await createConfigFile();
        const io = createIO();

        const exitCode = await runCli(
            ["config", "show", "server.port", "--config", configPath],
            io,
        );

        expect(exitCode).toBe(0);
        expect(io.stdoutText()).toContain("Key: server.port");
        expect(io.stdoutText()).toContain("Value: 5454");
        expect(io.stdoutText()).toContain("Source: file");
    });

    it("lists default and environment-sourced values", async () => {
        const configPath = await createConfigFile();
        const io = createIO({ IMSHARE__SERVER__PORT: "5555" });

        const exitCode = await runCli(["config", "list", "--config", configPath], io);
        const output = io.stdoutText();

        expect(exitCode).toBe(0);
        expect(output).toContain("server.port: 5555 [*] (env: IMSHARE__SERVER__PORT)");
        expect(output).toContain('server.host: "127.0.0.1"');
        expect(output).toContain("admin.local.enabled: true [!] (default)");
    });

    it("prints a resolved path even when the config file does not exist", async () => {
        const directory = await mkdtemp(path.join(tmpdir(), "imshare-cli-path-"));
        temporaryDirectories.push(directory);
        const io = createIO();

        const exitCode = await runCli(["config", "path", "--config", "missing.imshare"], {
            ...io,
            cwd: directory,
        });

        expect(exitCode).toBe(0);
        expect(io.stdoutText()).toBe(path.join(directory, "missing.imshare") + "\n");
    });

    it("reports DSL syntax errors with their source position", async () => {
        const configPath = await createConfigFile("server {\n    port = 10XB\n}\n");
        const io = createIO();

        const exitCode = await runCli(["config", "validate", "--config", configPath], io);

        expect(exitCode).toBe(1);
        expect(io.stderrText()).toMatch(/line 2, column/);
    });

    it("rejects unknown properties and unknown environment overrides", async () => {
        const configPath = await createConfigFile();
        const showIO = createIO();
        const invalidEnvIO = createIO({ IMSHARE__SERVER__UNKNOWN_VALUE: "true" });

        expect(
            await runCli(["config", "show", "server.missing", "--config", configPath], showIO),
        ).toBe(1);
        expect(showIO.stderrText()).toContain("Unknown configuration property");

        expect(await runCli(["config", "validate", "--config", configPath], invalidEnvIO)).toBe(1);
        expect(invalidEnvIO.stderrText()).toContain("IMSHARE__SERVER__UNKNOWN_VALUE");
    });
});
