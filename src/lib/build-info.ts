import { execFileSync } from "node:child_process";

export interface BuildInfo {
    commitHash: string;
    commitMessage: string;
}

function git(command: string[]): string {
    try {
        return execFileSync("git", command, {
            cwd: process.cwd(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "";
    }
}

export function getBuildInfo(): BuildInfo {
    return {
        commitHash: git(["rev-parse", "HEAD"]) || "unknown",
        commitMessage: git(["log", "-1", "--pretty=%s"]) || "unknown",
    };
}
