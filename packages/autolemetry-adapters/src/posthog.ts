/**
 * PostHog Adapter for autolemetry
 *
 * Send analytics to PostHog for product analytics.
 *
 * @example
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { PostHogAdapter } from 'autolemetry-adapters/posthog';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new PostHogAdapter({
 *       apiKey: process.env.POSTHOG_API_KEY!,
 *       host: 'https://us.i.posthog.com' // optional, defaults to US cloud
 *     })
 *   ]
 * });
 *
 * // Analytics go to both OpenTelemetry AND PostHog
 * analytics.trackEvent('order.completed', { userId: '123', amount: 99.99 });
 * ```
 */

import type {
  AnalyticsAdapter,
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from 'autolemetry/analytics-adapter';

export interface PostHogConfig {
  /** PostHog API key (starts with phc_) */
  apiKey: string;
  /** PostHog host (defaults to US cloud) */
  host?: string;
  /** Enable/disable the adapter */
  enabled?: boolean;
}

export class PostHogAdapter implements AnalyticsAdapter {
  readonly name = 'PostHogAdapter';
  readonly version = '1.0.0';

  private posthog: any;
  private enabled: boolean;
  private config: PostHogConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: PostHogConfig) {
    this.enabled = config.enabled ?? true;
    this.config = config;

    if (this.enabled) {
      // Start initialization immediately but don't block constructor
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid adding posthog-node as a hard dependency
      const { PostHog } = await import('posthog-node');
      this.posthog = new PostHog(this.config.apiKey, {
        host: this.config.host || 'https://us.i.posthog.com',
      });
    } catch (error) {
      console.error(
        'PostHog adapter failed to initialize. Install posthog-node: pnpm add posthog-node',
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
    this.posthog?.capture({
      distinctId: attributes?.userId || attributes?.user_id || 'anonymous',
      event: name,
      properties: attributes,
    });
  }

  async trackFunnelStep(
    funnelName: string,
    step: FunnelStatus,
    attributes?: EventAttributes,
  ): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.posthog?.capture({
      distinctId: attributes?.userId || attributes?.user_id || 'anonymous',
      event: `${funnelName}.${step}`,
      properties: {
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
    this.posthog?.capture({
      distinctId: attributes?.userId || attributes?.user_id || 'anonymous',
      event: `${operationName}.${outcome}`,
      properties: {
        operation: operationName,
        outcome,
        ...attributes,
      },
    });
  }

  async trackValue(name: string, value: number, attributes?: EventAttributes): Promise<void> {
    if (!this.enabled) return;

    await this.ensureInitialized();
    this.posthog?.capture({
      distinctId: attributes?.userId || attributes?.user_id || 'anonymous',
      event: name,
      properties: {
        value,
        ...attributes,
      },
    });
  }

  /** Flush pending events before shutdown */
  async shutdown(): Promise<void> {
    await this.ensureInitialized();
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }
}

