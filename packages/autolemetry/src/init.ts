/**
 * Simplified initialization for autolemetry
 *
 * Single init() function with sensible defaults.
 * Replaces initInstrumentation() and separate analytics config.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  resourceFromAttributes,
  type Resource,
} from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { Sampler } from './sampling';
import { AdaptiveSampler } from './sampling';
import type { AnalyticsAdapter } from './analytics-adapter';
import type { Logger } from './logger-types';
import type { Attributes } from '@opentelemetry/api';
import type { ValidationConfig } from './validation';
import {
  PeriodicExportingMetricReader,
  type MetricReader,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { TailSamplingSpanProcessor } from './tail-sampling-processor';

// Lazy-load getNodeAutoInstrumentations to preserve optional peer dependency
// This will be loaded at runtime when integrations option is used (not at module load time)
// This ensures it works correctly in ESM contexts and monorepo setups
let getNodeAutoInstrumentations:
  | ((config?: Record<string, unknown>) => unknown[])
  | undefined;

const AUTO_INSTRUMENTATIONS_NOT_FOUND = 'AUTO_INSTRUMENTATIONS_NOT_FOUND';

class AutoInstrumentationsNotFoundError extends Error {
  readonly code: typeof AUTO_INSTRUMENTATIONS_NOT_FOUND =
    AUTO_INSTRUMENTATIONS_NOT_FOUND;
}

/**
 * Default silent logger (no-op) when user doesn't provide one
 */
const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

export interface AutolemetryConfig {
  /** Service name (required) */
  service: string;

  /** Business analytics adapters - bring your own (PostHog, Mixpanel, etc.) */
  adapters?: AnalyticsAdapter[];

  /**
   * Additional OpenTelemetry instrumentations to register.
   * Useful when you want HTTP/Prisma/etc auto instrumentation alongside
   * the functional helpers.
   */
  instrumentations?: NodeSDKConfiguration['instrumentations'];

  /**
   * Simple integration names for auto-instrumentation.
   * Uses @opentelemetry/auto-instrumentations-node (peer dependency).
   *
   * @example Enable specific integrations
   * ```typescript
   * init({
   *   service: 'my-app',
   *   integrations: ['express', 'pino', 'http']
   * })
   * ```
   *
   * @example Enable all integrations
   * ```typescript
   * init({
   *   service: 'my-app',
   *   integrations: true  // Enable all
   * })
   * ```
   *
   * @example Configure specific integrations
   * ```typescript
   * init({
   *   service: 'my-app',
   *   integrations: {
   *     express: { enabled: true },
   *     pino: { enabled: true },
   *     http: { enabled: false }
   *   }
   * })
   * ```
   */
  integrations?: string[] | boolean | Record<string, { enabled?: boolean }>;

  /**
   * OTLP endpoint for traces/metrics/logs
   * Only used if you don't provide custom exporters/processors
   * @default process.env.OTLP_ENDPOINT || 'http://localhost:4318'
   */
  endpoint?: string;

  /**
   * Custom span processor for traces
   * Allows you to use any backend: Jaeger, Zipkin, Datadog, New Relic, etc.
   * If not provided, defaults to OTLP with tail sampling
   *
   * @example Jaeger
   * ```typescript
   * import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
   * import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
   *
   * init({
   *   service: 'my-app',
   *   spanProcessor: new BatchSpanProcessor(new JaegerExporter())
   * })
   * ```
   *
   * @example Console (dev)
   * ```typescript
   * import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
   *
   * init({
   *   service: 'my-app',
   *   spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter())
   * })
   * ```
   */
  spanProcessor?: SpanProcessor;

  /**
   * Custom span exporter for traces (alternative to spanProcessor)
   * Provide either spanProcessor OR spanExporter, not both
   * If provided, will be wrapped in TailSamplingSpanProcessor + BatchSpanProcessor
   *
   * @example Zipkin
   * ```typescript
   * import { ZipkinExporter } from '@opentelemetry/exporter-zipkin'
   *
   * init({
   *   service: 'my-app',
   *   spanExporter: new ZipkinExporter({ url: 'http://localhost:9411/api/v2/spans' })
   * })
   * ```
   */
  spanExporter?: SpanExporter;

