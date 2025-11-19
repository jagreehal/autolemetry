/**
 * autolemetry-adapters
 *
 * Send analytics to multiple platforms:
 * - PostHog (product analytics)
 * - Mixpanel (product analytics)
 * - Amplitude (product analytics)
 * - Segment (customer data platform)
 * - Slack (team notifications)
 * - Webhook (custom integrations, Zapier, Make.com)
 *
 * @example Multi-platform tracking
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { PostHogAdapter, MixpanelAdapter } from 'autolemetry-adapters';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new PostHogAdapter({ apiKey: 'phc_...' }),
 *     new MixpanelAdapter({ token: '...' })
 *   ]
 * });
 *
 * // Sent to: OpenTelemetry + PostHog + Mixpanel
 * analytics.trackEvent('order.completed', { userId: '123', amount: 99.99 });
 * ```
 *
 */

// ============================================================================
// Destination Adapters (where events go)
// ============================================================================

export { PostHogAdapter, type PostHogConfig } from './posthog';
export { MixpanelAdapter, type MixpanelConfig } from './mixpanel';
export { SegmentAdapter, type SegmentConfig } from './segment';
export { AmplitudeAdapter, type AmplitudeConfig } from './amplitude';
export { SlackAdapter, type SlackAdapterConfig } from './slack';
export { WebhookAdapter, type WebhookConfig } from './webhook';

// ============================================================================
// Base Classes for Building Custom Adapters
// ============================================================================

// Standard base class - extend this for custom adapters
export { AnalyticsAdapter, type AdapterPayload } from './analytics-adapter-base';

// Specialized base class for streaming platforms (Kafka, Kinesis, Pub/Sub)
export { StreamingAnalyticsAdapter } from './streaming-analytics-adapter';

