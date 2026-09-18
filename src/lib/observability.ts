import { metrics, trace, type Meter } from "@opentelemetry/api";
import { OTLPLogExporter as OTLPLogGrpcExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { OTLPLogExporter as OTLPLogProtoExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter as OTLPMetricGrpcExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPMetricExporter as OTLPMetricProtoExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter as OTLPTraceGrpcExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPTraceExporter as OTLPTraceProtoExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import {
    BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
    MeterProvider,
    PeriodicExportingMetricReader,
    type MetricReader,
} from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
    BatchSpanProcessor,
    ParentBasedSampler,
    TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import type { FastifyInstance, FastifyRequest } from "fastify";

export type OtlpProtocol = "grpc" | "http/protobuf";

export interface OtlpExporterConfig {
    enabled?: boolean;
    endpoint?: string;
    protocol?: OtlpProtocol;
}

export interface ObservabilityConfig {
    enabled?: boolean;
    serviceName?: string;
    serviceVersion?: string;
    environment?: string;
    instanceId?: string;
    batch?: {
        exportIntervalMs?: number;
        maxExportBatchSize?: number;
        maxQueueSize?: number;
    };
    traces?: {
        enabled?: boolean;
        endpoint?: string;
        protocol?: OtlpProtocol;
        samplingRatio?: number;
    };
    metrics?: {
        enabled?: boolean;
        exportIntervalMs?: number;
        prometheus?: {
            enabled?: boolean;
            path?: string;
        };
        otlp?: OtlpExporterConfig;
    };
    logs?: {
        enabled?: boolean;
        includeTraceContext?: boolean;
        otlp?: OtlpExporterConfig;
    };
}

interface MetricHandles {
    requestCount: ReturnType<Meter["createCounter"]>;
    requestDuration: ReturnType<Meter["createHistogram"]>;
    responseSize: ReturnType<Meter["createHistogram"]>;
    activeRequests: ReturnType<Meter["createUpDownCounter"]>;
    processUptime: ReturnType<Meter["createObservableGauge"]>;
    processMemory: ReturnType<Meter["createObservableGauge"]>;
    processCpu: ReturnType<Meter["createObservableCounter"]>;
    postsCreated: ReturnType<Meter["createCounter"]>;
    postsDeleted: ReturnType<Meter["createCounter"]>;
    textsCreated: ReturnType<Meter["createCounter"]>;
    postViews: ReturnType<Meter["createCounter"]>;
    commentsCreated: ReturnType<Meter["createCounter"]>;
    reactions: ReturnType<Meter["createCounter"]>;
    follows: ReturnType<Meter["createCounter"]>;
    reports: ReturnType<Meter["createCounter"]>;
    notifications: ReturnType<Meter["createCounter"]>;
    usersRegistered: ReturnType<Meter["createCounter"]>;
    authAttempts: ReturnType<Meter["createCounter"]>;
    apiErrors: ReturnType<Meter["createCounter"]>;
    permissionDenials: ReturnType<Meter["createCounter"]>;
    csrfRejections: ReturnType<Meter["createCounter"]>;
    rateLimitHits: ReturnType<Meter["createCounter"]>;
    uploadBytes: ReturnType<Meter["createCounter"]>;
    uploads: ReturnType<Meter["createCounter"]>;
    uploadDuration: ReturnType<Meter["createHistogram"]>;
    imageServed: ReturnType<Meter["createCounter"]>;
    imageTransformations: ReturnType<Meter["createCounter"]>;
    imageProcessingDuration: ReturnType<Meter["createHistogram"]>;
    imageProcessingErrors: ReturnType<Meter["createCounter"]>;
    realtimeConnections: ReturnType<Meter["createUpDownCounter"]>;
    realtimeConnectionEvents: ReturnType<Meter["createCounter"]>;
    realtimeMessages: ReturnType<Meter["createCounter"]>;
    realtimeErrors: ReturnType<Meter["createCounter"]>;
    registeredUsers: ReturnType<Meter["createObservableGauge"]>;
    publishedPosts: ReturnType<Meter["createObservableGauge"]>;
    pendingReports: ReturnType<Meter["createObservableGauge"]>;
}

export interface ObservabilityRuntime {
    readonly enabled: boolean;
    readonly meterProvider: MeterProvider | null;
    readonly sdk: NodeSDK | null;
    readonly prometheusPath: string | null;
    register(app: FastifyInstance): void;
    recordUpload(size: number, mimeType: string): void;
    recordDatabaseQuery(durationSeconds: number, operation: string): void;
    recordDatabaseError(operation: string): void;
    recordRealtimeConnection(delta: 1 | -1): void;
    recordRealtimeConnectionEvent(event: "connected" | "disconnected"): void;
    recordRealtimeMessage(event: string): void;
    recordRealtimeError(): void;
    recordRateLimitHit(scope: string): void;
    shutdown(): Promise<void>;
}

declare module "fastify" {
    interface FastifyInstance {
        observability: ObservabilityRuntime;
    }
}

let activeMetricHandles: MetricHandles | null = null;

const DEFAULTS = {
    exportIntervalMs: 15_000,
    maxExportBatchSize: 512,
    maxQueueSize: 2_048,
    samplingRatio: 1,
};

export function createObservability(
    config: ObservabilityConfig | undefined,
    fallbackServiceName: string,
    fallbackServiceVersion: string,
): ObservabilityRuntime {
    if (config?.enabled !== true) {
        return disabledRuntime();
    }

    const serviceName = config.serviceName?.trim() || fallbackServiceName || "imshare";
    const serviceVersion =
        config.serviceVersion?.trim() || fallbackServiceVersion || undefined;
    const resource = defaultResource().merge(
        resourceFromAttributes({
            "service.name": serviceName,
            ...(serviceVersion ? { "service.version": serviceVersion } : {}),
            ...(config.environment?.trim()
                ? { "deployment.environment.name": config.environment.trim() }
                : {}),
            ...(config.instanceId?.trim()
                ? { "service.instance.id": config.instanceId.trim() }
                : {}),
        }),
    );

    const batch = {
        exportIntervalMs: Math.max(
            1_000,
            config.batch?.exportIntervalMs ?? DEFAULTS.exportIntervalMs,
        ),
        maxExportBatchSize: Math.max(
            1,
            config.batch?.maxExportBatchSize ?? DEFAULTS.maxExportBatchSize,
        ),
        maxQueueSize: Math.max(
            1,
            config.batch?.maxQueueSize ?? DEFAULTS.maxQueueSize,
        ),
    };

    const metricsEnabled = config.metrics?.enabled === true;
    const prometheusEnabled =
        metricsEnabled && config.metrics?.prometheus?.enabled === true;
    const prometheusPath = prometheusEnabled
        ? normalizeMetricsPath(config.metrics?.prometheus?.path)
        : null;
    const prometheusExporter = prometheusEnabled
        ? new PrometheusExporter({
              endpoint: prometheusPath ?? "/metrics",
              preventServerStart: true,
          })
        : null;

    const metricReaders: MetricReader[] = [];
    if (prometheusExporter) metricReaders.push(prometheusExporter);

    const metricOtlp = metricsEnabled ? config.metrics?.otlp : undefined;
    if (metricOtlp?.enabled === true && metricOtlp.endpoint?.trim()) {
        metricReaders.push(
            new PeriodicExportingMetricReader({
                exporter: createMetricExporter(
                    metricOtlp.protocol ?? "http/protobuf",
                    metricOtlp.endpoint,
                ),
                exportIntervalMillis: Math.max(
                    1_000,
                    config.metrics?.exportIntervalMs ?? batch.exportIntervalMs,
                ),
            }),
        );
    }

    const meterProvider =
        metricsEnabled && metricReaders.length > 0
            ? new MeterProvider({ resource, readers: metricReaders })
            : null;
    if (meterProvider) metrics.setGlobalMeterProvider(meterProvider);

    const metricHandles = meterProvider
        ? createMetricHandles(
              meterProvider.getMeter("imshare", serviceVersion),
          )
        : null;

    const tracesEnabled = config.traces?.enabled === true;
    const traceEndpoint = tracesEnabled ? config.traces?.endpoint?.trim() : undefined;
    const logsEnabled = config.logs?.enabled === true;
    const logsExporterConfig = logsEnabled ? config.logs?.otlp : undefined;
    const logsEndpoint =
        logsExporterConfig?.enabled === true
            ? logsExporterConfig.endpoint?.trim()
            : undefined;

    let sdk: NodeSDK | null = null;

    if (tracesEnabled || logsEndpoint) {
        const spanProcessors = [];
        if (traceEndpoint) {
            const samplingRatio = clamp(
                config.traces?.samplingRatio ?? DEFAULTS.samplingRatio,
                0,
                1,
            );
            spanProcessors.push(
                new BatchSpanProcessor(
                    createTraceExporter(
                        config.traces?.protocol ?? "http/protobuf",
                        traceEndpoint,
                    ),
                    {
                        maxExportBatchSize: batch.maxExportBatchSize,
                        maxQueueSize: batch.maxQueueSize,
                        scheduledDelayMillis: batch.exportIntervalMs,
                    },
                ),
            );

            const instrumentations = [
                new HttpInstrumentation(),
                ...(logsEndpoint
                    ? [
                          new PinoInstrumentation({
                              disableLogCorrelation:
                                  config.logs?.includeTraceContext === false,
                          }),
                      ]
                    : []),
            ];

            sdk = new NodeSDK({
                resource,
                sampler: new ParentBasedSampler({
                    root: new TraceIdRatioBasedSampler(samplingRatio),
                }),
                spanProcessors,
                logRecordProcessors: logsEndpoint
                    ? [
                          new BatchLogRecordProcessor({
                              exporter: createLogExporter(
                                  logsExporterConfig?.protocol ?? "http/protobuf",
                                  logsEndpoint,
                              ),
                              maxExportBatchSize: batch.maxExportBatchSize,
                              maxQueueSize: batch.maxQueueSize,
                              scheduledDelayMillis: batch.exportIntervalMs,
                          }),
                      ]
                    : [],
                instrumentations,
            });
        } else {
            sdk = new NodeSDK({
                resource,
                logRecordProcessors: [
                    new BatchLogRecordProcessor({
                        exporter: createLogExporter(
                            logsExporterConfig?.protocol ?? "http/protobuf",
                            logsEndpoint!,
                        ),
                        maxExportBatchSize: batch.maxExportBatchSize,
                        maxQueueSize: batch.maxQueueSize,
                        scheduledDelayMillis: batch.exportIntervalMs,
                    }),
                ],
                instrumentations: [
                    ...(logsEndpoint
                        ? [
                              new PinoInstrumentation({
                                  disableLogCorrelation:
                                      config.logs?.includeTraceContext === false,
                              }),
                          ]
                        : []),
                ],
            });
        }

        sdk.start();
    }

    const requestStarted = new WeakMap<FastifyRequest, bigint>();

    return {
        enabled: true,
        meterProvider,
        sdk,
        prometheusPath,
        register(app) {
            if (metricHandles) {
                registerMetricHooks(app, metricHandles, requestStarted, prometheusPath);
            }

            if (prometheusExporter && prometheusPath) {
                app.get(prometheusPath, async (request, reply) => {
                    reply.hijack();
                    prometheusExporter.getMetricsRequestHandler(
                        request.raw,
                        reply.raw,
                    );
                });
            }
        },
        async shutdown() {
            const errors: unknown[] = [];

            if (sdk) {
                try {
                    await sdk.shutdown();
                } catch (error) {
                    errors.push(error);
                }
            }

            if (meterProvider) {
                try {
                    await meterProvider.shutdown();
                } catch (error) {
                    errors.push(error);
                }
            }

            if (errors.length > 0) throw errors[0];
        },
    };
}

function createMetricHandles(meter: Meter): MetricHandles {
    const requestCount = meter.createCounter("imshare_http_requests_total", {
        description: "Total number of completed HTTP requests.",
    });
    const requestDuration = meter.createHistogram(
        "imshare_http_request_duration_seconds",
        {
            description: "HTTP request duration in seconds.",
            unit: "s",
        },
    );
    const activeRequests = meter.createUpDownCounter(
        "imshare_http_active_requests",
        {
            description: "Number of HTTP requests currently being processed.",
        },
    );
    const processUptime = meter.createObservableGauge(
        "imshare_process_uptime_seconds",
        {
            description: "Process uptime in seconds.",
            unit: "s",
        },
    );
    processUptime.addCallback((result) => result.observe(process.uptime()));

    const processMemory = meter.createObservableGauge(
        "imshare_process_memory_bytes",
        {
            description: "Process resident and heap memory in bytes.",
            unit: "By",
        },
    );
    processMemory.addCallback((result) => {
        const memory = process.memoryUsage();
        result.observe(memory.rss, { area: "rss" });
        result.observe(memory.heapUsed, { area: "heap_used" });
        result.observe(memory.heapTotal, { area: "heap_total" });
    });

    const processCpu = meter.createObservableCounter(
        "imshare_process_cpu_seconds_total",
        {
            description: "Process CPU time in seconds.",
            unit: "s",
        },
    );
    processCpu.addCallback((result) => {
        const cpu = process.cpuUsage();
        result.observe((cpu.user + cpu.system) / 1_000_000);
    });

    return {
        requestCount,
        requestDuration,
        activeRequests,
        processUptime,
        processMemory,
        processCpu,
    };
}

function registerMetricHooks(
    app: FastifyInstance,
    metricsSet: MetricHandles,
    requestStarted: WeakMap<FastifyRequest, bigint>,
    prometheusPath: string | null,
): void {
    app.addHook("onRequest", async (request) => {
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (pathname === prometheusPath) return;
        metricsSet.activeRequests.add(1);
        requestStarted.set(request, process.hrtime.bigint());
    });

    app.addHook("onResponse", async (request, reply) => {
        const pathname = request.url.split("?", 1)[0] ?? "/";
        if (pathname === prometheusPath) return;
        metricsSet.activeRequests.add(-1);

        const startedAt = requestStarted.get(request);
        if (startedAt === undefined) return;

        const durationSeconds =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const labels = {
            method: request.method,
            route: request.routeOptions?.url ?? pathname,
            status_code: String(reply.statusCode),
        };

        metricsSet.requestCount.add(1, labels);
        metricsSet.requestDuration.record(durationSeconds, labels);
    });
}

function createTraceExporter(
    protocol: OtlpProtocol,
    endpoint: string,
) {
    return protocol === "grpc"
        ? new OTLPTraceGrpcExporter({ url: normalizeGrpcEndpoint(endpoint) })
        : new OTLPTraceProtoExporter({ url: normalizeHttpEndpoint(endpoint) });
}

function createMetricExporter(
    protocol: OtlpProtocol,
    endpoint: string,
) {
    return protocol === "grpc"
        ? new OTLPMetricGrpcExporter({ url: normalizeGrpcEndpoint(endpoint) })
        : new OTLPMetricProtoExporter({ url: normalizeHttpEndpoint(endpoint) });
}

function createLogExporter(
    protocol: OtlpProtocol,
    endpoint: string,
) {
    return protocol === "grpc"
        ? new OTLPLogGrpcExporter({ url: normalizeGrpcEndpoint(endpoint) })
        : new OTLPLogProtoExporter({ url: normalizeHttpEndpoint(endpoint) });
}

function normalizeGrpcEndpoint(endpoint: string): string {
    const value = endpoint.trim();
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        const url = new URL(value);
        return `${url.protocol}//${url.host}`;
    }
    return `http://${value}`;
}

function normalizeHttpEndpoint(endpoint: string): string {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(endpoint.trim())) return endpoint.trim();
    return `http://${endpoint.trim()}`;
}

function normalizeMetricsPath(value: string | undefined): string {
    const path = value?.trim() || "/metrics";
    return path.startsWith("/") ? path : `/${path}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function disabledRuntime(): ObservabilityRuntime {
    return {
        enabled: false,
        meterProvider: null,
        sdk: null,
        prometheusPath: null,
        register() {},
        async shutdown() {},
    };
}
