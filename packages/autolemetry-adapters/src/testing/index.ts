/**
 * Testing utilities for adapter authors.
 *
 * Use these to validate your custom adapters work correctly.
 *
 * @example Test your adapter
 * ```typescript
 * import { AdapterTestHarness } from 'autolemetry-adapters/testing';
 *
 * const harness = new AdapterTestHarness(new MyAdapter());
 * const results = await harness.runAll();
 * AdapterTestHarness.printResults(results);
 * ```
 *
 * @example Test webhook adapter
 * ```typescript
 * import { MockWebhookServer } from 'autolemetry-adapters/testing';
 *
 * const server = new MockWebhookServer();
 * const url = await server.start();
 * const adapter = new WebhookAdapter({ url });
 *
 * await adapter.trackEvent('test', {});
 * expect(server.getRequestCount()).toBe(1);
 *
 * await server.stop();
 * ```
 */

export { AdapterTestHarness } from './adapter-test-harness';
export type { TestResult, TestSuiteResult } from './adapter-test-harness';

export { MockWebhookServer } from './mock-webhook-server';
export type { RecordedRequest, MockServerOptions } from './mock-webhook-server';

// Re-export MockAnalyticsAdapter for convenience
export { MockAnalyticsAdapter } from '../mock-analytics-adapter';
