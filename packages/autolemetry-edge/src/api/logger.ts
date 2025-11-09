/**
 * Zero-dependency structured logger for edge environments
 *
 * This logger is ~100 LOC and provides:
 * - Structured JSON logging
 * - Auto trace context injection (traceId, spanId)
 * - Level support (info, error, warn, debug)
 * - Zero dependencies (console-based)
 *
 * Unlike Pino/Winston (~500KB), this is <1KB minified!
 */

import { trace } from '@opentelemetry/api';

export interface EdgeLogger {
  info(msg: string, attrs?: Record<string, any>): void;
  error(msg: string, error?: Error | unknown, attrs?: Record<string, any>): void;
  warn(msg: string, attrs?: Record<string, any>): void;
  debug(msg: string, attrs?: Record<string, any>): void;
}

/**
 * Get current trace context from active span
 */
function getTraceContext():
  | { traceId: string; spanId: string; correlationId: string }
  | null {
  const span = trace.getActiveSpan();
  if (!span) return null;

  const ctx = span.spanContext();
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    correlationId: ctx.traceId.substring(0, 16), // First 16 chars for grouping
  };
}

/**
 * Create a lightweight structured logger
 *
 * @param service - Service name for logging
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * const log = createEdgeLogger('user-service')
 *
 * log.info('Creating user', { email: 'test@example.com' })
 * // Output: {"level":"info","service":"user-service","msg":"Creating user",
 * //          "email":"test@example.com","traceId":"...","spanId":"..."}
 * ```
 */
export function createEdgeLogger(
  service: string,
  options?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    pretty?: boolean; // For development
  },
): EdgeLogger {
  const logLevel = options?.level || 'info';
  const pretty = options?.pretty || false;

  const levelPriority: Record<string, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  const shouldLog = (level: string): boolean => {
    return levelPriority[level] >= levelPriority[logLevel];
  };

  const log = (
    level: 'info' | 'error' | 'warn' | 'debug',
    msg: string,
    attrs?: Record<string, any>,
  ) => {
    if (!shouldLog(level)) return;

    const ctx = getTraceContext();
    const logEntry: Record<string, any> = {
      level,
      service,
      msg,
      ...attrs,
      ...(ctx || {}), // Auto-inject traceId, spanId, correlationId
      timestamp: new Date().toISOString(),
    };

    if (pretty) {
      // Pretty print for development
      const traceInfo = ctx
        ? ` [${ctx.traceId.substring(0, 8)}.../${ctx.spanId.substring(0, 8)}...]`
        : '';
      console.log(
        `[${level.toUpperCase()}]${traceInfo} ${service}: ${msg}`,
        attrs || '',
      );
    } else {
      // Structured JSON for production
      console.log(JSON.stringify(logEntry));
    }
  };

  return {
    info: (msg: string, attrs?: Record<string, any>) => log('info', msg, attrs),

    error: (msg: string, error?: Error | unknown, attrs?: Record<string, any>) => {
      const errorAttrs = error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
            name: error.name,
            ...attrs,
          }
        : { error: String(error), ...attrs };

      log('error', msg, errorAttrs);
    },

    warn: (msg: string, attrs?: Record<string, any>) => log('warn', msg, attrs),

    debug: (msg: string, attrs?: Record<string, any>) => log('debug', msg, attrs),
  };
}

/**
 * Helper to get trace context (useful for BYOL - Bring Your Own Logger)
 *
 * @example
 * ```typescript
 * import bunyan from 'bunyan'
 * import { getEdgeTraceContext } from 'autolemetry-edge/api/logger'
 *
 * const bunyanLogger = bunyan.createLogger({ name: 'myapp' })
 * const ctx = getEdgeTraceContext()
 * bunyanLogger.info({ ...ctx, email: 'test@example.com' }, 'Creating user')
 * ```
 */
export function getEdgeTraceContext() {
  return getTraceContext();
}