  /**
   * Custom metric reader (advanced). Defaults to OTLP metrics exporter when
   * metrics are enabled.
   */
  metricReader?: MetricReader;

  /**
   * Custom log record processors. When omitted, logs are not configured.
   */
  logRecordProcessors?: LogRecordProcessor[];

  /** Additional resource attributes to merge with defaults. */
  resourceAttributes?: Attributes;

  /** Provide a fully custom Resource to merge (advanced use case). */
  resource?: Resource;

  /**
   * Headers for default OTLP exporters. Accepts either an object map or
   * a "key=value" comma separated string.
   */
  otlpHeaders?: Record<string, string> | string;

  /**
   * Optional factory to build a customised NodeSDK instance from our defaults.
   */
  sdkFactory?: (defaults: Partial<NodeSDKConfiguration>) => NodeSDK;

  /**
   * Infrastructure metrics configuration
   * - true: always enabled (default)
   * - false: always disabled
   * - 'auto': always enabled (same as true)
   *
   * Can be overridden with AUTOTELEMETRY_METRICS=on|off env var
   */
  metrics?: boolean | 'auto';

  /** Sampling strategy (default: AdaptiveSampler with 10% baseline) */
  sampler?: Sampler;

  /** Service version (default: auto-detect from package.json or '1.0.0') */
  version?: string;

  /** Environment (default: process.env.NODE_ENV || 'development') */
  environment?: string;

  /**
   * Logger instance for internal logging (4-method interface: info/warn/error/debug)
   * - Default: silent logger (no-op)
   * - Use createLogger() for our opinionated Pino adapter with trace context
   * - Use createWinstonLogger() for Winston adapter
   * - Inject your own: Pino, Winston, or any logger with 4 methods
   *
   * OpenTelemetry approach: simple abstraction, user choice
   *
   * @example Using our Pino adapter
   * ```typescript
   * import { createLogger, init } from 'autolemetry'
   *
   * const logger = createLogger('my-app', { level: 'debug' })
   * init({ service: 'my-app', logger })
   * ```
   *
   * @example Injecting your own Pino instance
   * ```typescript
   * import pino from 'pino'
   * import { init } from 'autolemetry'
   *
   * const logger = pino({ ... }) // Your existing Pino config
   * init({ service: 'my-app', logger }) // Pino has our 4 methods
   * ```
   *
   * @example Injecting Winston
   * ```typescript
   * import winston from 'winston'
   * import { init } from 'autolemetry'
   *
   * const logger = winston.createLogger({ ... })
   * init({ service: 'my-app', logger }) // Winston has our 4 methods
   * ```
   *
   * @example Custom logger
   * ```typescript
   * const logger = {
   *   info: (msg, extra) => console.log(msg, extra),
   *   warn: (msg, extra) => console.warn(msg, extra),
   *   error: (msg, err, extra) => console.error(msg, err, extra),
   *   debug: (msg, extra) => console.debug(msg, extra),
   * }
   * init({ service: 'my-app', logger })
   * ```
   */
  logger?: Logger;

  /**
   * Automatically flush analytics queue when root spans end
   * - true: Auto-flush on root span completion (default)
   * - false: Use batching (events flush every 10 seconds automatically)
   *
   * Only flushes on root spans to avoid excessive network calls.
   * Default is true for serverless/short-lived processes. Set to false
   * for long-running services where batching is more efficient.
   */
  autoFlushAnalytics?: boolean;

