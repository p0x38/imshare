import type { FastifyInstance, FastifyRequest } from "fastify";

export interface ObservabilityConfig {
    enabled?: boolean;
    prometheus?: {
        enabled?: boolean;
        path?: string;
    };
    openTelemetry?: {
        enabled?: boolean;
        endpoint?: string;
        exportIntervalMs?: number;
    };
}

type Labels = Record<string, string | number | boolean>;

interface Series {
    value: number;
    labels: Record<string, string>;
}

interface HistogramSeries extends Series {
    buckets: number[];
    sum: number;
    count: number;
}

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const DESCRIPTIONS: Record<string, string> = {
    imshare_http_requests_total: "Total number of completed HTTP requests.",
    imshare_http_request_duration_seconds: "HTTP request duration in seconds.",
    imshare_http_active_requests: "Number of HTTP requests currently being processed.",
    imshare_process_uptime_seconds: "Process uptime in seconds.",
    imshare_process_memory_bytes: "Process resident and heap memory in bytes.",
    imshare_process_cpu_seconds_total: "Process CPU time in seconds.",
};

function labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("\u0000");
}

function normalizeLabels(labels: Labels): Record<string, string> {
    return Object.fromEntries(
        Object.entries(labels)
            .filter(([, value]) => value !== undefined && value !== null)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, String(value)]),
    );
}

function escapePrometheusLabel(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n");
}

function renderLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (!entries.length) return "";
    return `{${entries.map(([key, value]) => `${key}="${escapePrometheusLabel(value)}"`).join(",")}}`;
}

function nowUnixNano(): string {
    return String(BigInt(Date.now()) * 1_000_000n);
}

function attributes(labels: Record<string, string>) {
    return Object.entries(labels).map(([key, value]) => ({
        key,
        value: { stringValue: value },
    }));
}

export class MetricsRegistry {
    private readonly counters = new Map<string, Map<string, Series>>();
    private readonly gauges = new Map<string, Map<string, Series>>();
    private readonly histograms = new Map<string, Map<string, HistogramSeries>>();
    private readonly counterDescriptions = new Map<string, string>();
    private readonly gaugeDescriptions = new Map<string, string>();
    private readonly histogramDescriptions = new Map<string, string>();
    private readonly processStartTimeNano = String(BigInt(Date.now()) * 1_000_000n);

    counter(name: string, value = 1, labels: Labels = {}, description?: string): void {
        const normalized = normalizeLabels(labels);
        const series = this.getSeries(this.counters, name, normalized);
        series.value += value;
        if (description) this.counterDescriptions.set(name, description);
    }

    gauge(name: string, value: number, labels: Labels = {}, description?: string): void {
        const normalized = normalizeLabels(labels);
        const series = this.getSeries(this.gauges, name, normalized);
        series.value = value;
        if (description) this.gaugeDescriptions.set(name, description);
    }

    histogram(name: string, value: number, labels: Labels = {}, description?: string): void {
        const normalized = normalizeLabels(labels);
        const key = labelsKey(normalized);
        let metric = this.histograms.get(name);
        if (!metric) {
            metric = new Map();
            this.histograms.set(name, metric);
        }
        let series = metric.get(key);
        if (!series) {
            series = {
                value: 0,
                labels: normalized,
                buckets: Array(HISTOGRAM_BUCKETS.length).fill(0),
                sum: 0,
                count: 0,
            };
            metric.set(key, series);
        }
        series.count += 1;
        series.sum += value;
        for (let index = 0; index < HISTOGRAM_BUCKETS.length; index += 1) {
            if (value <= HISTOGRAM_BUCKETS[index]!) series.buckets[index] += 1;
        }
        if (description) this.histogramDescriptions.set(name, description);
    }

    recordHttpRequest(
        method: string,
        route: string,
        statusCode: number,
        durationMs: number,
    ): void {
        const labels = {
            method: method.toUpperCase(),
            route: route || "unknown",
            status_code: statusCode,
        };
        this.counter("imshare_http_requests_total", 1, labels, DESCRIPTIONS.imshare_http_requests_total);
        this.histogram(
            "imshare_http_request_duration_seconds",
            Math.max(0, durationMs) / 1000,
            labels,
            DESCRIPTIONS.imshare_http_request_duration_seconds,
        );
    }

