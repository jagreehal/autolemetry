import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getConfig } from './config';
import { enrichWithTraceContext } from './trace-helpers';
import type { Logger, LoggerConfig } from './logger-types';

/**
 * Create a Winston-based logger instance
 *
 * Synchronous initialization. Winston is an optional peer dependency.
 * Install with: npm install winston
 *
 * Features same trace correlation as Pino-based createLogger():
 * - Automatic traceId, spanId, correlationId injection
 * - Respects LOG_LEVEL environment variable
 * - Supports redaction of sensitive fields
 * - Pretty printing for development
 *
 * @example
 * ```typescript
 * import { createWinstonLogger } from 'autolemetry/logger'
 *
 * // Uses process.env.LOG_LEVEL or defaults to 'info'
 * const logger = createWinstonLogger('user')
 * logger.info('User created', { userId: '123' })
 *
 * // Explicit override
 * const debugLogger = createWinstonLogger('user', { level: 'debug' })
 *
 * // Custom redaction
 * const logger = createWinstonLogger('user', {
 *   redact: ['ssn', 'creditCard', 'password']
 * })
 *
 * // Disable redaction (not recommended)
 * const logger = createWinstonLogger('user', { redact: false })
 * ```
 */
export function createWinstonLogger(
  service: string,
  options?: Partial<Omit<LoggerConfig, 'service'>>,
): Logger {
  // Synchronous require - Winston is fast to initialize
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let winstonModule: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    winstonModule = require('winston');
  } catch {
    throw new Error(
      'Winston is not installed. Install it with: npm install winston\n' +
        'Winston is an optional peer dependency for autolemetry.',
    );
  }

  // Priority: explicit option > env var > default 'info'
  const level =
    options?.level ||
    (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') ||
    'info';

  const { featureFlags } = getConfig();

  // Winston logger configuration
  const winstonInstance = winstonModule.createLogger({
    level,
    defaultMeta: { service },
    format: winstonModule.format.combine(
      // Redaction support (if enabled)
      ...(options?.redact !== false && featureFlags.ENABLE_REDACTION
        ? [
            // Winston doesn't have built-in redaction like Pino,
            // but we can use a custom format to redact sensitive fields
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            winstonModule.format((info: any) => {
              const redactPaths = options?.redact || [
                'password',
                'token',
                'secret',
                'key',
                'apikey',
                'api_key',
                'authorization',
                'cookie',
              ];

              // Simple redaction: replace exact key matches
              for (const path of redactPaths) {
                const cleanPath = path.replace('*.', ''); // Remove pino glob syntax
                if (info[cleanPath]) {
                  info[cleanPath] = '[REDACTED]';
                }
              }
              return info;
            })(),
          ]
        : []),
      winstonModule.format.timestamp(),
      // Pretty printing for development
      ...(options?.pretty
        ? [winstonModule.format.colorize(), winstonModule.format.simple()]
        : [winstonModule.format.json()]),
    ),
    transports: [new winstonModule.transports.Console()],
  });

  // Return simple Logger interface wrapping Winston
  return {
    info(message: string, extra?: Record<string, unknown>): void {
      winstonInstance.info(message, enrichWithTraceContext(extra || {}));
    },
    warn(message: string, extra?: Record<string, unknown>): void {
      winstonInstance.warn(message, enrichWithTraceContext(extra || {}));
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
      winstonInstance.error(
        message,
        enrichWithTraceContext({
          ...extra,
          error: error?.stack || error?.message,
        }),
      );
    },
    debug(message: string, extra?: Record<string, unknown>): void {
      winstonInstance.debug(message, enrichWithTraceContext(extra || {}));
    },
  };
}
