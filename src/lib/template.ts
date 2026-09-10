import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "public");
export type TemplateData = Record<string, string | number | boolean | null | undefined>;

export async function renderTemplate(file: string, data: TemplateData = {}): Promise<string> {
  let template = await readFile(path.join(ROOT, file), "utf8");
  template = await expandPartials(template, data);
  return renderValues(template, data);
}

async function expandPartials(template: string, data: TemplateData): Promise<string> {
  const matches = [...template.matchAll(/{{>\s*([A-Za-z0-9_.\/-]+)\s*}}/g)];
  for (const match of matches) template = template.replace(match[0], await renderPartial(`partials/${match[1]}.html`, data));
  return template;
}

export async function renderPartial(file: string, data: TemplateData = {}): Promise<string> {
  let template = await readFile(path.join(ROOT, file), "utf8");
  template = await expandPartials(template, data);
  return renderValues(template, data);
}

function renderValues(template: string, data: TemplateData): string {
  return template.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_, key: string) => escapeHtml(String(data[key] ?? "")));
}
function escapeHtml(value: string): string { return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }
