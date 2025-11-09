/**
 * Trace context types and utilities
 */

import type { Span, SpanStatusCode } from '@opentelemetry/api';

/**
 * Base trace context containing trace identifiers
 */
export interface TraceContextBase {
  traceId: string;
  spanId: string;
  correlationId: string;
}

/**
 * Span methods available on trace context
 */
export interface SpanMethods {
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  setStatus(status: { code: SpanStatusCode; message?: string }): void;
  recordException(exception: Error): void;
}

/**
 * Complete trace context that merges base context and span methods
 *
 * This is the ctx parameter passed to factory functions in trace().
 * It provides access to trace IDs and span manipulation methods.
 */
export type TraceContext = TraceContextBase & SpanMethods;

/**
 * Create a TraceContext from an OpenTelemetry Span
 *
 * This utility extracts trace context information from a span
 * and provides span manipulation methods in a consistent format.
 */
export function createTraceContext(span: Span): TraceContext {
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    correlationId: spanContext.traceId.slice(0, 16),
    setAttribute: span.setAttribute.bind(span),
    setAttributes: span.setAttributes.bind(span),
    setStatus: span.setStatus.bind(span),
    recordException: span.recordException.bind(span),
  };
}
