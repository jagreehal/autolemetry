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
 * @example With analytics
 * ```typescript
 * import { init, trace, track } from 'autolemetry'
 * import { PostHogAdapter } from 'autolemetry-adapters'
 *
 * init({
 *   service: 'my-app',
 *   adapters: [new PostHogAdapter({ apiKey: '...' })]
 * })
 *
 * export const createUser = trace(ctx => async (data: CreateUserData) => {
 *   track('user.signup', { userId: data.id })
 * })
 * ```
 */

// Core initialization
export { init, type AutolemetryConfig } from './init';

// Functional API (re-export for convenience)
export type {
  TraceContext,
  SpanOptions,
  WithNewContextOptions,
  InstrumentOptions,
} from './functional';
export {
  trace,
  instrument,
  withTracing,
  span,
  withNewContext,
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

// Analytics API (product analytics platforms)
export {
  Analytics,
  getAnalytics,
  resetAnalytics,
  type AnalyticsOptions,
} from './analytics';

// Metrics API (OpenTelemetry business metrics)
export {
  Metrics,
  getMetrics,
  resetMetrics,
  type MetricsOptions,
} from './metrics';

// Meter helpers for custom metrics
export {
  getMeter,
  createCounter,
  createHistogram,
  createUpDownCounter,
  createObservableGauge,
} from './metrics-helpers';

// Re-export analytics types
export type {
  AnalyticsAdapter,
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from './analytics-adapter';

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
