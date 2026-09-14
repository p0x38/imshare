import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildApp } from "./app.js";

const outputPath = path.resolve(process.cwd(), "openapi.json");
const app = await buildApp();

try {
    await app.ready();
    const document = app.swagger();
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    console.log(`OpenAPI document written to ${outputPath}`);
} finally {
    await app.close();
}
