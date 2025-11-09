/**
 * Factory functions for creating analytics adapters
 *
 * Function-based alternatives to `new AdapterClass()` pattern.
 * Provides a consistent API and better tree-shaking.
 *
 * @example
 * ```typescript
 * import { createPostHogAdapter, createWebhookAdapter } from 'autolemetry-adapters/factories'
 *
 * const analytics = new Analytics('my-service', {
 *   adapters: [
 *     createPostHogAdapter({ apiKey: 'phc_...' }),
 *     createWebhookAdapter({ url: 'https://...' })
 *   ]
 * })
 * ```
 */

import { PostHogAdapter } from './posthog';
import { MixpanelAdapter } from './mixpanel';
import { AmplitudeAdapter } from './amplitude';
import { SegmentAdapter } from './segment';
import { WebhookAdapter } from './webhook';
import { SlackAdapter } from './slack';
import { MockAnalyticsAdapter } from './mock-analytics-adapter';

import type { AnalyticsAdapter, EventAttributes, OutcomeStatus, FunnelStatus } from 'autolemetry/analytics-adapter';

// Re-export config types
export type { PostHogConfig } from './posthog';
export type { MixpanelConfig } from './mixpanel';
export type { AmplitudeConfig } from './amplitude';
export type { SegmentConfig } from './segment';
export type { WebhookConfig } from './webhook';
export type { SlackAdapterConfig } from './slack';

/**
 * Create a PostHog analytics adapter
 *
 * @example
 * ```typescript
 * const posthog = createPostHogAdapter({
 *   apiKey: 'phc_...',
 *   host: 'https://app.posthog.com' // optional
 * })
 * ```
 */
export function createPostHogAdapter(config: {
  apiKey: string;
  host?: string;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new PostHogAdapter(config);
}

/**
 * Create a Mixpanel analytics adapter
 *
 * @example
 * ```typescript
 * const mixpanel = createMixpanelAdapter({
 *   token: 'YOUR_TOKEN'
 * })
 * ```
 */
export function createMixpanelAdapter(config: {
  token: string;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new MixpanelAdapter(config);
}

/**
 * Create an Amplitude analytics adapter
 *
 * @example
 * ```typescript
 * const amplitude = createAmplitudeAdapter({
 *   apiKey: 'YOUR_API_KEY'
 * })
 * ```
 */
export function createAmplitudeAdapter(config: {
  apiKey: string;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new AmplitudeAdapter(config);
}

/**
 * Create a Segment analytics adapter
 *
 * @example
 * ```typescript
 * const segment = createSegmentAdapter({
 *   writeKey: 'YOUR_WRITE_KEY'
 * })
 * ```
 */
export function createSegmentAdapter(config: {
  writeKey: string;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new SegmentAdapter(config);
}

/**
 * Create a Webhook analytics adapter
 *
 * @example
 * ```typescript
 * const webhook = createWebhookAdapter({
 *   url: 'https://your-webhook-endpoint.com/events',
 *   headers: { 'Authorization': 'Bearer token' }
 * })
 * ```
 */
export function createWebhookAdapter(config: {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new WebhookAdapter(config);
}

/**
 * Create a Slack analytics adapter
 *
 * @example
 * ```typescript
 * const slack = createSlackAdapter({
 *   webhookUrl: 'https://hooks.slack.com/services/...',
 *   channel: '#analytics'
 * })
 * ```
 */
export function createSlackAdapter(config: {
  webhookUrl: string;
  channel?: string;
  enabled?: boolean;
}): AnalyticsAdapter {
  return new SlackAdapter(config);
}


/**
 * Create a mock analytics adapter (for testing)
 *
 * @example
 * ```typescript
 * const mock = createMockAdapter()
 *
 * // Capture events
 * analytics.trackEvent('test.event', { foo: 'bar' })
 *
 * // Assert
 * expect(mock.events).toHaveLength(1)
 * expect(mock.events[0].name).toBe('test.event')
 * ```
 */
export function createMockAdapter(): MockAnalyticsAdapter {
  return new MockAnalyticsAdapter();
}

/**
 * Compose multiple adapters into one
 *
 * @example
 * ```typescript
 * const multiAdapter = composeAdapters([
 *   createPostHogAdapter({ apiKey: '...' }),
 *   createWebhookAdapter({ url: '...' })
 * ])
 * ```
 */
export function composeAdapters(adapters: AnalyticsAdapter[]): AnalyticsAdapter {
  return {
    name: 'ComposedAdapter',
    async trackEvent(name: string, attributes: EventAttributes) {
      await Promise.all(adapters.map(a => a.trackEvent(name, attributes)));
    },
    async trackFunnelStep(funnel: string, step: FunnelStatus, attributes: EventAttributes) {
      await Promise.all(adapters.map(a => a.trackFunnelStep(funnel, step, attributes)));
    },
    async trackOutcome(operation: string, outcome: OutcomeStatus, attributes: EventAttributes) {
      await Promise.all(adapters.map(a => a.trackOutcome(operation, outcome, attributes)));
    },
    async trackValue(name: string, value: number, attributes: EventAttributes) {
      await Promise.all(adapters.map(a => a.trackValue(name, value, attributes)));
    },
    async shutdown() {
      await Promise.all(adapters.map(a => a.shutdown?.()));
    },
  };
}
