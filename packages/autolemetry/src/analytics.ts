/**
 * Analytics API for product analytics platforms
 *
 * Track user behavior, business events, and critical actions.
 * Sends to product analytics platforms (PostHog, Mixpanel, Amplitude) via adapters.
 * For business people who think in events/funnels.
 *
 * For OpenTelemetry metrics (Prometheus/Grafana), use the Metrics class instead.
 *
 * @example Track analytics events
 * ```typescript
 * import { PostHogAdapter } from 'autolemetry-adapters/posthog';
 *
 * const analytics = new Analytics('job-application', {
 *   adapters: [new PostHogAdapter({ apiKey: 'phc_...' })]
 * })
 *
 * // Track events
 * analytics.trackEvent('application.submitted', {
 *   jobId: '123',
 *   userId: '456'
 * })
 *
 * // Track conversion funnel
 * analytics.trackFunnelStep('application', 'started', { userId: '456' })
 * analytics.trackFunnelStep('application', 'completed', { userId: '456' })
 *
 * // Track outcomes
 * analytics.trackOutcome('email.sent', 'success', { recipientCount: 1 })
 * analytics.trackOutcome('email.sent', 'failure', { error: 'invalid_address' })
 * ```
 */

import { trace } from '@opentelemetry/api';
import { type Logger } from './logger';
import { getLogger, getValidationConfig, getConfig } from './init';
import {
  type AnalyticsAdapter,
  type EventAttributes,
  type FunnelStatus,
  type OutcomeStatus,
} from './analytics-adapter';
import { type AnalyticsCollector } from './analytics-testing';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { validateEvent } from './validation';
import { getOperationContext } from './operation-context';

