import { trace, SpanStatusCode } from '@opentelemetry/api';
import { createRequire } from 'node:module';
import path from 'node:path';
import { getConfig } from './config';
import { enrichWithTraceContext } from './trace-helpers';
import { LOG_LEVEL } from './logger-types';
import type { LogLevel, Logger, LoggerConfig } from './logger-types';
import type { Logger as PinoLogger } from 'pino';

/**
 * Create a logger instance with Pino
 *
 * Synchronous initialization - Pino is fast and lightweight.
 * Uses pino with built-in slow-redact for immutable, selective redaction.
 * Automatically enriches logs with OpenTelemetry trace context (traceId, spanId).
 * Respects LOG_LEVEL environment variable, with explicit options taking precedence.
 *
 * For the full Pino API (child loggers, bindings, etc.), import pino directly
 * and pass your instance to init() - Pino implements our Logger interface.
 *
 * @example Basic usage
 * ```typescript
 * import { createLogger } from 'autolemetry/logger'
 *
 * // Uses process.env.LOG_LEVEL or defaults to 'info'
 * const logger = createLogger('user')
 * logger.info('User created', { userId: '123' })
 *
 * // Explicit override
 * const debugLogger = createLogger('user', { level: 'debug' })
 *
 * // Custom redaction paths
 * const logger = createLogger('user', {
 *   redact: ['*.ssn', '*.creditCard', '*.password']
 * })
 *
 * // Disable redaction (not recommended)
 * const logger = createLogger('user', { redact: false })
 * ```
 *
 * @example Power users: use native Pino for full API
 * ```typescript
 * import pino from 'pino'
 * import { init } from 'autolemetry'
 *
 * const logger = pino({ ... }) // Full control
 * const child = logger.child({ requestId: '123' })
 * init({ service: 'my-app', logger })
 * ```
 */
function loadPino(): typeof import('pino') {
  const loaders = [
    () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pinoModule = require('pino');
      return pinoModule;
    },
    () => createRequire(path.join(process.cwd(), 'package.json'))('pino'),
  ];

  for (const loader of loaders) {
    try {
      const mod = loader();
      return mod.default || mod;
    } catch {
      // Try next loader
    }
  }

  throw new Error(
    'pino is required for createLogger(). Install it: npm install pino',
  );
}

export function createLogger(
  service: string,
  options?: Partial<Omit<LoggerConfig, 'service'>>,
): Logger {
  // Lazy-load pino to preserve optional peer dependency contract
  // This ensures Winston-only users don't get "Cannot find module 'pino'" errors
  // Uses require() which works in CJS and ESM (via createRequire or bundler handling)
  type PinoModule = typeof import('pino');
  const pino: PinoModule = loadPino();

  // Priority: explicit option > env var > default 'info'
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const level = options?.level ?? envLevel ?? LOG_LEVEL.INFO;

  // Import feature flags to respect global redaction setting
  const { featureFlags } = getConfig();

  // Default redaction paths for common sensitive fields
  const defaultRedactPaths = [
    '*.password',
    '*.token',
    '*.secret',
    '*.key',
    '*.apikey',
    '*.api_key',
    '*.authorization',
    '*.cookie',
  ];

  // Redaction logic:
  // 1. If config.redact is explicitly false, disable redaction
  // 2. If ENABLE_REDACTION feature flag is false, disable redaction
  // 3. Otherwise, use provided paths or defaults
  const shouldRedact =
    options?.redact !== false && featureFlags.ENABLE_REDACTION;

  // Create Pino instance with automatic trace context enrichment via mixin
  const pinoInstance: PinoLogger = pino({
    name: service,
    level,
    // Mixin: dynamically add trace context to every log
    mixin() {
      return enrichWithTraceContext({});
    },
    // Hook: automatically record errors in OpenTelemetry spans
    hooks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logMethod: (write: any, chunk: any) => {
        if (typeof write !== 'function') {
          return;
        }
        // If this is an error log, record it in the active span
        if (chunk.level >= 50) {
          // 50 is Pino's error level
          const span = trace.getActiveSpan();
          if (span && chunk.err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: chunk.err.message || 'Error',
            });
            span.recordException(chunk.err);
          }
        }
        write(chunk);
      },
    },
    // Use pino's built-in slow-redact (selective cloning, immutable)
    ...(shouldRedact && {
      redact: {
        paths: options?.redact || defaultRedactPaths,
        censor: '[REDACTED]',
      },
    }),
    ...(options?.pretty && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }),
  });

  // Return simple Logger interface wrapping Pino
  return {
    info(message: string, extra?: Record<string, unknown>): void {
      pinoInstance.info(extra || {}, message);
    },
    warn(message: string, extra?: Record<string, unknown>): void {
      pinoInstance.warn(extra || {}, message);
    },
    error(
      message: string,
      error?: Error,
      extra?: Record<string, unknown>,
    ): void {
      const span = trace.getActiveSpan();
      if (span && error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
      }
      pinoInstance.error({ ...extra, err: error }, message);
    },
    debug(message: string, extra?: Record<string, unknown>): void {
      pinoInstance.debug(extra || {}, message);
    },
  };
}
