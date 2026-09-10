import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "public");

export type TemplateData = Record<string, string | number | boolean | null | undefined>;

export async function renderTemplate(file: string, data: TemplateData = {}): Promise<string> {
  const template = await readFile(path.join(ROOT, file), "utf8");
  return template.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_, key: string) =>
    escapeHtml(String(data[key] ?? "")),
  );
}

export async function renderPartial(file: string, data: TemplateData = {}): Promise<string> {
  return renderTemplate(file, data);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