// Re-export types for convenience
export type {
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from './analytics-adapter';

/**
 * Analytics class for tracking user behavior and product events
 *
 * Track critical indicators such as:
 * - User events (signups, purchases, feature usage)
 * - Conversion funnels (signup → activation → purchase)
 * - Business outcomes (success/failure rates)
 * - Product metrics (revenue, engagement, retention)
 *
 * All events are sent to analytics platforms via adapters (PostHog, Mixpanel, etc.).
 * For OpenTelemetry metrics, use the Metrics class instead.
 */
/**
 * Analytics options
 */
export interface AnalyticsOptions {
  /** Optional logger for audit trail */
  logger?: Logger;
  /** Optional collector for testing (captures events in memory) */
  collector?: AnalyticsCollector;
  /**
   * Optional adapters to send analytics to other platforms
   * (e.g., PostHog, Mixpanel, Amplitude)
   *
   * Install `autolemetry-adapters` package for ready-made adapters
   */
  adapters?: AnalyticsAdapter[];
}

export class Analytics {
  private serviceName: string;
  private logger?: Logger;
  private collector?: AnalyticsCollector;
  private adapters: AnalyticsAdapter[];
  private hasAdapters: boolean; // Cached for performance
  private circuitBreakers: Map<AnalyticsAdapter, CircuitBreaker>; // One per adapter

  /**
   * Create a new Analytics instance
   *
   * @param serviceName - Service name for identifying analytics events
   * @param options - Optional configuration (logger, collector, adapters)
   *
   * @example Basic usage (requires adapters to actually send data)
   * ```typescript
   * const analytics = new Analytics('checkout', {
   *   adapters: [new PostHogAdapter({ apiKey: 'phc_...' })]
   * });
   * ```
   *
   * @example With adapters (requires autolemetry-adapters package)
   * ```typescript
   * import { PostHogAdapter } from 'autolemetry-adapters/posthog';
   *
   * const analytics = new Analytics('checkout', {
   *   adapters: [
   *     new PostHogAdapter({ apiKey: 'phc_...' })
   *   ]
   * });
   * ```
   */
  constructor(serviceName: string, options: AnalyticsOptions = {}) {
    this.serviceName = serviceName;
    this.logger = options.logger;
    this.collector = options.collector;
    this.adapters = options.adapters || [];
    this.hasAdapters = this.adapters.length > 0; // Cache for hot path

    // Create circuit breaker for each adapter
    this.circuitBreakers = new Map();
    for (const adapter of this.adapters) {
      const adapterName = adapter.name || 'Unknown';
      this.circuitBreakers.set(
        adapter,
        new CircuitBreaker(adapterName, {
          failureThreshold: 5,
          resetTimeout: 30_000, // 30s
          windowSize: 60_000, // 1min
        }),
      );
    }
  }

  /**
   * Automatically enrich attributes with all available telemetry context
   *
   * Auto-captures:
   * - Resource attributes: service.version, deployment.environment
   * - Trace context: traceId, spanId, correlationId
   * - Operation context: operation.name
   */
  private enrichWithTelemetryContext(
    attributes: EventAttributes = {},
  ): EventAttributes {
    const enriched: EventAttributes = {
      service: this.serviceName,
      ...attributes,
    };

    // 1. Resource attributes (service-level context)
    const config = getConfig();
    if (config) {
      if (config.version) {
        enriched['service.version'] = config.version;
      }
      if (config.environment) {
        enriched['deployment.environment'] = config.environment;
      }
    }

    // 2. Trace context (if inside a traced operation)
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    if (spanContext) {
      enriched.traceId = spanContext.traceId;
      enriched.spanId = spanContext.spanId;
      // Add correlation ID (first 16 chars of trace ID) for easier log grouping
      enriched.correlationId = spanContext.traceId.slice(0, 16);
    }

    // 3. Operation context (if inside a trace/span)
    const operationContext = getOperationContext();
    if (operationContext) {
      enriched['operation.name'] = operationContext.name;
    }

    return enriched;
  }

  /**
   * Track an analytics event
   *
   * Use this for tracking user actions, business events, product usage:
   * - "user.signup"
   * - "order.completed"
   * - "feature.used"
   *
   * Events are sent to configured adapters (PostHog, Mixpanel, etc.).
   *
   * @example
   * ```typescript
   * // Track user signup
   * analytics.trackEvent('user.signup', {
   *   userId: '123',
   *   plan: 'pro'
   * })
   *
   * // Track order
   * analytics.trackEvent('order.completed', {
   *   orderId: 'ord_123',
   *   amount: 99.99
   * })
   * ```
   */
  trackEvent(eventName: string, attributes?: EventAttributes): void {
    // Validate and sanitize input (with custom config if provided)
    const validationConfig = getValidationConfig();
    const validated = validateEvent(
      eventName,
      attributes,
      validationConfig || undefined,
    );

    // Auto-attach all available telemetry context
    const enrichedAttributes = this.enrichWithTelemetryContext(
      validated.attributes,
    );

    this.logger?.info('Analytics event tracked', {
      event: validated.eventName,
      attributes: enrichedAttributes,
    });

    // Record for testing
    this.collector?.recordEvent({
      event: validated.eventName,
      attributes: enrichedAttributes,
      service: this.serviceName,
      timestamp: Date.now(),
    });

    // Notify adapters (zero overhead if no adapters)
    // Run in background - don't block analytics recording
    if (this.hasAdapters) {
      void this.notifyAdapters((adapter) =>
        adapter.trackEvent(validated.eventName, enrichedAttributes),
      );
    }
  }

  /**
   * Notify all adapters concurrently without blocking
   * Uses circuit breakers to protect against failing adapters
   * Uses Promise.allSettled to prevent adapter errors from affecting other adapters
   */
  private async notifyAdapters(
    fn: (adapter: AnalyticsAdapter) => Promise<void>,
  ): Promise<void> {
    const promises = this.adapters.map(async (adapter) => {
      const circuitBreaker = this.circuitBreakers.get(adapter);
      if (!circuitBreaker) return; // Should never happen

      try {
        // Execute with circuit breaker protection
        await circuitBreaker.execute(() => fn(adapter));
      } catch (error) {
        // Handle circuit open errors (expected behavior when adapter is down)
        if (error instanceof CircuitOpenError) {
          // Circuit is open - adapter is down, log at warn level for visibility (same behavior in all environments)
          getLogger().warn(`[Analytics] ${error.message}`, {
            adapterName: adapter.name || 'Unknown',
          });
          return;
        }

        // Log other adapter errors but don't throw - analytics failures shouldn't break business logic
        getLogger().error(
          `[Analytics] Adapter ${adapter.name || 'Unknown'} failed`,
          error instanceof Error ? error : undefined,
          { adapterName: adapter.name || 'Unknown' },
        );
      }
    });

    // Wait for all adapters (success or failure)
    await Promise.allSettled(promises);
  }

  /**
   * Track conversion funnel steps
   *
   * Monitor where users drop off in multi-step processes.
   *
   * @example
   * ```typescript
   * // Track signup funnel
   * analytics.trackFunnelStep('signup', 'started', { userId: '123' })
   * analytics.trackFunnelStep('signup', 'email_verified', { userId: '123' })
   * analytics.trackFunnelStep('signup', 'completed', { userId: '123' })
   *
   * // Track checkout flow
   * analytics.trackFunnelStep('checkout', 'started', { cartValue: 99.99 })
   * analytics.trackFunnelStep('checkout', 'payment_info', { cartValue: 99.99 })
   * analytics.trackFunnelStep('checkout', 'completed', { cartValue: 99.99 })
   * ```
   */
  trackFunnelStep(
    funnelName: string,
    status: FunnelStatus,
    attributes?: EventAttributes,
  ): void {
    // Auto-attach all available telemetry context
    const enrichedAttributes = this.enrichWithTelemetryContext(attributes);

    this.logger?.info('Funnel step tracked', {
      funnel: funnelName,
      status,
      attributes: enrichedAttributes,
    });

    // Record for testing
    this.collector?.recordFunnelStep({
      funnel: funnelName,
      status,
      attributes: enrichedAttributes,
      service: this.serviceName,
      timestamp: Date.now(),
    });

    // Notify adapters
    if (this.hasAdapters) {
      void this.notifyAdapters((adapter) =>
        adapter.trackFunnelStep(funnelName, status, enrichedAttributes),
      );
    }
  }

  /**
   * Track outcomes (success/failure/partial)
   *
   * Monitor success rates of critical operations.
   *
   * @example
   * ```typescript
   * // Track email delivery
   * analytics.trackOutcome('email.delivery', 'success', {
   *   recipientType: 'user',
   *   emailType: 'welcome'
   * })
   *
   * analytics.trackOutcome('email.delivery', 'failure', {
   *   recipientType: 'user',
   *   errorCode: 'invalid_email'
   * })
   *
   * // Track payment processing
   * analytics.trackOutcome('payment.process', 'success', { amount: 99.99 })
   * analytics.trackOutcome('payment.process', 'failure', { error: 'insufficient_funds' })
   * ```
   */
  trackOutcome(
    operationName: string,
    status: OutcomeStatus,
    attributes?: EventAttributes,
  ): void {
    // Auto-attach all available telemetry context
    const enrichedAttributes = this.enrichWithTelemetryContext(attributes);

    this.logger?.info('Outcome tracked', {
      operation: operationName,
      status,
      attributes: enrichedAttributes,
    });

    // Record for testing
    this.collector?.recordOutcome({
      operation: operationName,
      status,
      attributes: enrichedAttributes,
      service: this.serviceName,
      timestamp: Date.now(),
    });

    // Notify adapters
    if (this.hasAdapters) {
      void this.notifyAdapters((adapter) =>
        adapter.trackOutcome(operationName, status, enrichedAttributes),
      );
    }
  }

  /**
   * Track value metrics
   *
   * Record numerical values like revenue, transaction amounts,
   * item counts, processing times, engagement scores, etc.
   *
   * @example
   * ```typescript
   * // Track revenue
   * analytics.trackValue('order.revenue', 149.99, {
   *   currency: 'USD',
   *   productCategory: 'electronics'
   * })
   *
   * // Track items per cart
   * analytics.trackValue('cart.item_count', 5, {
   *   userId: '123'
   * })
   *
   * // Track processing time
   * analytics.trackValue('api.response_time', 250, {
   *   unit: 'ms',
   *   endpoint: '/api/checkout'
   * })
   * ```
   */
  trackValue(
    metricName: string,
    value: number,
    attributes?: EventAttributes,
  ): void {
    // Auto-attach all available telemetry context
    const enrichedAttributes = this.enrichWithTelemetryContext({
      metric: metricName,
      ...attributes,
    });

    this.logger?.debug('Value tracked', {
      metric: metricName,
      value,
      attributes: enrichedAttributes,
    });

    // Record for testing
    this.collector?.recordValue({
      metric: metricName,
      value,
      attributes: enrichedAttributes,
      service: this.serviceName,
      timestamp: Date.now(),
    });

    // Notify adapters
    if (this.hasAdapters) {
      void this.notifyAdapters((adapter) =>
        adapter.trackValue(metricName, value, enrichedAttributes),
      );
    }
  }

  /**
   * Flush all adapters and wait for pending events
   *
   * Call this before shutdown to ensure all events are delivered.
   *
   * @example
   * ```typescript
   * const analytics = new Analytics('app', { adapters: [...] });
   *
   * // Before shutdown
   * await analytics.flush();
   * ```
   */
  async flush(): Promise<void> {
    if (!this.hasAdapters) return;

    const shutdownPromises = this.adapters.map(async (adapter) => {
      if (adapter.shutdown) {
        try {
          await adapter.shutdown();
        } catch (error) {
          getLogger().error(
            `[Analytics] Failed to shutdown adapter ${adapter.name || 'Unknown'}`,
            error instanceof Error ? error : undefined,
            { adapterName: adapter.name || 'Unknown' },
          );
        }
      }
    });

    await Promise.allSettled(shutdownPromises);
  }
}

/**
 * Global analytics instances (singleton pattern)
 */
const analyticsInstances = new Map<string, Analytics>();

/**
 * Get or create an Analytics instance for a service
 *
 * @param serviceName - Service name for identifying analytics events
 * @param logger - Optional logger
 * @returns Analytics instance
 *
 * @example
 * ```typescript
 * const analytics = getAnalytics('job-application')
 * analytics.trackEvent('application.submitted', { jobId: '123' })
 * ```
 */
export function getAnalytics(serviceName: string, logger?: Logger): Analytics {
  if (!analyticsInstances.has(serviceName)) {
    analyticsInstances.set(serviceName, new Analytics(serviceName, { logger }));
  }
  return analyticsInstances.get(serviceName)!;
}

/**
 * Reset all analytics instances (mainly for testing)
 */
export function resetAnalytics(): void {
  analyticsInstances.clear();
}