  /**
   * Include OpenTelemetry span flushing in auto-flush (default: false)
   *
   * When enabled, spans are force-flushed along with analytics events on root
   * span completion. This is useful for serverless/short-lived processes where
   * spans may not export before the process ends.
   *
   * - true: Force-flush spans on root span completion (~50-200ms latency)
   * - false: Spans export via normal batch processor (default behavior)
   *
   * Only applies when autoFlushAnalytics is also enabled.
   *
   * Note: For edge runtimes (Cloudflare Workers, Vercel Edge), use the
   * 'autolemetry-edge' package instead, which handles this automatically.
   *
   * @example Serverless with auto-flush
   * ```typescript
   * init({
   *   service: 'my-lambda',
   *   autoFlushAnalytics: true,
   *   autoFlush: true, // Force-flush spans
   * });
   * ```
   */
  autoFlush?: boolean;

  /**
   * Validation configuration for analytics events
   * - Override default sensitive field patterns for redaction
   * - Customize max lengths, nesting depth, etc.
   *
   * @example Disable redaction for development
   * ```typescript
   * init({
   *   service: 'my-app',
   *   validation: {
   *     sensitivePatterns: [] // Disable all redaction
   *   }
   * })
   * ```
   *
   * @example Add custom patterns
   * ```typescript
   * init({
   *   service: 'my-app',
   *   validation: {
   *     sensitivePatterns: [
   *       /password/i,
   *       /apiKey/i,
   *       /customSecret/i  // Your custom pattern
   *     ]
   *   }
   * })
   * ```
   */
  validation?: Partial<ValidationConfig>;

  /**
   * OpenLLMetry integration for LLM observability.
   * Requires @traceloop/node-server-sdk as an optional peer dependency.
   *
   * @example Enable OpenLLMetry with default settings
   * ```typescript
   * init({
   *   service: 'my-app',
   *   openllmetry: { enabled: true }
   * })
   * ```
   *
   * @example Enable with custom options
   * ```typescript
   * init({
   *   service: 'my-app',
   *   openllmetry: {
   *     enabled: true,
   *     options: {
   *       disableBatch: process.env.NODE_ENV !== 'production',
   *       apiKey: process.env.TRACELOOP_API_KEY
   *     }
   *   }
   * })
   * ```
   */
  openllmetry?: {
    enabled: boolean;
    options?: Record<string, unknown>;
  };
}

// Internal state
let initialized = false;
let config: AutolemetryConfig | null = null;
let sdk: NodeSDK | null = null;
let warnedOnce = false;
let logger: Logger = silentLogger;
let validationConfig: Partial<ValidationConfig> | null = null;

/**
 * Resolve metrics flag with env var override support
 */
export function resolveMetricsFlag(
  configFlag: boolean | 'auto' = 'auto',
): boolean {
  // 1. Check env var override (highest priority)
  const envFlag = process.env.AUTOTELEMETRY_METRICS;
  if (envFlag === 'on' || envFlag === 'true') return true;
  if (envFlag === 'off' || envFlag === 'false') return false;

  // 2. Check config flag
  if (configFlag === true) return true;
  if (configFlag === false) return false;

  // 3. Default: enabled in all environments (simpler)
  return true;
}

function normalizeOtlpHeaders(
  headers?: Record<string, string> | string,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (typeof headers !== 'string') return headers;

  const parsed: Record<string, string> = {};
  for (const pair of headers.split(',')) {
    const [key, ...valueParts] = pair.split('=');
    if (!key || valueParts.length === 0) continue;
    parsed[key.trim()] = valueParts.join('=').trim();
  }
  return parsed;
}

