/**
 * autolemetry-edge
 *
 * Ultra-lightweight OpenTelemetry for edge runtimes
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - Netlify Edge Functions
 * - Deno Deploy
 * - AWS Lambda@Edge
 *
 * Bundle size: ~43KB minified (~13KB gzipped) vs 700KB for Node.js version
 * Core bundle: 24.58KB (standalone), 6,797 LOC source code
 *
 * @example Quick Start
 * ```typescript
 * import { trace, createEdgeLogger } from 'autolemetry-edge'
 *
 * const log = createEdgeLogger('user')
 *
 * export const createUser = trace(async function createUser(email: string) {
 *   log.info('Creating user', { email })
 *   return { id: '123', email }
 * })
 * ```
 */

// Core exports
export { SpanImpl } from './core/span';
export { WorkerTracer, withNextSpan } from './core/tracer';
export { OTLPExporter } from './core/exporter';
export { AsyncLocalStorageContextManager } from './core/context';
export { WorkerTracerProvider } from './core/provider';
export { Buffer } from './core/buffer';
export {
  parseConfig,
  createInitialiser,
  getActiveConfig,
  setConfig,
} from './core/config';

// Functional API (PRIMARY - this is our killer feature!)
export {
  trace,
  withTracing,
  instrument as instrumentFunctions,
  span,
  type traceOptions,
  type TraceContext,
  type InstrumentOptions,
} from './api/functional';

// Handler instrumentation (for Cloudflare Workers)
export { instrument } from './api/instrument';
export { instrumentDO } from './api/durable-objects';
export { instrumentWorkflow } from './api/workflows';

// Bindings instrumentation (auto-applied, but can be used manually)
export {
  instrumentKV,
  instrumentR2,
  instrumentD1,
  instrumentServiceBinding,
  instrumentBindings,
} from './instrumentation/bindings';

// Subscribers hook
export {
  createEdgeSubscribers,
  getEdgeSubscribers,
  getEventName,
  type EdgeSubscribers,
  type EdgeEvent,
  type EdgeFunnelStepEvent,
  type EdgeOutcomeEvent,
  type EdgeTrackEvent,
  type EdgeValueEvent,
  type EdgeTransport,
  type EdgeDispatchOptions,
  type SubscriberDeliveryMode,
  type FunnelStepStatus,
  type OutcomeStatus,
} from './api/subscribers';

// Logger (zero dependencies!)
export {
  createEdgeLogger,
  getEdgeTraceContext,
  type EdgeLogger,
} from './api/logger';

// Types
export type {
  Trigger,
  EdgeConfig,
  ResolvedEdgeConfig,
  ServiceConfig,
  OTLPExporterConfig,
  ExporterConfig,
  SamplingConfig,
  InstrumentationOptions,
  ResolveConfigFn,
  ConfigurationOption,
  PostProcessorFn,
  TailSampleFn,
  LocalTrace,
  TraceFlushableSpanProcessor,
  InitialSpanInfo,
  HandlerInstrumentation,
  EdgeSubscriber,
} from './types';

// Re-export OpenTelemetry APIs for convenience
// (Users shouldn't need to import @opentelemetry/api directly)
// Note: We export trace from functional API above, so we don't re-export OpenTelemetry's trace
export { context, propagation } from '@opentelemetry/api';

// Re-export common OpenTelemetry types
export type {
  Span,
  SpanContext,
  Tracer,
  Context,
} from '@opentelemetry/api';
