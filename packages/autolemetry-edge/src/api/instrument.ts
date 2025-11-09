/**
 * Handler instrumentation for Cloudflare Workers
 * Adapted from otel-cf-workers
 */

import {
  trace,
  context as api_context,
  propagation,
  SpanStatusCode,
  SpanKind,
} from '@opentelemetry/api';
import { SEMATTRS_HTTP_METHOD, SEMATTRS_HTTP_URL, SEMATTRS_HTTP_STATUS_CODE } from '@opentelemetry/semantic-conventions';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type {
  ConfigurationOption,
  ResolvedEdgeConfig,
  Trigger,
  HandlerInstrumentation,
  InitialSpanInfo,
} from '../types';
import {
  createInitialiser,
  setConfig,
  type Initialiser,
} from '../core/config';
import { WorkerTracerProvider } from '../core/provider';
import { WorkerTracer } from '../core/tracer';
import { proxyExecutionContext, unwrap, type PromiseTracker } from '../instrumentation/common';
import { instrumentGlobalFetch } from '../instrumentation/fetch';
import { instrumentGlobalCache } from '../instrumentation/cache';

type FetchHandler = (
  request: Request,
  env: any,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

/**
 * Fetch handler instrumentation
 */
const fetchInstrumentation: HandlerInstrumentation<Request, Response> = {
  getInitialSpanInfo: (request: Request): InitialSpanInfo => {
    const url = new URL(request.url);

    return {
      name: `${request.method} ${url.pathname}`,
      options: {
        kind: SpanKind.SERVER,
        attributes: {
          [SEMATTRS_HTTP_METHOD]: request.method,
          [SEMATTRS_HTTP_URL]: request.url,
        },
      },
      context: propagation.extract(api_context.active(), request.headers),
    };
  },
  getAttributesFromResult: (response: Response) => ({
    [SEMATTRS_HTTP_STATUS_CODE]: response.status,
  }),
};

/**
 * Export spans after request completes
 */
async function exportSpans(traceId: string, tracker?: PromiseTracker) {
  const tracer = trace.getTracer('autolemetry-edge');
  if (tracer instanceof WorkerTracer) {
    await scheduler.wait(1);
    await tracker?.wait();
    await tracer.forceFlush(traceId);
  }
}

/**
 * Create handler flow with instrumentation
 */
function createHandlerFlow<T extends Trigger, E, R>(
  instrumentation: HandlerInstrumentation<T, R>,
) {
  return (
    handlerFn: (trigger: T, env: E, ctx: ExecutionContext) => R | Promise<R>,
    [trigger, env, context]: [T, E, ExecutionContext],
  ) => {
    const { ctx: proxiedCtx, tracker } = proxyExecutionContext(context);

    const tracer = trace.getTracer('autolemetry-edge') as WorkerTracer;

    const { name, options, context: spanContext } =
      instrumentation.getInitialSpanInfo(trigger);

    const parentContext = spanContext || api_context.active();

    return tracer.startActiveSpan(name, options, parentContext, async (span) => {
      try {
        const result = await handlerFn(trigger, env, proxiedCtx);

        if (instrumentation.getAttributesFromResult) {
          const attributes = instrumentation.getAttributesFromResult(result);
          span.setAttributes(attributes);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
        context.waitUntil(exportSpans(span.spanContext().traceId, tracker));
      }
    });
  };
}

/**
 * Create handler proxy
 */
function createHandlerProxy<T extends Trigger, E, R>(
  _handler: unknown,
  handlerFn: (trigger: T, env: E, ctx: ExecutionContext) => R | Promise<R>,
  initialiser: Initialiser,
  instrumentation: HandlerInstrumentation<T, R>,
): (trigger: T, env: E, ctx: ExecutionContext) => ReturnType<typeof handlerFn> {
  return (trigger: T, env: E, ctx: ExecutionContext) => {
    const config = initialiser(env, trigger);
    const configContext = setConfig(config);

    // Initialize provider on first call
    initProvider(config);

    const flowFn = createHandlerFlow<T, E, R>(instrumentation);

    // Execute the handler flow within the config context
    return api_context.with(configContext, () => {
      return flowFn(handlerFn, [trigger, env, ctx]) as ReturnType<typeof handlerFn>;
    });
  };
}

let providerInitialized = false;

/**
 * Initialize the tracer provider
 */
function initProvider(config: ResolvedEdgeConfig): void {
  if (providerInitialized) return;

  // Install global instrumentations
  if (config.instrumentation.instrumentGlobalFetch) {
    instrumentGlobalFetch();
  }
  if (config.instrumentation.instrumentGlobalCache) {
    instrumentGlobalCache();
  }

  // Set up propagator
  propagation.setGlobalPropagator(config.propagator);

  // Create resource
  const resource = resourceFromAttributes({
    'service.name': config.service.name,
    'service.version': config.service.version,
    'service.namespace': config.service.namespace,
    'cloud.provider': 'cloudflare',
    'cloud.platform': 'cloudflare.workers',
    'telemetry.sdk.name': 'autolemetry-edge',
    'telemetry.sdk.language': 'js',
  });

  // Create and register provider
  const provider = new WorkerTracerProvider(config.spanProcessors, resource);
  provider.register();

  // Set head sampler on tracer
  const tracer = trace.getTracer('autolemetry-edge') as WorkerTracer;
  tracer.setHeadSampler(config.sampling.headSampler);

  providerInitialized = true;
}

/**
 * Instrument a Cloudflare Workers handler
 *
 * @example
 * ```typescript
 * import { instrument } from 'autolemetry-edge'
 *
 * const handler = {
 *   async fetch(request, env, ctx) {
 *     return new Response('Hello World')
 *   }
 * }
 *
 * export default instrument(handler, {
 *   exporter: {
 *     url: env.OTLP_ENDPOINT,
 *     headers: { 'x-api-key': env.API_KEY }
 *   },
 *   service: { name: 'my-worker' }
 * })
 * ```
 */
export function instrument<E, Q = any, C = any>(
  handler: ExportedHandler<E, Q, C>,
  config: ConfigurationOption,
): ExportedHandler<E, Q, C> {
  const initialiser = createInitialiser(config);

  if (handler.fetch) {
    const fetcher = unwrap(handler.fetch) as FetchHandler;
    handler.fetch = createHandlerProxy(
      handler,
      fetcher,
      initialiser,
      fetchInstrumentation,
    );
  }

  // TODO: Add scheduled, queue, email handlers

  return handler;
}
