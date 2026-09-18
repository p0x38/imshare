import { loadConfigSync } from "./lib/config.js";
import {
    createObservability,
    type ObservabilityRuntime,
} from "./lib/observability.js";

const config = loadConfigSync();

export const observability: ObservabilityRuntime = createObservability(
    config.observability,
    config.site.name,
    config.site.version,
);