/**
 * Initialize autolemetry - Write Once, Observe Everywhere
 *
 * Follows OpenTelemetry standards: opinionated defaults with full flexibility
 * Idempotent: multiple calls are safe, last one wins
 *
 * @example Minimal setup (OTLP default)
 * ```typescript
 * init({ service: 'my-app' })
 * ```
 *
 * @example With analytics (observe in PostHog, Mixpanel, etc.)
 * ```typescript
 * init({
 *   service: 'my-app',
 *   adapters: [new PostHogAdapter({ apiKey: '...' })]
 * })
 * ```
 *
 * @example Observe in Jaeger
 * ```typescript
 * import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
 *
 * init({
 *   service: 'my-app',
 *   spanExporter: new JaegerExporter({ endpoint: 'http://localhost:14268/api/traces' })
 * })
 * ```
 *
 * @example Observe in Zipkin
 * ```typescript
 * import { ZipkinExporter } from '@opentelemetry/exporter-zipkin'
 *
 * init({
 *   service: 'my-app',
 *   spanExporter: new ZipkinExporter({ url: 'http://localhost:9411/api/v2/spans' })
 * })
 * ```
 *
 * @example Observe in Datadog
 * ```typescript
 * import { DatadogSpanProcessor } from '@opentelemetry/exporter-datadog'
 *
 * init({
 *   service: 'my-app',
 *   spanProcessor: new DatadogSpanProcessor({ ... })
 * })
 * ```
 *
 * @example Console output (dev)
 * ```typescript
 * import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
 *
 * init({
 *   service: 'my-app',
 *   spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter())
 * })
 * ```
 */
