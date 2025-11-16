import { trace } from '@opentelemetry/api';
import { getActiveConfig } from '../core/config';
import type {
  OrPromise,
  EdgeAdaptersEvent,
  FunnelStepStatus,
  OutcomeStatus,
  EdgeAdaptersTrackEvent,
  EdgeAdaptersFunnelStepEvent,
  EdgeAdaptersOutcomeEvent,
  EdgeAdaptersValueEvent,
  EdgeAdaptersEventBase,
} from '../types';

export type AdaptersDeliveryMode = 'fire-and-forget' | 'await';

// Re-export event types for convenience
export type {
  FunnelStepStatus,
  OutcomeStatus,
  EdgeAdaptersEvent,
  EdgeAdaptersTrackEvent,
  EdgeAdaptersFunnelStepEvent,
  EdgeAdaptersOutcomeEvent,
  EdgeAdaptersValueEvent,
};

export type EdgeAdaptersTransport = (event: EdgeAdaptersEvent) => OrPromise<void>;

export interface EdgeAdaptersDispatchOptions {
  delivery?: AdaptersDeliveryMode;
  waitUntil?: (promise: Promise<void>) => void;
}

export interface CreateEdgeAdaptersOptions {
  /**
   * User-supplied transport invoked for every Adapters event.
   * Implementations can call PostHog, Stripe, Zapier, Durable Objects, etc.
   */
  transport: EdgeAdaptersTransport;
  /**
   * Optional service name used when no request config is active.
   * Defaults to the active instrumentation config's service name or "edge-service".
   */
  service?: string;
  /**
   * Default delivery behaviour for transport promises.
   * "fire-and-forget" (default) will not block the calling code.
   */
  delivery?: AdaptersDeliveryMode;
  /**
   * Default waitUntil handler (Cloudflare Workers, Vercel waitUntil).
   * Used when delivery === "fire-and-forget".
   */
  waitUntil?: (promise: Promise<void>) => void;
  /**
   * Optional error handler invoked when the transport rejects.
   */
  onError?: (error: unknown, event: EdgeAdaptersEvent) => void;
  /**
   * Include OpenTelemetry trace/span identifiers in the payload. Default true.
   */
  includeTraceContext?: boolean;
}

export interface EdgeAdapters {
  trackEvent(
    event: string,
    attributes?: Record<string, unknown>,
    options?: EdgeAdaptersDispatchOptions,
  ): OrPromise<void>;
  trackFunnelStep(
    funnel: string,
    status: FunnelStepStatus,
    attributes?: Record<string, unknown>,
    options?: EdgeAdaptersDispatchOptions,
  ): OrPromise<void>;
  trackOutcome(
    operation: string,
    outcome: OutcomeStatus,
    attributes?: Record<string, unknown>,
    options?: EdgeAdaptersDispatchOptions,
  ): OrPromise<void>;
  trackValue(
    metric: string,
    value: number,
    attributes?: Record<string, unknown>,
    options?: EdgeAdaptersDispatchOptions,
  ): OrPromise<void>;
  dispatch(event: EdgeAdaptersEvent, options?: EdgeAdaptersDispatchOptions): OrPromise<void>;
  bind(options: EdgeAdaptersDispatchOptions): EdgeAdapters;
}

const DEFAULT_SERVICE_NAME = 'edge-service';

/**
 * Extract a normalized event name from any EdgeAdaptersEvent.
 * Useful for adapters that need to send events to analytics platforms.
 * 
 * @deprecated Use `event.name` directly instead - it's now a property on all events.
 * 
 * @example
 * ```typescript
 * const adapter: EdgeAdaptersAdapter = async (event) => {
 *   await sendToAnalytics(event.name, event.attributes) // Use event.name directly
 * }
 * ```
 */
export function getEventName(event: EdgeAdaptersEvent): string {
  return event.name;
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value;
}

function createBaseEvent(
  attributes: Record<string, unknown> | undefined,
  options: CreateEdgeAdaptersOptions,
): Omit<EdgeAdaptersEventBase, 'name'> {
  const config = getActiveConfig();
  // Prioritize explicit service override, then config service name, then default
  const serviceName = options.service ?? config?.service.name ?? DEFAULT_SERVICE_NAME;
  const baseAttributes = attributes ? { ...attributes } : {};

  const baseEvent: Omit<EdgeAdaptersEventBase, 'name'> = {
    service: serviceName,
    timestamp: Date.now(),
    attributes: baseAttributes,
  };

  if (options.includeTraceContext ?? true) {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    if (spanContext) {
      baseEvent.traceId = spanContext.traceId;
      baseEvent.spanId = spanContext.spanId;
      baseEvent.correlationId = spanContext.traceId.slice(0, 16);
    }
  }

  return baseEvent;
}

function handleError(
  error: unknown,
  event: EdgeAdaptersEvent,
  options: CreateEdgeAdaptersOptions,
): void {
  if (options.onError) {
    try {
      options.onError(error, event);
      return;
    } catch (handlerError) {
      console.error('[autolemetry-edge] Adapters onError handler failed', handlerError);
    }
  }

  console.error('[autolemetry-edge] Adapters transport failed', error, { event });
}