    setActiveRequests(value: number): void {
        this.gauge(
            "imshare_http_active_requests",
            Math.max(0, value),
            {},
            DESCRIPTIONS.imshare_http_active_requests,
        );
    }

    updateRuntimeMetrics(): void {
        const memory = process.memoryUsage();
        const cpu = process.cpuUsage();
        this.gauge(
            "imshare_process_uptime_seconds",
            process.uptime(),
            {},
            DESCRIPTIONS.imshare_process_uptime_seconds,
        );
        this.gauge(
            "imshare_process_memory_bytes",
            memory.rss,
            { area: "rss" },
            DESCRIPTIONS.imshare_process_memory_bytes,
        );
        this.gauge(
            "imshare_process_memory_bytes",
            memory.heapUsed,
            { area: "heap_used" },
            DESCRIPTIONS.imshare_process_memory_bytes,
        );
        this.gauge(
            "imshare_process_memory_bytes",
            memory.heapTotal,
            { area: "heap_total" },
            DESCRIPTIONS.imshare_process_memory_bytes,
        );
        this.gauge(
            "imshare_process_cpu_seconds_total",
            (cpu.user + cpu.system) / 1_000_000,
            {},
            DESCRIPTIONS.imshare_process_cpu_seconds_total,
        );
    }

    toPrometheus(): string {
        this.updateRuntimeMetrics();
        const lines: string[] = [];

        for (const [name, metric] of this.counters) {
            lines.push(`# HELP ${name} ${this.counterDescriptions.get(name) ?? DESCRIPTIONS[name] ?? name}`);
            lines.push(`# TYPE ${name} counter`);
            for (const series of metric.values())
                lines.push(`${name}${renderLabels(series.labels)} ${series.value}`);
        }

        for (const [name, metric] of this.gauges) {
            lines.push(`# HELP ${name} ${this.gaugeDescriptions.get(name) ?? DESCRIPTIONS[name] ?? name}`);
            lines.push(`# TYPE ${name} gauge`);
            for (const series of metric.values())
                lines.push(`${name}${renderLabels(series.labels)} ${series.value}`);
        }

        for (const [name, metric] of this.histograms) {
            lines.push(`# HELP ${name} ${this.histogramDescriptions.get(name) ?? DESCRIPTIONS[name] ?? name}`);
            lines.push(`# TYPE ${name} histogram`);
            for (const series of metric.values()) {
                for (let index = 0; index < HISTOGRAM_BUCKETS.length; index += 1) {
                    const labels = {
                        ...series.labels,
                        le: String(HISTOGRAM_BUCKETS[index]),
                    };
                    lines.push(`${name}_bucket${renderLabels(labels)} ${series.buckets[index]}`);
                }
                lines.push(`${name}_bucket${renderLabels({ ...series.labels, le: "+Inf" })} ${series.count}`);
                lines.push(`${name}_sum${renderLabels(series.labels)} ${series.sum}`);
                lines.push(`${name}_count${renderLabels(series.labels)} ${series.count}`);
            }
        }

        return `${lines.join("\n")}\n`;
    }

    toOtlpJson(serviceName = "imshare") {
        this.updateRuntimeMetrics();
        const metrics: Array<Record<string, unknown>> = [];

        for (const [name, metric] of this.counters) {
            metrics.push({
                name,
                description: this.counterDescriptions.get(name) ?? DESCRIPTIONS[name],
                sum: {
                    aggregationTemporality: 2,
                    isMonotonic: true,
                    dataPoints: Array.from(metric.values()).map((series) => ({
                        attributes: attributes(series.labels),
                        startTimeUnixNano: this.processStartTimeNano,
                        timeUnixNano: nowUnixNano(),
                        asDouble: series.value,
                    })),
                },
            });
        }

        for (const [name, metric] of this.gauges) {
            metrics.push({
                name,
                description: this.gaugeDescriptions.get(name) ?? DESCRIPTIONS[name],
                gauge: {
                    dataPoints: Array.from(metric.values()).map((series) => ({
                        attributes: attributes(series.labels),
                        timeUnixNano: nowUnixNano(),
                        asDouble: series.value,
                    })),
                },
            });
        }

        for (const [name, metric] of this.histograms) {
            metrics.push({
                name,
                description: this.histogramDescriptions.get(name) ?? DESCRIPTIONS[name],
                unit: "s",
                histogram: {
                    aggregationTemporality: 2,
                    dataPoints: Array.from(metric.values()).map((series) => ({
                        attributes: attributes(series.labels),
                        startTimeUnixNano: this.processStartTimeNano,
                        timeUnixNano: nowUnixNano(),
                        count: String(series.count),
                        sum: series.sum,
                        bucketCounts: series.buckets.map((value, index) =>
                            String(
                                value -
                                    (index === 0 ? 0 : series.buckets[index - 1]!)
                            ),
                        ),
                        explicitBounds: HISTOGRAM_BUCKETS,
                    })),
                },
            });
        }

        return {
            resourceMetrics: [
                {
                    resource: {
                        attributes: [
                            { key: "service.name", value: { stringValue: serviceName } },
                        ],
                    },
                    scopeMetrics: [
                        {
                            scope: { name: "imshare" },
                            metrics,
                        },
                    ],
                },
            ],
        };
    }

