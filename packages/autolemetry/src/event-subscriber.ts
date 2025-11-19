/**
 * Analytics Adapter Interface (Type-only)
 *
 * Import this interface to create custom adapters without importing implementations.
 * Keeps core package focused on OpenTelemetry with zero extra dependencies.
 *
 * For ready-made adapters (PostHog, Mixpanel, Amplitude, Segment),
 * see the separate `autolemetry-adapters` package.
 *
 * @example Custom adapter
 * ```typescript
 * import { AnalyticsAdapter } from 'autolemetry/analytics-adapter';
 *
 * class MyCustomAdapter implements AnalyticsAdapter {
 *   trackEvent(name: string, attributes?: Record<string, any>): void {
 *     // Send to your analytics platform
 *   }
 *   // ... implement other methods
 * }
 * ```
 *
 * @example Use pre-built adapters
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { PostHogAdapter } from 'autolemetry-adapters/posthog';
 * import { MixpanelAdapter } from 'autolemetry-adapters/mixpanel';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new PostHogAdapter({ apiKey: 'phc_...' }),
 *     new MixpanelAdapter({ token: '...' })
 *   ]
 * });
 * ```
 */

/**
 * Event attributes (supports any JSON-serializable values)
 */
export type EventAttributes = Record<string, string | number | boolean>;

/**
 * Funnel step status
 */
export type FunnelStatus = 'started' | 'completed' | 'abandoned' | 'failed';

/**
 * Outcome status
 */
export type OutcomeStatus = 'success' | 'failure' | 'partial';

/**
 * Analytics adapter interface
 *
 * Implement this to send analytics to any platform.
 * Zero runtime dependencies - just types.
 *
 * All tracking methods are async to support:
 * - Backpressure signaling (buffer full)
 * - Streaming platforms (Kafka, Kinesis, Pub/Sub)
 * - Await delivery confirmation
 * - Proper error propagation
 */
export interface AnalyticsAdapter {
  /**
   * Track an event (e.g., "user.registered", "order.created")
   *
   * @returns Promise that resolves when event is sent (or buffered)
   */
  trackEvent(name: string, attributes?: EventAttributes): Promise<void>;

  /**
   * Track a funnel step (e.g., checkout: started → completed)
   *
   * @returns Promise that resolves when event is sent (or buffered)
   */
  trackFunnelStep(
    funnelName: string,
    step: FunnelStatus,
    attributes?: EventAttributes,
  ): Promise<void>;

  /**
   * Track an outcome (e.g., "payment.processing" → success/failure)
   *
   * @returns Promise that resolves when event is sent (or buffered)
   */
  trackOutcome(
    operationName: string,
    outcome: OutcomeStatus,
    attributes?: EventAttributes,
  ): Promise<void>;

  /**
   * Track a value/metric (e.g., revenue, cart value)
   *
   * @returns Promise that resolves when event is sent (or buffered)
   */
  trackValue(
    name: string,
    value: number,
    attributes?: EventAttributes,
  ): Promise<void>;

  /**
   * Optional: Flush pending events and clean up resources
   *
   * Implement this if your adapter buffers events, maintains connections,
   * or needs cleanup before shutdown. Called during graceful shutdown.
   *
   * @example
   * ```typescript
   * class MyAdapter implements AnalyticsAdapter {
   *   async shutdown(): Promise<void> {
   *     await this.flushBuffer();
   *     await this.closeConnections();
   *   }
   * }
   * ```
   */
  shutdown?(): Promise<void>;

  /**
   * Optional: Adapter name for debugging and error reporting
   *
   * @example "PostHogAdapter", "SnowflakeAdapter", "CustomWebhookAdapter"
   */
  readonly name?: string;

  /**
   * Optional: Adapter version for debugging
   *
   * @example "1.0.0"
   */
  readonly version?: string;
}
