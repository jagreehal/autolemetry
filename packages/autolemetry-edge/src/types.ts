/**
 * Shared types for autolemetry-edge
 */

import type {
  Attributes,
  Context,
  Span,
  SpanOptions,
  TextMapPropagator,
} from '@opentelemetry/api';
import type {
  ReadableSpan,
  Sampler,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

// Re-export commonly used types
export type { Attributes, Context, Span, SpanOptions, ReadableSpan };

/**
 * Extended SpanOptions with per-span sampler support
 */
export interface ExtendedSpanOptions extends SpanOptions {
  sampler?: Sampler;
}

/**
 * Trigger types for edge handlers
 */
export type Trigger =
  | Request
  | MessageBatch
  | ScheduledController
  | DOConstructorTrigger
  | 'do-alarm'
  | ForwardableEmailMessage;

export interface DOConstructorTrigger {
  id: string;
  name?: string;
}

/**
 * Config types
 */
export interface OTLPExporterConfig {
  url: string;
  headers?: Record<string, string>;
}

export type ExporterConfig = OTLPExporterConfig | SpanExporter;

export interface ServiceConfig {
  name: string;
  namespace?: string;
  version?: string;
}

export interface ParentRatioSamplingConfig {
  acceptRemote?: boolean;
  ratio: number;
}

type HeadSamplerConf = Sampler | ParentRatioSamplingConfig;

export interface SamplingConfig<HS extends HeadSamplerConf = HeadSamplerConf> {
  headSampler?: HS;
  tailSampler?: TailSampleFn;
}

export interface InstrumentationOptions {
  instrumentGlobalFetch?: boolean;
  instrumentGlobalCache?: boolean;
  /**
   * Disable instrumentation entirely (useful for local development)
   * When enabled, the handler is returned as-is without any instrumentation
   * @default false
   */
  disabled?: boolean;
}

/**
 * Utility types
 */
export type OrPromise<T> = T | Promise<T>;

/**
 * Adapter event types
 */
export type FunnelStepStatus =
  | 'started'
  | 'completed'
  | 'abandoned'
  | 'failed'
  | (string & {});

export type OutcomeStatus =
  | 'success'
  | 'failure'
  | 'partial'
  | (string & {});

export interface EdgeAdaptersEventBase {
  [key: string]: unknown;
  service: string;
  timestamp: number;
  attributes: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  name: string; // Normalized event name for easy access
}

export interface EdgeAdaptersTrackEvent extends EdgeAdaptersEventBase {
  type: 'event';
  event: string;
}

export interface EdgeAdaptersFunnelStepEvent extends EdgeAdaptersEventBase {
  type: 'funnel-step';
  funnel: string;
  status: FunnelStepStatus;
}

export interface EdgeAdaptersOutcomeEvent extends EdgeAdaptersEventBase {
  type: 'outcome';
  operation: string;
  outcome: OutcomeStatus;
}

export interface EdgeAdaptersValueEvent extends EdgeAdaptersEventBase {
  type: 'value';
  metric: string;
  value: number;
}

export type EdgeAdaptersEvent =
  | EdgeAdaptersTrackEvent
  | EdgeAdaptersFunnelStepEvent
  | EdgeAdaptersOutcomeEvent
  | EdgeAdaptersValueEvent;

export type EdgeAdaptersAdapter = (event: EdgeAdaptersEvent) => OrPromise<void>;

export interface FetcherConfig {
  includeTraceContext?: boolean | ((request: Request) => boolean);
}

export interface PostProcessParams {
  /**
   * The request object that was passed to the fetch handler.
   */
  request: Request;
  /**
   * The generated response object.
   */
  response: Response;
  /**
   * A readable version of the span object that can be used to access the span's attributes and events.
   */
  readable: ReadableSpan;
}

export interface FetchHandlerConfig {
  /**
   * Whether to enable context propagation for incoming requests to `fetch`.
   * This enables or disables distributed tracing from W3C Trace Context headers.
   * @default true
   */
  acceptTraceContext?: boolean | ((request: Request) => boolean);
  /**
   * Allows further customization of the generated span, based on the request/response data.
   */
  postProcess?: (span: Span, ctx: PostProcessParams) => void;
}

export interface HandlerConfig {
  fetch?: FetchHandlerConfig;
}

interface EdgeConfigBase {
  service: ServiceConfig;
  handlers?: HandlerConfig;
  fetch?: FetcherConfig;
  postProcessor?: PostProcessorFn;
  sampling?: SamplingConfig;
  propagator?: TextMapPropagator;
  instrumentation?: InstrumentationOptions;
  adapters?: EdgeAdaptersAdapter[];
}

interface EdgeConfigExporter extends EdgeConfigBase {
  exporter: ExporterConfig;
}

interface EdgeConfigSpanProcessors extends EdgeConfigBase {
  spanProcessors: SpanProcessor | SpanProcessor[];
}

export type EdgeConfig = EdgeConfigExporter | EdgeConfigSpanProcessors;

export function isSpanProcessorConfig(
  config: EdgeConfig,
): config is EdgeConfigSpanProcessors {
  return !!(config as EdgeConfigSpanProcessors).spanProcessors;
}

export interface ResolvedEdgeConfig extends EdgeConfigBase {
  handlers: Required<HandlerConfig>;
  fetch: Required<FetcherConfig>;
  postProcessor: PostProcessorFn;
  sampling: Required<SamplingConfig<Sampler>>;
  spanProcessors: SpanProcessor[];
  propagator: TextMapPropagator;
  instrumentation: InstrumentationOptions;
  adapters: EdgeAdaptersAdapter[];
}

/**
 * Function types
 */
export type ResolveConfigFn<Env = any> = (
  env: Env,
  trigger: Trigger,
) => EdgeConfig;
export type ConfigurationOption = EdgeConfig | ResolveConfigFn;

export type PostProcessorFn = (spans: ReadableSpan[]) => ReadableSpan[];
export type TailSampleFn = (traceInfo: LocalTrace) => boolean;

export interface LocalTrace {
  traceId: string;
  spans: ReadableSpan[];
  localRootSpan: ReadableSpan;
}

/**
 * Span processor with flush support
 */
export type TraceFlushableSpanProcessor = SpanProcessor & {
  forceFlush: (traceId?: string) => Promise<void>;
};

/**
 * Handler instrumentation
 */
export interface InitialSpanInfo {
  name: string;
  options: SpanOptions;
  context?: Context;
}

export interface HandlerInstrumentation<T extends Trigger, R extends any> {
  getInitialSpanInfo: (trigger: T) => InitialSpanInfo;
  getAttributesFromResult?: (result: Awaited<R>) => Attributes;
  instrumentTrigger?: (trigger: T) => T;
  executionSucces?: (span: Span, trigger: T, result: Awaited<R>) => void;
  executionFailed?: (span: Span, trigger: T, error?: any) => void;
}

/**
 * Utility types
 */
