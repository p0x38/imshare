import { loadConfig } from "../lib/config.js";
import { getCacheSettings, pruneCacheDirectory, resolveCacheDirectory } from "../lib/cache.js";

const config = await loadConfig();
const settings = getCacheSettings(config);
const cacheDirectory = resolveCacheDirectory(config);
const removed = await pruneCacheDirectory(cacheDirectory, settings.ttl);

console.log(`Removed ${removed} expired cache entr${removed === 1 ? "y" : "ies"} from ${cacheDirectory}`);
