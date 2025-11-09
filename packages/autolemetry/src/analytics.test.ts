import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Analytics, getAnalytics, resetAnalytics } from './analytics';
import { type ILogger } from './logger';
import { init } from './init';
import { shutdown } from './shutdown';
import { trace } from './functional';

describe('Analytics', () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    resetAnalytics();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe('trackEvent', () => {
    it('should track business events', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackEvent('application.submitted', {
        jobId: '123',
        userId: '456',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Analytics event tracked', {
        event: 'application.submitted',
        attributes: { service: 'test-service', jobId: '123', userId: '456' },
      });
    });

    it('should track events without attributes', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackEvent('user.login');

      expect(mockLogger.info).toHaveBeenCalledWith('Analytics event tracked', {
        event: 'user.login',
        attributes: { service: 'test-service' },
      });
    });
  });

  describe('trackFunnelStep', () => {
    it('should track funnel progression', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackFunnelStep('checkout', 'started', { cartValue: 99.99 });
      analytics.trackFunnelStep('checkout', 'completed', { cartValue: 99.99 });

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith('Funnel step tracked', {
        funnel: 'checkout',
        status: 'started',
        attributes: { service: 'test-service', cartValue: 99.99 },
      });
    });

    it('should track funnel abandonment', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackFunnelStep('checkout', 'abandoned', { reason: 'timeout' });

      expect(mockLogger.info).toHaveBeenCalledWith('Funnel step tracked', {
        funnel: 'checkout',
        status: 'abandoned',
        attributes: { service: 'test-service', reason: 'timeout' },
      });
    });
  });

  describe('trackOutcome', () => {
    it('should track successful outcomes', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackOutcome('email.delivery', 'success', {
        recipientType: 'school',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Outcome tracked', {
        operation: 'email.delivery',
        status: 'success',
        attributes: { service: 'test-service', recipientType: 'school' },
      });
    });

    it('should track failed outcomes', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackOutcome('email.delivery', 'failure', {
        error: 'invalid_email',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Outcome tracked', {
        operation: 'email.delivery',
        status: 'failure',
        attributes: { service: 'test-service', error: 'invalid_email' },
      });
    });

    it('should track partial outcomes', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackOutcome('batch.process', 'partial', {
        successCount: 8,
        failureCount: 2,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Outcome tracked', {
        operation: 'batch.process',
        status: 'partial',
        attributes: {
          service: 'test-service',
          successCount: 8,
          failureCount: 2,
        },
      });
    });
  });

  describe('trackValue', () => {
    it('should track revenue metrics', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackValue('order.revenue', 149.99, {
        currency: 'USD',
        productCategory: 'electronics',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Value tracked', {
        metric: 'order.revenue',
        value: 149.99,
        attributes: {
          service: 'test-service',
          metric: 'order.revenue',
          currency: 'USD',
          productCategory: 'electronics',
        },
      });
    });

    it('should track processing time', () => {
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackValue('application.processing_time', 2500, {
        unit: 'ms',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Value tracked', {
        metric: 'application.processing_time',
        value: 2500,
        attributes: {
          service: 'test-service',
          metric: 'application.processing_time',
          unit: 'ms',
        },
      });
    });
  });

  describe('getAnalytics', () => {
    it('should return singleton instance', () => {
      const analytics1 = getAnalytics('test-service');
      const analytics2 = getAnalytics('test-service');

      expect(analytics1).toBe(analytics2);
    });

    it('should return different instances for different services', () => {
      const analytics1 = getAnalytics('service-1');
      const analytics2 = getAnalytics('service-2');

      expect(analytics1).not.toBe(analytics2);
    });

    it('should reset instances', () => {
      const analytics1 = getAnalytics('test-service');
      resetAnalytics();
      const analytics2 = getAnalytics('test-service');

      expect(analytics1).not.toBe(analytics2);
    });
  });

  describe('real-world usage example', () => {
    it('should track job application flow', () => {
      const analytics = new Analytics('job-application', {
        logger: mockLogger,
      });

      // User starts application
      analytics.trackFunnelStep('application', 'started', { jobId: '123' });

      // User submits application
      analytics.trackEvent('application.submitted', {
        jobId: '123',
        userId: '456',
      });
      analytics.trackFunnelStep('application', 'completed', { jobId: '123' });

      // Email sent successfully
      analytics.trackOutcome('email.sent', 'success', {
        recipientType: 'school',
        jobId: '123',
      });

      expect(mockLogger.info).toHaveBeenCalledTimes(4);
    });

    it('should track email delivery failures', () => {
      const analytics = new Analytics('email-service', { logger: mockLogger });

      // Failed email delivery
      analytics.trackOutcome('email.delivery', 'failure', {
        error: 'invalid_email',
        recipientEmail: 'redacted',
      });

      // Track event for alerting
      analytics.trackEvent('email.bounce', {
        bounceType: 'permanent',
      });

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('automatic telemetry context enrichment', () => {
    beforeEach(() => {
      resetAnalytics();
    });

    afterEach(async () => {
      await shutdown();
    });

    // Test without config first (before any init() is called)
    it('should still work without config (graceful degradation)', () => {
      // Don't initialize - no config available
      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackEvent('user.login');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: {
            service: 'test-service',
            // No version/environment - gracefully omitted
          },
        }),
      );
    });

    it('should auto-capture resource attributes (service.version, deployment.environment)', () => {
      // Initialize with config
      init({
        service: 'test-service',
        version: '2.1.0',
        environment: 'production',
      });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      analytics.trackEvent('user.signup', { userId: '123' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            service: 'test-service',
            'service.version': '2.1.0',
            'deployment.environment': 'production',
            userId: '123',
          }),
        }),
      );
    });

    it('should auto-capture trace context (traceId, spanId, correlationId) when inside a trace', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const tracedOperation = trace('test.operation', async () => {
        analytics.trackEvent('operation.started', { step: 1 });
      });

      await tracedOperation();

      const capturedCall = (mockLogger.info as ReturnType<typeof vi.fn>).mock
        .calls[0];
      const attributes = capturedCall[1].attributes;

      expect(attributes).toHaveProperty('traceId');
      expect(attributes).toHaveProperty('spanId');
      expect(attributes).toHaveProperty('correlationId');
      expect(typeof attributes.traceId).toBe('string');
      expect(typeof attributes.spanId).toBe('string');
      expect(typeof attributes.correlationId).toBe('string');
      // Correlation ID should be first 16 chars of traceId
      expect(attributes.correlationId).toBe(attributes.traceId.slice(0, 16));
    });

    it('should enrich trackFunnelStep with telemetry context', async () => {
      init({
        service: 'test-service',
        version: '1.5.0',
        environment: 'staging',
      });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const tracedOperation = trace('checkout.flow', async () => {
        analytics.trackFunnelStep('checkout', 'started', { cartValue: 99.99 });
      });

      await tracedOperation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Funnel step tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            service: 'test-service',
            'service.version': '1.5.0',
            'deployment.environment': 'staging',
            cartValue: 99.99,
            traceId: expect.any(String),
            spanId: expect.any(String),
            correlationId: expect.any(String),
          }),
        }),
      );
    });

    it('should enrich trackOutcome with telemetry context', async () => {
      init({
        service: 'test-service',
        version: '3.0.0',
        environment: 'development',
      });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const tracedOperation = trace('email.send', async () => {
        analytics.trackOutcome('email.delivery', 'success', {
          recipientType: 'user',
        });
      });

      await tracedOperation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Outcome tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            service: 'test-service',
            'service.version': '3.0.0',
            'deployment.environment': 'development',
            recipientType: 'user',
            traceId: expect.any(String),
            spanId: expect.any(String),
            correlationId: expect.any(String),
          }),
        }),
      );
    });

    it('should enrich trackValue with telemetry context', async () => {
      init({
        service: 'test-service',
        version: '4.2.1',
        environment: 'production',
      });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const tracedOperation = trace('order.process', async () => {
        analytics.trackValue('order.revenue', 149.99, { currency: 'USD' });
      });

      await tracedOperation();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Value tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            service: 'test-service',
            metric: 'order.revenue',
            'service.version': '4.2.1',
            'deployment.environment': 'production',
            currency: 'USD',
            traceId: expect.any(String),
            spanId: expect.any(String),
            correlationId: expect.any(String),
          }),
        }),
      );
    });

    it('should still work outside a trace (no trace context)', () => {
      init({
        service: 'test-service',
        version: '1.0.0',
        environment: 'test',
      });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      // Call outside a trace
      analytics.trackEvent('background.job.completed', { jobId: 'job-123' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: {
            service: 'test-service',
            'service.version': '1.0.0',
            'deployment.environment': 'test',
            jobId: 'job-123',
            // No traceId/spanId/correlationId - gracefully omitted
          },
        }),
      );
    });
  });

  describe('automatic operation context enrichment', () => {
    beforeEach(() => {
      resetAnalytics();
    });

    afterEach(async () => {
      await shutdown();
    });

    it('should auto-capture operation.name when inside trace() with string name', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const operation = trace('user.create', async () => {
        analytics.trackEvent('user.created', { userId: '123' });
      });

      await operation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'user.create',
            userId: '123',
          }),
        }),
      );
    });

    it('should auto-capture operation.name when inside trace() with named function', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const createUser = trace(async function createUser() {
        analytics.trackEvent('user.created', { userId: '456' });
      });

      await createUser();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            // Function name might be inferred with slight variations (e.g., 'createUser2')
            // The important thing is that operation.name is auto-captured
            'operation.name': expect.stringMatching(/createUser/),
            userId: '456',
          }),
        }),
      );
    });

    it('should auto-capture operation.name in nested spans', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });
      const { span } = await import('./functional');

      const operation = trace('order.process', async () => {
        await span({ name: 'order.validate' }, async () => {
          // Should capture the innermost operation name
          analytics.trackEvent('order.validated', { orderId: 'ord_123' });
        });
      });

      await operation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'order.validate',
            orderId: 'ord_123',
          }),
        }),
      );
    });

    it('should auto-capture operation.name in trackFunnelStep', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const checkout = trace('checkout.flow', async () => {
        analytics.trackFunnelStep('checkout', 'started', {
          cartValue: 99.99,
        });
      });

      await checkout();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Funnel step tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'checkout.flow',
            cartValue: 99.99,
          }),
        }),
      );
    });

    it('should auto-capture operation.name in trackOutcome', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const sendEmail = trace('email.send', async () => {
        analytics.trackOutcome('email.delivery', 'success', {
          recipientType: 'user',
        });
      });

      await sendEmail();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Outcome tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'email.send',
            recipientType: 'user',
          }),
        }),
      );
    });

    it('should auto-capture operation.name in trackValue', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const processOrder = trace('order.process', async () => {
        analytics.trackValue('order.revenue', 149.99, { currency: 'USD' });
      });

      await processOrder();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Value tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'order.process',
            currency: 'USD',
          }),
        }),
      );
    });

    it('should handle missing operation.name gracefully (outside trace)', () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      // Call outside any trace
      analytics.trackEvent('background.job', { jobId: 'job-123' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: {
            service: 'test-service',
            'service.version': undefined,
            'deployment.environment': undefined,
            jobId: 'job-123',
            // No operation.name - gracefully omitted
          },
        }),
      );
    });

    it('should capture parent operation.name when not in nested span', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const parentOperation = trace('parent.operation', async () => {
        // Track event in parent context (not in a nested span)
        analytics.trackEvent('parent.event', { step: 1 });

        // Then create a nested span
        const { span } = await import('./functional');
        await span({ name: 'child.operation' }, async () => {
          analytics.trackEvent('child.event', { step: 2 });
        });
      });

      await parentOperation();

      // Check parent event has parent operation name
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'parent.operation',
            step: 1,
          }),
        }),
      );

      // Check child event has child operation name
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'child.operation',
            step: 2,
          }),
        }),
      );
    });

    it('should work with trace() factory pattern', async () => {
      init({ service: 'test-service' });

      const analytics = new Analytics('test-service', { logger: mockLogger });

      const operation = trace('factory.operation', (ctx) => async () => {
        ctx.setAttribute('custom', 'attribute');
        analytics.trackEvent('factory.event', { data: 'test' });
      });

      await operation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'factory.operation',
            data: 'test',
          }),
        }),
      );
    });
  });
});
