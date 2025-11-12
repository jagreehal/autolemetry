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

import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import type { Span, Tracer, Context } from '@opentelemetry/api';

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

/**
 * Get a tracer instance for creating custom spans
 *
 * Use this when you need low-level control over span lifecycle.
 * For most use cases, prefer trace(), span(), or instrument() instead.
 *
 * @param name - Tracer name (usually your service or module name)
 * @param version - Optional version string
 * @returns OpenTelemetry Tracer instance
 *
 * @example Basic usage
 * ```typescript
 * import { getTracer } from 'autolemetry';
 *
 * const tracer = getTracer('my-service');
 * const span = tracer.startSpan('custom.operation');
 * try {
 *   // Your logic
 *   span.setAttribute('key', 'value');
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @example With AI SDK
 * ```typescript
 * import { getTracer } from 'autolemetry';
 * import { generateText } from 'ai';
 *
 * const tracer = getTracer('ai-agent');
 * const result = await generateText({
 *   model: myModel,
 *   prompt: 'Hello',
 *   experimental_telemetry: {
 *     isEnabled: true,
 *     tracer,
 *   },
 * });
 * ```
 */
export function getTracer(name: string, version?: string): Tracer {
  return trace.getTracer(name, version);
}

/**
 * Get the currently active span
 *
 * Returns undefined if no span is currently active.
 * Useful for adding attributes or events to the current span.
 *
 * @returns Active span or undefined
 *
 * @example Adding attributes to active span
 * ```typescript
 * import { getActiveSpan } from 'autolemetry';
 *
 * const span = getActiveSpan();
 * if (span) {
 *   span.setAttribute('user.id', userId);
 *   span.addEvent('User action', { action: 'click' });
 * }
 * ```
 *
 * @example Checking span status
 * ```typescript
 * import { getActiveSpan, SpanStatusCode } from 'autolemetry';
 *
 * const span = getActiveSpan();
 * if (span?.isRecording()) {
 *   span.setStatus({ code: SpanStatusCode.OK });
 * }
 * ```
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Get the currently active OpenTelemetry context
 *
 * The context contains the active span and any baggage.
 * Useful for context propagation and custom instrumentation.
 *
 * @returns Current active context
 *
 * @example Propagating context
 * ```typescript
 * import { getActiveContext } from 'autolemetry';
 *
 * const currentContext = getActiveContext();
 * // Pass context to another function or service
 * ```
 *
 * @example With context injection
 * ```typescript
 * import { getActiveContext, injectTraceContext } from 'autolemetry';
 *
 * const headers = {};
 * injectTraceContext(headers);
 * // Headers now contain trace propagation data
 * ```
 */
export function getActiveContext(): Context {
  return context.active();
}

/**
 * Run a function with a specific span set as active
 *
 * This is a convenience wrapper around the two-step process of
 * setting a span in context and running code within that context.
 *
 * @param span - The span to set as active
 * @param fn - Function to execute with the span active
 * @returns The return value of the function
 *
 * @example Running code with a custom span
 * ```typescript
 * import { getTracer, runWithSpan } from 'autolemetry';
 *
 * const tracer = getTracer('my-service');
 * const span = tracer.startSpan('background.job');
 *
 * try {
 *   const result = await runWithSpan(span, async () => {
 *     // Any spans created here will be children of 'background.job'
 *     await processData();
 *     return { success: true };
 *   });
 *   console.log(result);
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @example Testing with mock spans
 * ```typescript
 * import { runWithSpan } from 'autolemetry';
 * import { InMemorySpanExporter } from 'autolemetry/testing';
 *
 * const mockSpan = createMockSpan();
 * const result = runWithSpan(mockSpan, () => {
 *   // Code under test
 *   return myFunction();
 * });
 * ```
 */
export function runWithSpan<T>(span: Span, fn: () => T): T {
  const ctx = trace.setSpan(context.active(), span);
  return context.with(ctx, fn);
}

/**
 * Finalize a span with appropriate status and optional error recording
 *
 * This is a convenience function that:
 * - Records exceptions if an error is provided
 * - Sets span status to ERROR if error exists, OK otherwise
 * - Ends the span
 *
 * @param span - The span to finalize
 * @param error - Optional error to record
 *
 * @example Without error (success case)
 * ```typescript
 * import { getTracer, finalizeSpan } from 'autolemetry';
 *
 * const tracer = getTracer('my-service');
 * const span = tracer.startSpan('operation');
 *
 * try {
 *   await doWork();
 *   finalizeSpan(span);
 * } catch (error) {
 *   finalizeSpan(span, error);
 *   throw error;
 * }
 * ```
 *
 * @example With error
 * ```typescript
 * import { getTracer, finalizeSpan } from 'autolemetry';
 *
 * const tracer = getTracer('my-service');
 * const span = tracer.startSpan('operation');
 *
 * try {
 *   await riskyOperation();
 *   finalizeSpan(span);
 * } catch (error) {
 *   finalizeSpan(span, error); // Records exception and sets ERROR status
 *   throw error;
 * }
 * ```
 *
 * @example In instrumentation
 * ```typescript
 * import { getTracer, runWithSpan, finalizeSpan } from 'autolemetry';
 *
 * function instrumentedQuery(query: string) {
 *   const tracer = getTracer('db');
 *   const span = tracer.startSpan('db.query');
 *
 *   return runWithSpan(span, () => {
 *     try {
 *       const result = executeQuery(query);
 *       finalizeSpan(span);
 *       return result;
 *     } catch (error) {
 *       finalizeSpan(span, error);
 *       throw error;
 *     }
 *   });
 * }
 * ```
 */
export function finalizeSpan(span: Span, error?: unknown): void {
  if (error) {
    if (error instanceof Error) {
      span.recordException(error);
    } else {
      span.recordException(new Error(String(error)));
    }
    span.setStatus({ code: SpanStatusCode.ERROR });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}
