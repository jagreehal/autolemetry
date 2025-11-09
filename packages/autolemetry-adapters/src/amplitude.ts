/**
 * Amplitude Adapter for autolemetry
 *
 * Send analytics to Amplitude for product analytics.
 *
 * @example
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { AmplitudeAdapter } from 'autolemetry-adapters/amplitude';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new AmplitudeAdapter({
 *       apiKey: process.env.AMPLITUDE_API_KEY!
 *     })
 *   ]
 * });
 *
 * analytics.trackEvent('order.completed', { userId: '123', amount: 99.99 });
 * ```
 */

import type {
  AnalyticsAdapter,
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from 'autolemetry/analytics-adapter';

export interface AmplitudeConfig {
  /** Amplitude API key */
  apiKey: string;
  /** Enable/disable the adapter */
  enabled?: boolean;
}

export class AmplitudeAdapter implements AnalyticsAdapter {
  readonly name = 'AmplitudeAdapter';
  readonly version = '1.0.0';

  private amplitude: any;
  private enabled: boolean;
  private config: AmplitudeConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: AmplitudeConfig) {
    this.enabled = config.enabled ?? true;
    this.config = config;

    if (this.enabled) {
      // Start initialization immediately but don't block constructor
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid adding @amplitude/analytics-node as a hard dependency
      const { init } = await import('@amplitude/analytics-node');
      this.amplitude = init(this.config.apiKey);
    } catch (error) {
      console.error(
        'Amplitude adapter failed to initialize. Install @amplitude/analytics-node: pnpm add @amplitude/analytics-node',
        error,
      );
      this.enabled = false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  async trackEvent(name: string, attributes?: EventAttributes): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.amplitude?.track({
      event_type: name,
      user_id: attributes?.userId || attributes?.user_id || 'anonymous',
      event_properties: attributes,
    });
  }

  async trackFunnelStep(
    funnelName: string,
    step: FunnelStatus,
    attributes?: EventAttributes,
  ): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.amplitude?.track({
      event_type: `${funnelName}.${step}`,
      user_id: attributes?.userId || attributes?.user_id || 'anonymous',
      event_properties: {
        funnel: funnelName,
        step,
        ...attributes,
      },
    });
  }

  async trackOutcome(
    operationName: string,
    outcome: OutcomeStatus,
    attributes?: EventAttributes,
  ): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.amplitude?.track({
      event_type: `${operationName}.${outcome}`,
      user_id: attributes?.userId || attributes?.user_id || 'anonymous',
      event_properties: {
        operation: operationName,
        outcome,
        ...attributes,
      },
    });
  }

  async trackValue(name: string, value: number, attributes?: EventAttributes): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.amplitude?.track({
      event_type: name,
      user_id: attributes?.userId || attributes?.user_id || 'anonymous',
      event_properties: {
        value,
        ...attributes,
      },
    });
  }

  /** Flush pending events before shutdown */
  async shutdown(): Promise<void> {
    await this.ensureInitialized();
    if (this.amplitude) {
      await this.amplitude.flush();
    }
  }
}

