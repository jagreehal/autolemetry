/**
 * autolemetry - Simplified OpenTelemetry instrumentation
 *
 * @example Minimal setup
 * ```typescript
 * import { init, trace, track } from 'autolemetry'
 *
 * init({ service: 'my-app' })
 *
 * export const createUser = trace(ctx => async (data: CreateUserData) => {
 *   track('user.signup', { userId: data.id, plan: data.plan })
 * })
 * ```
 *
 * @example With events
 * ```typescript
 * import { init, trace, track } from 'autolemetry'
 * import { PostHogSubscriber } from 'autolemetry-subscribers'
 *
 * init({
 *   service: 'my-app',
 *   subscribers: [new PostHogSubscriber({ apiKey: '...' })]
 * })
 *
 * export const createUser = trace(ctx => async (data: CreateUserData) => {
 *   track('user.signup', { userId: data.id })
 * })
 * ```
 */

// Core initialization
export { init, type AutolemetryConfig } from './init';

// Baggage span processor
export {
  BaggageSpanProcessor,
  type BaggageSpanProcessorOptions,
} from './baggage-span-processor';

// Functional API (re-export for convenience)
export type {
  TraceContext,
  SpanOptions,
  WithNewContextOptions,
  WithBaggageOptions,
  InstrumentOptions,
} from './functional';
export {
  trace,
  instrument,
  withTracing,
  span,
  withNewContext,
  withBaggage,
  ctx,
} from './functional';

// Operation context (for advanced usage)
export type { OperationContext } from './operation-context';
export {
  getOperationContext,
  runInOperationContext,
} from './operation-context';

// Global track function
export { track } from './track';

// Graceful shutdown
export { flush, shutdown } from './shutdown';

// Re-export sampling strategies
export {
  type Sampler,
  type SamplingContext,
  AlwaysSampler,
  NeverSampler,
  RandomSampler,
  AdaptiveSampler,
  UserIdSampler,
} from './sampling';

// Events API
export { Event, getEvents, resetEvents, type EventsOptions } from './event';

// Metrics API
export {
  Metric,
  getMetrics,
  resetMetrics,
  type MetricsOptions,
} from './metric';

// Meter helpers for custom metrics
export {
  getMeter,
  createCounter,
  createHistogram,
  createUpDownCounter,
  createObservableGauge,
} from './metric-helpers';

// Tracer helpers for custom spans
export {
  getTracer,
  getActiveSpan,
  getActiveContext,
  runWithSpan,
} from './trace-helpers';

// Re-export events types
export type {
  EventSubscriber,
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from './event-subscriber';

// Re-export OpenTelemetry APIs for convenience
// (Users shouldn't need to import @opentelemetry/api directly)
// Note: trace is exported from './functional' above, so we export OTel's trace as otelTrace
export {
  trace as otelTrace,
  context,
  propagation,
  SpanStatusCode,
} from '@opentelemetry/api';

// Re-export common OpenTelemetry types
export type { Span, SpanContext, Tracer, Context } from '@opentelemetry/api';

// Export typed baggage helper
export { defineBaggageSchema } from './trace-context';
