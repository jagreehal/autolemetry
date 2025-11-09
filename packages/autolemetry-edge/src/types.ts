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
}

export interface FetcherConfig {
  includeTraceContext?: boolean | ((request: Request) => boolean);
}

export interface FetchHandlerConfig {
  acceptTraceContext?: boolean | ((request: Request) => boolean);
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
export type OrPromise<T extends any> = T | Promise<T>;