function deliverResult(
  result: OrPromise<void>,
  event: EdgeAdaptersEvent,
  delivery: AdaptersDeliveryMode,
  waitUntil: EdgeAdaptersDispatchOptions['waitUntil'],
  createOptions: CreateEdgeAdaptersOptions,
): OrPromise<void> {
  if (!isPromiseLike(result)) {
    return delivery === 'await' ? Promise.resolve() : undefined;
  }

  if (delivery === 'await') {
    return Promise.resolve(result).catch((error) => {
      handleError(error, event, createOptions);
      throw error;
    });
  }

  const background = Promise.resolve(result).catch((error) => {
    handleError(error, event, createOptions);
  });

  if (waitUntil) {
    waitUntil(background);
  } else {
    void background;
  }

  return undefined;
}

function createAdaptersInstance(
  options: CreateEdgeAdaptersOptions,
  bindings: EdgeAdaptersDispatchOptions = {},
): EdgeAdapters {
  const dispatch = (
    event: EdgeAdaptersEvent,
    callOptions?: EdgeAdaptersDispatchOptions,
  ): OrPromise<void> => {
    const delivery =
      callOptions?.delivery ??
      bindings.delivery ??
      options.delivery ??
      ('fire-and-forget' as AdaptersDeliveryMode);
    const waitUntil = callOptions?.waitUntil ?? bindings.waitUntil ?? options.waitUntil;
    const result = options.transport(event);
    return deliverResult(result, event, delivery, waitUntil, options);
  };

  const trackEvent: EdgeAdapters['trackEvent'] = (eventName, attributes, callOptions) => {
    const baseEvent = createBaseEvent(attributes, options);
    const event: EdgeAdaptersTrackEvent = {
      ...baseEvent,
      type: 'event',
      event: eventName,
      name: eventName,
    } as EdgeAdaptersTrackEvent;
    return dispatch(event, callOptions);
  };

  const trackFunnelStep: EdgeAdapters['trackFunnelStep'] = (
    funnel,
    status,
    attributes,
    callOptions,
  ) => {
    const baseEvent = createBaseEvent(attributes, options);
    const event: EdgeAdaptersFunnelStepEvent = {
      ...baseEvent,
      type: 'funnel-step',
      funnel,
      status,
      name: `funnel-step.${status}`,
    } as EdgeAdaptersFunnelStepEvent;
    return dispatch(event, callOptions);
  };

  const trackOutcome: EdgeAdapters['trackOutcome'] = (
    operation,
    outcome,
    attributes,
    callOptions,
  ) => {
    const baseEvent = createBaseEvent(attributes, options);
    const event: EdgeAdaptersOutcomeEvent = {
      ...baseEvent,
      type: 'outcome',
      operation,
      outcome,
      name: `outcome.${outcome}`,
    } as EdgeAdaptersOutcomeEvent;
    return dispatch(event, callOptions);
  };

  const trackValue: EdgeAdapters['trackValue'] = (
    metric,
    value,
    attributes,
    callOptions,
  ) => {
    const baseEvent = createBaseEvent(attributes, options);
    const event: EdgeAdaptersValueEvent = {
      ...baseEvent,
      type: 'value',
      metric,
      value,
      name: `value.${metric}`,
    } as EdgeAdaptersValueEvent;
    return dispatch(event, callOptions);
  };

  return {
    trackEvent,
    trackFunnelStep,
    trackOutcome,
    trackValue,
    dispatch,
    bind: (nextBindings: EdgeAdaptersDispatchOptions) =>
      createAdaptersInstance(options, { ...bindings, ...nextBindings }),
  };
}

export function createEdgeAdapters(options: CreateEdgeAdaptersOptions): EdgeAdapters {
  if (typeof options.transport !== 'function') {
    throw new Error('createEdgeAdapters: options.transport is required');
  }

  return createAdaptersInstance(options);
}

/**
 * Get Adapters instance from active config, bound to the current ExecutionContext.
 * Returns null if Adapters is not configured.
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request, env, ctx) {
 *     const Adapters = getEdgeAdapters(ctx);
 *     if (Adapters) {
 *       Adapters.trackEvent('user.signup', { plan: 'pro' });
 *     }
 *     return new Response('ok');
 *   }
 * }
 * ```
 */
export function getEdgeAdapters(
  ctx?: ExecutionContext,
): EdgeAdapters | null {
  const config = getActiveConfig();
  if (!config) {
    return null;
  }

  const adapters = config.adapters ?? [];
  if (!adapters.length) {
    return null;
  }

  // Combine all adapters into a single transport function
  const combinedTransport: EdgeAdaptersTransport = async (event) => {
    await Promise.all(
      adapters.map(async (adapter, index) => {
        try {
          await adapter(event);
        } catch (error) {
          console.error('[autolemetry-edge] Adapters adapter failed', error, {
            adapterIndex: index,
            eventType: event.type,
          });
        }
      }),
    );
  };

  return createEdgeAdapters({
    transport: combinedTransport,
    service: config.service.name,
    waitUntil: ctx ? (promise) => ctx.waitUntil(promise) : undefined,
  });
}

