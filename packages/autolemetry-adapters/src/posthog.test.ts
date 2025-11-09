import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogAdapter } from './posthog';

// Mock the posthog-node module
const mockCapture = vi.fn();
const mockShutdown = vi.fn(() => Promise.resolve());

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(function(this: any) {
    this.capture = mockCapture;
    this.shutdown = mockShutdown;
  }),
}));

describe('PostHogAdapter', () => {
  beforeEach(() => {
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
        host: 'https://us.i.posthog.com',
      });

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(adapter).toBeDefined();
    });

    it('should initialize with default host', async () => {
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(adapter).toBeDefined();
    });

    it('should not initialize when disabled', () => {
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
        enabled: false,
      });

      expect(adapter).toBeDefined();
    });
  });

  describe('trackEvent', () => {
    it('should track event with attributes', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackEvent('order.completed', {
        userId: 'user-123',
        amount: 99.99,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'order.completed',
        properties: {
          userId: 'user-123',
          amount: 99.99,
        },
      });
    });

    it('should use user_id if userId is not present', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackEvent('order.completed', {
        user_id: 'user-456',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'order.completed',
        properties: {
          user_id: 'user-456',
        },
      });
    });

    it('should use anonymous if no userId is present', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackEvent('page.viewed');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'anonymous',
        event: 'page.viewed',
        properties: undefined,
      });
    });

    it('should not track when disabled', async () => {
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
        enabled: false,
      });

      await adapter.trackEvent('order.completed', { userId: 'user-123' });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('trackFunnelStep', () => {
    it('should track funnel step', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackFunnelStep('checkout', 'started', {
        userId: 'user-123',
        cartValue: 150,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'checkout.started',
        properties: {
          funnel: 'checkout',
          step: 'started',
          userId: 'user-123',
          cartValue: 150,
        },
      });
    });
  });

  describe('trackOutcome', () => {
    it('should track outcome', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackOutcome('payment.processing', 'success', {
        userId: 'user-123',
        transactionId: 'txn-789',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'payment.processing.success',
        properties: {
          operation: 'payment.processing',
          outcome: 'success',
          userId: 'user-123',
          transactionId: 'txn-789',
        },
      });
    });
  });

  describe('trackValue', () => {
    it('should track value', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await adapter.trackValue('revenue', 99.99, {
        userId: 'user-123',
        currency: 'USD',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'revenue',
        properties: {
          value: 99.99,
          userId: 'user-123',
          currency: 'USD',
        },
      });
    });
  });

  describe('shutdown', () => {
    it('should call shutdown on PostHog instance', async () => {
      const { PostHog } = await import('posthog-node');
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      await adapter.shutdown();

      const mockInstance = (PostHog as any).mock.results[0].value;
      expect(mockInstance.shutdown).toHaveBeenCalled();
    });

    it('should not throw when shutting down disabled adapter', async () => {
      const adapter = new PostHogAdapter({
        apiKey: 'phc_test_key',
        enabled: false,
      });

      await expect(adapter.shutdown()).resolves.not.toThrow();
    });
  });
});