export function init(cfg: AutolemetryConfig): void {
  // Set logger (use provided or default to silent)
  logger = cfg.logger || silentLogger;

  // Warn if re-initializing (same behavior in all environments)
  if (initialized) {
    logger.warn(
      '[autolemetry] init() called again - last config wins. This may cause unexpected behavior.',
    );
  }

  config = cfg;
  validationConfig = cfg.validation || null;

  // Initialize OpenTelemetry
  const endpoint =
    cfg.endpoint || process.env.OTLP_ENDPOINT || 'http://localhost:4318';
  const otlpHeaders = normalizeOtlpHeaders(cfg.otlpHeaders);
  const version = cfg.version || detectVersion();
  const environment = cfg.environment || process.env.NODE_ENV || 'development';
  const metricsEnabled = resolveMetricsFlag(cfg.metrics);

  let resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: cfg.service,
    [ATTR_SERVICE_VERSION]: version,
    'deployment.environment': environment,
  });

  if (cfg.resource) {
    resource = resource.merge(cfg.resource);
  }

  if (cfg.resourceAttributes) {
    resource = resource.merge(resourceFromAttributes(cfg.resourceAttributes));
  }

  // Determine span processor: custom > custom exporter > default OTLP
  let spanProcessor: SpanProcessor;

  if (cfg.spanProcessor) {
    // User provided custom processor (full control)
    spanProcessor = cfg.spanProcessor;
  } else if (cfg.spanExporter) {
    // User provided custom exporter (we wrap it with our tail sampling)
    spanProcessor = new TailSamplingSpanProcessor(
      new BatchSpanProcessor(cfg.spanExporter),
    );
  } else {
    // Default: OTLP with tail sampling (opinionated but flexible)
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: otlpHeaders,
    });

    spanProcessor = new TailSamplingSpanProcessor(
      new BatchSpanProcessor(traceExporter),
    );
  }

  let metricReader: MetricReader | undefined = cfg.metricReader;
  if (!metricReader && metricsEnabled) {
    metricReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${endpoint}/v1/metrics`,
        headers: otlpHeaders,
      }),
    });
  }

  let logRecordProcessors: LogRecordProcessor[] | undefined;
  if (cfg.logRecordProcessors && cfg.logRecordProcessors.length > 0) {
    logRecordProcessors = [...cfg.logRecordProcessors];
  }

  // Handle instrumentations: merge manual instrumentations with auto-integrations
  let finalInstrumentations: NodeSDKConfiguration['instrumentations'] =
    cfg.instrumentations ? [...cfg.instrumentations] : [];

  if (cfg.integrations !== undefined) {
    try {
      const autoInstrumentations = getAutoInstrumentations(cfg.integrations);
      if (autoInstrumentations && autoInstrumentations.length > 0) {
        // Cast to proper type - getNodeAutoInstrumentations returns the correct type
        finalInstrumentations = [
          ...finalInstrumentations,
          ...(autoInstrumentations as NodeSDKConfiguration['instrumentations']),
        ];
      }
    } catch (error) {
      if (
        (error as { code?: string }).code === AUTO_INSTRUMENTATIONS_NOT_FOUND
      ) {
        logger.warn(
          '[autolemetry] Could not load auto-instrumentations. ' +
            'Install @opentelemetry/auto-instrumentations-node to use the integrations option. ' +
            'Integrations will be ignored.',
        );
      } else {
        logger.warn(
          `[autolemetry] Failed to configure auto-instrumentations: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  const sdkOptions: Partial<NodeSDKConfiguration> = {
    resource,
    spanProcessor,
    instrumentations: finalInstrumentations,
  };

  if (metricReader) {
    sdkOptions.metricReader = metricReader;
  }

  if (logRecordProcessors && logRecordProcessors.length > 0) {
    sdkOptions.logRecordProcessors = logRecordProcessors;
  }

  sdk = cfg.sdkFactory ? cfg.sdkFactory(sdkOptions) : new NodeSDK(sdkOptions);

  if (!sdk) {
    throw new Error('[autolemetry] sdkFactory must return a NodeSDK instance');
  }

  sdk.start();

  // Initialize OpenLLMetry if enabled (after SDK starts to reuse tracer provider)
  if (cfg.openllmetry?.enabled) {
    // Try synchronous initialization first (for require-based modules)
    let initializedSync = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const traceloop = require('@traceloop/node-server-sdk');
      const initOptions: Record<string, unknown> = {
        ...cfg.openllmetry.options,
      };

      // Reuse autolemetry's tracer provider
      try {
        // Type assertion needed as getTracerProvider is not in the public NodeSDK interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tracerProvider = (sdk as any).getTracerProvider();
        initOptions.tracerProvider = tracerProvider;
      } catch {
        // Ignore if tracer provider not available
      }

      if (typeof traceloop.initialize === 'function') {
        traceloop.initialize(initOptions);
        logger.info('[autolemetry] OpenLLMetry initialized successfully');
        initializedSync = true;
      }
    } catch (error) {
      // If require fails, try async import (for ESM modules or when module not found)
      if (
        error instanceof Error &&
        (error.message.includes('Cannot find module') ||
          error.message.includes('Module not found') ||
          error.message.includes('Cannot resolve module'))
      ) {
        // Try async import as fallback - this will work with mocks in tests
        initializeOpenLLMetry(cfg.openllmetry.options, sdk).catch((error_) => {
          logger.warn(
            `[autolemetry] OpenLLMetry initialization error: ${error_ instanceof Error ? error_.message : String(error_)}`,
          );
        });
      } else if (!initializedSync) {
        logger.warn(
          `[autolemetry] Failed to initialize OpenLLMetry: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  initialized = true;
}

/**
 * Initialize OpenLLMetry integration
 * Dynamically imports @traceloop/node-server-sdk and initializes it
 * Returns a promise but can be called without awaiting (fire-and-forget)
 */
async function initializeOpenLLMetry(
  options?: Record<string, unknown>,
  sdkInstance?: NodeSDK,
): Promise<void> {
  try {
    // Try synchronous require first (for testing/mocking), then fall back to dynamic import
    let traceloop: {
      initialize?: (options?: Record<string, unknown>) => void;
      instrumentations?: unknown[];
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      traceloop = require('@traceloop/node-server-sdk');
    } catch {
      // Fall back to dynamic import if require fails (ESM modules)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - optional peer dependency
      traceloop = await import('@traceloop/node-server-sdk');
    }

    // Prepare initialization options
    const initOptions: Record<string, unknown> = {
      ...options,
    };

    // Reuse autolemetry's tracer provider if SDK is available
    if (sdkInstance) {
      try {
        // Type assertion needed as getTracerProvider is not in the public NodeSDK interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tracerProvider = (sdkInstance as any).getTracerProvider();
        initOptions.tracerProvider = tracerProvider;
      } catch (error) {
        logger.debug(
          `[autolemetry] Could not get tracer provider for OpenLLMetry: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Initialize OpenLLMetry
    if (typeof traceloop.initialize === 'function') {
      traceloop.initialize(initOptions);
      logger.info('[autolemetry] OpenLLMetry initialized successfully');
    } else {
      logger.warn(
        '[autolemetry] OpenLLMetry initialize function not found. Check @traceloop/node-server-sdk version.',
      );
    }
  } catch (error) {
    // Gracefully handle missing dependency
    if (
      error instanceof Error &&
      (error.message.includes('Cannot find module') ||
        error.message.includes('Module not found') ||
        error.message.includes('Cannot resolve module'))
    ) {
      logger.warn(
        '[autolemetry] OpenLLMetry enabled but @traceloop/node-server-sdk is not installed. ' +
          'Install it as a peer dependency to use OpenLLMetry integration.',
      );
    } else {
      logger.warn(
        `[autolemetry] Failed to initialize OpenLLMetry: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Get auto-instrumentations based on simple integration names
 */
function ensureAutoInstrumentationsModule(): void {
  if (getNodeAutoInstrumentations) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const autoInstrumentationsModule = require('@opentelemetry/auto-instrumentations-node');
    getNodeAutoInstrumentations =
      autoInstrumentationsModule.getNodeAutoInstrumentations;
  } catch {
    throw new AutoInstrumentationsNotFoundError(
      '@opentelemetry/auto-instrumentations-node is not installed. Install it as a peer dependency to use the integrations option.',
    );
  }
}

function getAutoInstrumentations(
  integrations: string[] | boolean | Record<string, { enabled?: boolean }>,
): unknown[] {
  if (integrations === false) {
    return [];
  }

  ensureAutoInstrumentationsModule();

  if (!getNodeAutoInstrumentations) {
    throw new AutoInstrumentationsNotFoundError(
      'Unable to load @opentelemetry/auto-instrumentations-node',
    );
  }

  if (integrations === true) {
    return getNodeAutoInstrumentations();
  }

  if (Array.isArray(integrations)) {
    const config: Record<string, { enabled: boolean }> = {};
    for (const name of integrations) {
      const packageName = `@opentelemetry/instrumentation-${name}`;
      config[packageName] = { enabled: true };
    }
    return getNodeAutoInstrumentations(config);
  }

  const config: Record<string, { enabled?: boolean }> = {};
  for (const [name, options] of Object.entries(integrations)) {
    const packageName = `@opentelemetry/instrumentation-${name}`;
    config[packageName] = options;
  }
  return getNodeAutoInstrumentations(config);
}

/**
 * Check if autolemetry has been initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Get current config (internal use)
 */
export function getConfig(): AutolemetryConfig | null {
  return config;
}

/**
 * Get current logger (internal use)
 */
export function getLogger(): Logger {
  return logger;
}

/**
 * Get validation config (internal use)
 */
export function getValidationConfig(): Partial<ValidationConfig> | null {
  return validationConfig;
}

/**
 * Warn once if not initialized (same behavior in all environments)
 */
export function warnIfNotInitialized(context: string): void {
  if (!initialized && !warnedOnce) {
    logger.warn(
      `[autolemetry] ${context} used before init() called. ` +
        'Call init({ service: "..." }) first. See: https://docs.autolemetry.dev/quickstart',
    );
    warnedOnce = true;
  }
}

/**
 * Get default sampler
 */
export function getDefaultSampler(): Sampler {
  return (
    config?.sampler ||
    new AdaptiveSampler({
      baselineSampleRate: 0.1,
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
    })
  );
}

/**
 * Auto-detect version from package.json
 */
function detectVersion(): string {
  try {
    // Try to read package.json from cwd using fs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    const pkg = JSON.parse(
      fs.readFileSync(`${process.cwd()}/package.json`, 'utf8'),
    );
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Get SDK instance (for shutdown)
 */
export function getSdk(): NodeSDK | null {
  return sdk;
}
