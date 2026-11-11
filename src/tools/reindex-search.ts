import { prisma } from "../lib/auth.js";
import { rebuildMeilisearchIndex } from "../lib/meilisearch.js";

try {
    await rebuildMeilisearchIndex();
    console.log("Meilisearch index rebuilt successfully.");
} finally {
    await prisma.$disconnect();
}
