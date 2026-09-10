import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ServerConfig {
  server: {
    host: string;
    port: number;
  };
  storage: {
    uploadDirectory: string;
    maxFileSize: number;
  };
  site: {
    name: string;
    version: string;
  };
}

const configPath = path.resolve(process.cwd(), "config.json");

export async function loadConfig(): Promise<ServerConfig> {
  const content = await readFile(configPath, "utf8");
  const config: unknown = JSON.parse(content);

  if (!isServerConfig(config)) {
    throw new Error(`Invalid server configuration: ${configPath}`);
  }

  return config;
}

function isServerConfig(value: unknown): value is ServerConfig {
  if (!value || typeof value !== "object") return false;

  const config = value as Record<string, unknown>;
  const server = config.server;
  const storage = config.storage;
  const site = config.site;

  return (
    isObject(server) &&
    typeof server.host === "string" &&
    typeof server.port === "number" &&
    Number.isInteger(server.port) &&
    server.port > 0 &&
    server.port <= 65535 &&
    isObject(storage) &&
    typeof storage.uploadDirectory === "string" &&
    storage.uploadDirectory.length > 0 &&
    typeof storage.maxFileSize === "number" &&
    Number.isInteger(storage.maxFileSize) &&
    storage.maxFileSize > 0 &&
    isObject(site) &&
    typeof site.name === "string" &&
    typeof site.version === "string"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