    private getSeries(
        collection: Map<string, Map<string, Series>>,
        name: string,
        labels: Record<string, string>,
    ): Series {
        let metric = collection.get(name);
        if (!metric) {
            metric = new Map();
            collection.set(name, metric);
        }
        const key = labelsKey(labels);
        let series = metric.get(key);
        if (!series) {
            series = { value: 0, labels };
            metric.set(key, series);
        }
        return series;
    }
}

export interface ObservabilityRuntime {
    readonly metrics: MetricsRegistry;
    readonly prometheusPath: string | null;
    shutdown(): Promise<void>;
}

export function setupObservability(
    app: FastifyInstance,
    config: ObservabilityConfig | undefined,
): ObservabilityRuntime {
    const enabled = config?.enabled === true;
    const prometheusEnabled = enabled && config?.prometheus?.enabled === true;
    const prometheusPath = prometheusEnabled
        ? normalizeMetricsPath(config?.prometheus?.path)
        : null;
    const otlpEnabled = enabled && config?.openTelemetry?.enabled === true;
    const otlpEndpoint = otlpEnabled ? config?.openTelemetry?.endpoint?.trim() : undefined;
    const intervalMs = Math.max(1000, config?.openTelemetry?.exportIntervalMs ?? 10_000);
    const metrics = new MetricsRegistry();
    let activeRequests = 0;
    const requestStarted = new WeakMap<FastifyRequest, number>();

    app.addHook("onRequest", async (request) => {
        if (request.url.split("?", 1)[0] === prometheusPath) return;
        activeRequests += 1;
        metrics.setActiveRequests(activeRequests);
        requestStarted.set(request, Date.now());
    });

    app.addHook("onResponse", async (request, reply) => {
        if (request.url.split("?", 1)[0] === prometheusPath) return;
        activeRequests = Math.max(0, activeRequests - 1);
        metrics.setActiveRequests(activeRequests);
        const startedAt = requestStarted.get(request);
        if (startedAt === undefined) return;
        const route = request.routeOptions?.url ?? request.url.split("?", 1)[0] ?? "unknown";
        metrics.recordHttpRequest(request.method, route, reply.statusCode, Date.now() - startedAt);
    });

    if (prometheusPath) {
        app.get(prometheusPath, async (_request, reply) => {
            reply
                .code(200)
                .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                .send(metrics.toPrometheus());
        });
    }

    let timer: NodeJS.Timeout | undefined;
    if (otlpEndpoint) {
        timer = setInterval(() => void exportOtlp(otlpEndpoint, metrics), intervalMs);
        timer.unref();
        void exportOtlp(otlpEndpoint, metrics);
    }

    return {
        metrics,
        prometheusPath,
        async shutdown() {
            if (timer) clearInterval(timer);
            if (otlpEndpoint) await exportOtlp(otlpEndpoint, metrics);
        },
    };
}

async function exportOtlp(endpoint: string, metrics: MetricsRegistry): Promise<void> {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(metrics.toOtlpJson()),
        });
        if (!response.ok) {
            console.warn(`OpenTelemetry metrics export failed: HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn(
            `OpenTelemetry metrics export failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

function normalizeMetricsPath(value: string | undefined): string {
    const path = value?.trim() || "/metrics";
    if (!path.startsWith("/")) return `/${path}`;
    return path;
}
