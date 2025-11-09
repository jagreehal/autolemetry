/**
 * Trace context helpers - Core primitives for trace correlation
 *
 * These are the building blocks that allow users to bring their own logger
 * (bunyan, log4js, custom, etc.) and add trace correlation.
 *
 * @example Using with bunyan
 * ```typescript
 * import bunyan from 'bunyan';
 * import { enrichWithTraceContext } from 'autolemetry/trace-helpers';
 *
 * const bunyanLogger = bunyan.createLogger({ name: 'myapp' });
 *
 * const logger = {
 *   info: (msg: string, extra?: object) => {
 *     bunyanLogger.info(enrichWithTraceContext(extra || {}), msg);
 *   }
 * };
 * ```
 *
 * @example Using with log4js
 * ```typescript
 * import log4js from 'log4js';
 * import { getTraceContext } from 'autolemetry/trace-helpers';
 *
 * const log4jsLogger = log4js.getLogger();
 *
 * function logWithTrace(level: string, msg: string, extra?: object) {
 *   const context = getTraceContext();
 *   log4jsLogger[level](msg, { ...extra, ...context });
 * }
 * ```
 */

import { trace } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';

/**
 * WeakMap to store span names for active spans
 * This allows us to retrieve the span name even though OpenTelemetry
 * doesn't expose it through the public API
 */
const spanNameMap = new WeakMap<Span, string>();

/**
 * Store span name for a given span
 * Called internally when spans are created
 */
export function setSpanName(span: Span, name: string): void {
  spanNameMap.set(span, name);
}

/**
 * Trace context extracted from active span
 */
export interface TraceContext {
  /** Full 32-character hex trace ID */
  traceId: string;
  /** 16-character hex span ID */
  spanId: string;
  /** First 16 characters of trace ID (for log grouping/correlation) */
  correlationId: string;
  /** Function/operation name (OpenTelemetry semantic convention: code.function) */
  'code.function'?: string;
}

/**
 * Get current trace context from active span
 *
 * Returns null if no span is active (e.g., outside of trace operation)
 *
 * @returns Trace context with traceId, spanId, correlationId, or null
 *
 * @example
 * ```typescript
 * import { getTraceContext } from 'autolemetry/trace-helpers';
 *
 * const context = getTraceContext();
 * if (context) {
 *   console.log('Current trace:', context.traceId);
 *   // Current trace: 4bf92f3577b34da6a3ce929d0e0e4736
 * }
 * ```
 */
export function getTraceContext(): TraceContext | null {
  const span = trace.getActiveSpan();
  if (!span) return null;

  const spanContext = span.spanContext();
  const traceId = spanContext.traceId;

  // Get span name from WeakMap (set when span is created)
  // Map to OpenTelemetry semantic convention: code.function
  const spanName = spanNameMap.get(span);

  return {
    traceId,
    spanId: spanContext.spanId,
    correlationId: traceId.slice(0, 16),
    ...(spanName && { 'code.function': spanName }),
  };
}

/**
 * Enrich object with trace context (traceId, spanId, correlationId)
 *
 * If no span is active, returns the object unchanged.
 * This prevents "undefined" or "null" values in logs.
 *
 * @param obj - Object to enrich (e.g., log metadata)
 * @returns Object with trace context merged in, or unchanged if no active span
 *
 * @example
 * ```typescript
 * import { enrichWithTraceContext } from 'autolemetry/trace-helpers';
 *
 * // Inside a trace operation:
 * const enriched = enrichWithTraceContext({ userId: '123' });
 * // { userId: '123', traceId: '4bf...', spanId: '00f...', correlationId: '4bf...' }
 *
 * // Outside trace operation:
 * const unchanged = enrichWithTraceContext({ userId: '123' });
 * // { userId: '123' } - no trace fields added
 * ```
 */
export function enrichWithTraceContext<T extends Record<string, unknown>>(
  obj: T,
): T {
  const context = getTraceContext();
  return context ? ({ ...obj, ...context } as T) : obj;
}

/**
 * Check if currently in a trace context
 *
 * Useful for conditional logic based on trace presence
 *
 * @returns true if active span exists, false otherwise
 *
 * @example
 * ```typescript
 * import { isTracing } from 'autolemetry/trace-helpers';
 *
 * if (isTracing()) {
 *   // Add expensive debug metadata only when tracing
 *   logger.debug('Detailed context', expensiveDebugData());
 * }
 * ```
 */
export function isTracing(): boolean {
  return trace.getActiveSpan() !== undefined;
}
