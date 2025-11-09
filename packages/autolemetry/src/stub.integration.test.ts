/**
 * Integration tests for autolemetry
 *
 * Tests end-to-end flows with all components working together
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init } from './init';
import { trace } from './functional';
import { track, resetAnalyticsQueue } from './track';
import { Analytics, resetAnalytics } from './analytics';
import { flush, shutdown } from './shutdown';
import { resetMetrics } from './metrics';
import { resetConfig } from './config';
import type { AnalyticsAdapter, EventAttributes } from './analytics-adapter';

// Test adapter that collects events
class TestAdapter implements AnalyticsAdapter {
  name = 'test-adapter';
  events: Array<{ type: string; name: string; attributes?: EventAttributes }> =
    [];

  async trackEvent(name: string, attributes?: EventAttributes): Promise<void> {
    this.events.push({ type: 'event', name, attributes });
  }

  async trackFunnelStep(
    funnel: string,
    status: string,
    attributes?: EventAttributes,
  ): Promise<void> {
    this.events.push({
      type: 'funnel',
      name: `${funnel}.${status}`,
      attributes,
    });
  }

  async trackOutcome(
    operation: string,
    status: string,
    attributes?: EventAttributes,
  ): Promise<void> {
    this.events.push({
      type: 'outcome',
      name: `${operation}.${status}`,
      attributes,
    });
  }

  async trackValue(
    metric: string,
    value: number,
    attributes?: EventAttributes,
  ): Promise<void> {
    this.events.push({
      type: 'value',
      name: metric,
      attributes: { ...attributes, value },
    });
  }

  async shutdown(): Promise<void> {
    // Cleanup if needed
  }

  reset(): void {
    this.events = [];
  }
}

describe('Integration Test Suite', () => {
  let testAdapter: TestAdapter;

  beforeEach(() => {
    // Reset all global state between tests
    resetAnalyticsQueue();
    resetAnalytics();
    resetMetrics();
    resetConfig();
    testAdapter = new TestAdapter();
  });

  afterEach(async () => {
    // Clean up after each test
    await shutdown();
  });

  describe('Full stack initialization', () => {
    it('should initialize all components together', () => {
      init({
        service: 'test-app',
        adapters: [testAdapter],
        version: '1.0.0',
        environment: 'test',
      });

      expect(true).toBe(true); // Should not throw
    });
  });

  describe('Tracing + Analytics integration', () => {
    it('should correlate traces with analytics events', async () => {
      init({
        service: 'user-service',
        adapters: [testAdapter],
      });

      // Create trace function
      const createUser = trace(async (userId: string, plan: string) => {
        // Track analytics event inside trace function
        track('user.signup', { userId, plan });
        return { id: userId, plan };
      });

      // Execute
      const result = await createUser('user123', 'pro');

      // Should return expected result
      expect(result).toEqual({ id: 'user123', plan: 'pro' });

      // Flush to send events
      await flush();

      // Analytics event should be tracked
      // (traceId correlation happens automatically)
      const events = testAdapter.events.filter((e) => e.name === 'user.signup');
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle nested trace functions', async () => {
      init({
        service: 'order-service',
        adapters: [testAdapter],
      });

      const validateOrder = trace(async (orderId: string) => {
        track('order.validated', { orderId });
        return true;
      });

      const processPayment = trace(async (orderId: string, amount: number) => {
        track('payment.processed', { orderId, amount });
        return { success: true };
      });

      const createOrder = trace(async (orderId: string, amount: number) => {
        await validateOrder(orderId);
        await processPayment(orderId, amount);
        track('order.completed', { orderId, amount });
        return { orderId, status: 'completed' };
      });

      await createOrder('order123', 99.99);
      await flush();

      // All events should be tracked
      expect(testAdapter.events.length).toBeGreaterThanOrEqual(3);
      expect(testAdapter.events.map((e) => e.name)).toContain(
        'order.validated',
      );
      expect(testAdapter.events.map((e) => e.name)).toContain(
        'payment.processed',
      );
      expect(testAdapter.events.map((e) => e.name)).toContain(
        'order.completed',
      );
    });
  });

  describe('Analytics class integration', () => {
    it('should track all analytics event types', async () => {
      const analytics = new Analytics('checkout', {
        adapters: [testAdapter],
      });

      // Track different event types
      analytics.trackEvent('checkout.started', { cartValue: 149.99 });
      analytics.trackFunnelStep('checkout', 'started', { userId: '123' });
      analytics.trackFunnelStep('checkout', 'started', {
        userId: '123',
        step: 'payment_info',
      });
      analytics.trackFunnelStep('checkout', 'completed', { userId: '123' });
      analytics.trackOutcome('payment.process', 'success', { amount: 149.99 });
      analytics.trackValue('revenue', 149.99, { currency: 'USD' });

      // Flush adapters
      await analytics.flush();

      // All events should be captured
      expect(testAdapter.events.length).toBe(6);
      expect(testAdapter.events.map((e) => e.type)).toEqual([
        'event',
        'funnel',
        'funnel',
        'funnel',
        'outcome',
        'value',
      ]);
    });
  });

  describe('Error handling integration', () => {
    it('should handle adapter failures gracefully', async () => {
      const failingAdapter: AnalyticsAdapter = {
        name: 'failing-adapter',
        trackEvent: async () => {
          throw new Error('Adapter error');
        },
        trackFunnelStep: async () => {},
        trackOutcome: async () => {},
        trackValue: async () => {},
      };

      const analytics = new Analytics('test', {
        adapters: [failingAdapter, testAdapter], // Mix failing and working
      });

      // Should not throw even though one adapter fails
      analytics.trackEvent('test.event', { foo: 'bar' });

      await analytics.flush();

      // Working adapter should still receive events
      expect(testAdapter.events.length).toBeGreaterThan(0);
    });

    it('should handle circuit breaker opening', async () => {
      let callCount = 0;

      const unreliableAdapter: AnalyticsAdapter = {
        name: 'unreliable-adapter',
        trackEvent: async () => {
          callCount++;
          // Fail first 5 times to trip circuit breaker
          if (callCount <= 5) {
            throw new Error('Service unavailable');
          }
        },
        trackFunnelStep: async () => {},
        trackOutcome: async () => {},
        trackValue: async () => {},
      };

      const analytics = new Analytics('test', {
        adapters: [unreliableAdapter],
      });

      // Send events one at a time to allow circuit breaker to open
      for (let i = 0; i < 10; i++) {
        analytics.trackEvent(`event.${i}`, { index: i });
        // Wait a bit to allow circuit breaker to process
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      await analytics.flush();

      // Circuit should open after 5 failures
      // Remaining calls should be fast-failed
      expect(callCount).toBeLessThanOrEqual(6); // 5 failures + maybe 1 half-open test
    });
  });

  describe('Input validation integration', () => {
    it('should sanitize sensitive data across all components', async () => {
      init({
        service: 'auth-service',
        adapters: [testAdapter],
      });

      // Track with sensitive data
      track('user.login', {
        email: 'user@example.com',
        password: 'secret123', // Should be redacted
        apiKey: 'abc123', // Should be redacted
        userId: '123', // Should NOT be redacted
      });

      await flush();

      const event = testAdapter.events.find((e) => e.name === 'user.login');
      expect(event?.attributes?.email).toBe('user@example.com');
      expect(event?.attributes?.password).toBe('[REDACTED]');
      expect(event?.attributes?.apiKey).toBe('[REDACTED]');
      expect(event?.attributes?.userId).toBe('123');
    });

    it('should validate event names', () => {
      const analytics = new Analytics('test', {
        adapters: [testAdapter],
      });

      // Invalid event names should throw
      expect(() => {
        analytics.trackEvent('', { foo: 'bar' });
      }).toThrow();

      expect(() => {
        analytics.trackEvent('invalid event name', { foo: 'bar' });
      }).toThrow();
    });
  });

  describe('Graceful shutdown integration', () => {
    it('should shutdown all components cleanly', async () => {
      init({
        service: 'test-service',
        adapters: [testAdapter],
      });

      track('test.event', { foo: 'bar' });

      await shutdown();

      // Events should be flushed
      expect(testAdapter.events.length).toBeGreaterThan(0);
    });
  });

  describe('Performance under load', () => {
    it('should handle high event volume', async () => {
      init({
        service: 'high-volume-service',
        adapters: [testAdapter],
      });

      // Send 1000 events
      for (let i = 0; i < 1000; i++) {
        track(`event.${i}`, { index: i });
      }

      await flush();

      // All events should be captured
      expect(testAdapter.events.length).toBeGreaterThanOrEqual(1000);
    });

    it('should batch events efficiently', async () => {
      init({
        service: 'batch-test',
        adapters: [testAdapter],
      });

      const startTime = Date.now();

      // Track 500 events
      for (let i = 0; i < 500; i++) {
        track(`event.${i}`, { index: i });
      }

      await flush();

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (batching improves performance)
      // This is a sanity check - actual threshold depends on hardware
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});
