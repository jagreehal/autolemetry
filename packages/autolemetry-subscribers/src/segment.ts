/**
 * Segment Adapter for autolemetry
 *
 * Send analytics to Segment (customer data platform).
 *
 * @example
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { SegmentAdapter } from 'autolemetry-adapters/segment';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new SegmentAdapter({
 *       writeKey: process.env.SEGMENT_WRITE_KEY!
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

export interface SegmentConfig {
  /** Segment write key */
  writeKey: string;
  /** Enable/disable the adapter */
  enabled?: boolean;
}

export class SegmentAdapter implements AnalyticsAdapter {
  readonly name = 'SegmentAdapter';
  readonly version = '1.0.0';

  private analytics: any;
  private enabled: boolean;
  private config: SegmentConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: SegmentConfig) {
    this.enabled = config.enabled ?? true;
    this.config = config;

    if (this.enabled) {
      // Start initialization immediately but don't block constructor
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamic import to avoid adding @segment/analytics-node as a hard dependency
      const { Analytics } = await import('@segment/analytics-node');
      this.analytics = new Analytics({ writeKey: this.config.writeKey });
    } catch (error) {
      console.error(
        'Segment adapter failed to initialize. Install @segment/analytics-node: pnpm add @segment/analytics-node',
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
    this.analytics?.track({
      userId: attributes?.userId || attributes?.user_id || 'anonymous',
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
    this.analytics?.track({
      userId: attributes?.userId || attributes?.user_id || 'anonymous',
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
    this.analytics?.track({
      userId: attributes?.userId || attributes?.user_id || 'anonymous',
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
    this.analytics?.track({
      userId: attributes?.userId || attributes?.user_id || 'anonymous',
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
    if (this.analytics) {
      await this.analytics.closeAndFlush();
    }
  }
}

