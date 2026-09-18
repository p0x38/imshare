import { metrics } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader, type MetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { FastifyInstance, FastifyRequest } from "fastify";

export interface ObservabilityConfig {
    enabled?: boolean;
    prometheus?: { enabled?: boolean; path?: string };
    openTelemetry?: { enabled?: boolean; endpoint?: string; exportIntervalMs?: number };
    serviceName?: string;
    serviceVersion?: string;
}

export interface ObservabilityRuntime {
    readonly meterProvider: MeterProvider | null;
    readonly sdk: NodeSDK | null;
    readonly prometheusPath: string | null;
    shutdown(): Promise<void>;
}

declare module "fastify" {
    interface FastifyInstance { observability: ObservabilityRuntime; }
}

const PROMETHEUS_DEFAULT_PATH = "/metrics";

export async function setupObservability(
    app: FastifyInstance,
    config: ObservabilityConfig | undefined,
): Promise<ObservabilityRuntime> {
    if (config?.enabled !== true) {
        return { meterProvider: null, sdk: null, prometheusPath: null, async shutdown() {} };
    }

    const serviceName = config.serviceName?.trim() || "imshare";
    const serviceVersion = config.serviceVersion?.trim();
    const resource = defaultResource().merge(resourceFromAttributes({
        "service.name": serviceName,
        ...(serviceVersion ? { "service.version": serviceVersion } : {}),
    }));

    const prometheusEnabled = config.prometheus?.enabled === true;
    const prometheusPath = prometheusEnabled
        ? normalizeMetricsPath(config.prometheus?.path)
        : null;
    const prometheusExporter = prometheusEnabled
        ? new PrometheusExporter({ endpoint: prometheusPath ?? PROMETHEUS_DEFAULT_PATH })
        : null;

    const readers: MetricReader[] = prometheusExporter ? [prometheusExporter] : [];
    const otlpEndpoint = config.openTelemetry?.enabled === true
        ? config.openTelemetry.endpoint?.trim()
        : undefined;

    if (otlpEndpoint) {
        readers.push(new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
            exportIntervalMillis: Math.max(1000, config.openTelemetry?.exportIntervalMs ?? 10_000),
        }));
    }

    const meterProvider = new MeterProvider({ resource, readers });
    metrics.setGlobalMeterProvider(meterProvider);
    const meter = meterProvider.getMeter("imshare", serviceVersion);

    const requestCount = meter.createCounter("imshare_http_requests_total", {
        description: "Total number of completed HTTP requests.",
    });
    const requestDuration = meter.createHistogram("imshare_http_request_duration_seconds", {
        description: "HTTP request duration in seconds.", unit: "s",
    });
    const activeRequests = meter.createUpDownCounter("imshare_http_active_requests", {
        description: "Number of HTTP requests currently being processed.",
    });

    const processUptime = meter.createObservableGauge("imshare_process_uptime_seconds", {
        description: "Process uptime in seconds.", unit: "s",
    });
    processUptime.addCallback((result) => result.observe(process.uptime()));

    const processMemory = meter.createObservableGauge("imshare_process_memory_bytes", {
        description: "Process resident and heap memory in bytes.", unit: "By",
    });
    processMemory.addCallback((result) => {
        const memory = process.memoryUsage();
        result.observe(memory.rss, { area: "rss" });
        result.observe(memory.heapUsed, { area: "heap_used" });
        result.observe(memory.heapTotal, { area: "heap_total" });
    });

    const processCpu = meter.createObservableCounter("imshare_process_cpu_seconds_total", {
        description: "Process CPU time in seconds.", unit: "s",
    });
    processCpu.addCallback((result) => {
        const cpu = process.cpuUsage();
        result.observe((cpu.user + cpu.system) / 1_000_000);
    });

    const requestStarted = new WeakMap<FastifyRequest, bigint>();
    app.addHook("onRequest", async (request) => {
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (pathname === prometheusPath) return;
        activeRequests.add(1);
        requestStarted.set(request, process.hrtime.bigint());
    });

    app.addHook("onResponse", async (request, reply) => {
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (pathname === prometheusPath) return;
        activeRequests.add(-1);
        const startedAt = requestStarted.get(request);
        if (startedAt === undefined) return;
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const labels = {
            method: request.method,
            route: request.routeOptions?.url ?? pathname,
            status_code: String(reply.statusCode),
        };
        requestCount.add(1, labels);
        requestDuration.record(durationSeconds, labels);
    });

    const sdk = config.openTelemetry?.enabled === true
        ? new NodeSDK({ resource, spanProcessors: [], instrumentations: [new HttpInstrumentation()] })
        : null;
    if (sdk) sdk.start();

    if (prometheusExporter && prometheusPath) {
        app.get(prometheusPath, async (_request, reply) => {
            const response = await prometheusExporter.getMetricsRequestHandler;
            void response;
            reply.type("text/plain; version=0.0.4").send(await collectPrometheusMetrics(prometheusExporter));
        });
    }

    return {
        meterProvider,
        sdk,
        prometheusPath,
        async shutdown() {
            const errors: unknown[] = [];
            if (sdk) try { await sdk.shutdown(); } catch (error) { errors.push(error); }
            try { await meterProvider.shutdown(); } catch (error) { errors.push(error); }
            if (errors.length > 0) throw errors[0];
        },
    };
}

async function collectPrometheusMetrics(exporter: PrometheusExporter): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const response = {
            statusCode: 200,
            headers: {},
            setHeader() {},
            write(chunk: string | Buffer) { chunks.push(Buffer.from(chunk)); },
            end(chunk?: string | Buffer) { if (chunk) chunks.push(Buffer.from(chunk)); resolve(Buffer.concat(chunks).toString("utf8")); },
        } as never;
        try { exporter.getMetricsRequestHandler({} as never, response); } catch (error) { reject(error); }
    });
}

function normalizeMetricsPath(value: string | undefined): string {
    const path = value?.trim() || PROMETHEUS_DEFAULT_PATH;
    return path.startsWith("/") ? path : `/${path}`;
}
