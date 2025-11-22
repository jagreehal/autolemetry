/**
 * Tests for isolated tracer provider support
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setAutolemetryTracerProvider,
  getAutolemetryTracerProvider,
  getAutolemetryTracer,
} from './tracer-provider';
import { trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

describe('Isolated Tracer Provider', () => {
  let customProvider: NodeTracerProvider;

  beforeEach(() => {
    // Create a custom provider for testing
    customProvider = new NodeTracerProvider();
  });

  afterEach(() => {
    // Clean up: reset to null after each test
    setAutolemetryTracerProvider(null);
  });

  describe('setAutolemetryTracerProvider', () => {
    it('should set isolated provider', () => {
      setAutolemetryTracerProvider(customProvider);

      const provider = getAutolemetryTracerProvider();
      expect(provider).toBe(customProvider);
    });

    it('should clear isolated provider when set to null', () => {
      setAutolemetryTracerProvider(customProvider);
      setAutolemetryTracerProvider(null);

      const provider = getAutolemetryTracerProvider();
      // Should fall back to global provider
      expect(provider).toBe(trace.getTracerProvider());
    });

    it('should allow overwriting existing isolated provider', () => {
      const provider1 = new NodeTracerProvider();
      const provider2 = new NodeTracerProvider();

      setAutolemetryTracerProvider(provider1);
      expect(getAutolemetryTracerProvider()).toBe(provider1);

      setAutolemetryTracerProvider(provider2);
      expect(getAutolemetryTracerProvider()).toBe(provider2);
    });
  });

  describe('getAutolemetryTracerProvider', () => {
    it('should return isolated provider when set', () => {
      setAutolemetryTracerProvider(customProvider);

      const provider = getAutolemetryTracerProvider();
      expect(provider).toBe(customProvider);
    });

    it('should return global provider when no isolated provider is set', () => {
      const provider = getAutolemetryTracerProvider();
      expect(provider).toBe(trace.getTracerProvider());
    });

    it('should be idempotent', () => {
      setAutolemetryTracerProvider(customProvider);

      const provider1 = getAutolemetryTracerProvider();
      const provider2 = getAutolemetryTracerProvider();

      expect(provider1).toBe(provider2);
    });
  });

  describe('getAutolemetryTracer', () => {
    it('should return tracer from isolated provider when set', () => {
      setAutolemetryTracerProvider(customProvider);

      const tracer = getAutolemetryTracer('test-tracer');

      // Verify tracer is from custom provider
      // (We can't directly compare tracers, but we can verify it's not throwing)
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });

    it('should return tracer from global provider when no isolated provider is set', () => {
      const tracer = getAutolemetryTracer('test-tracer');

      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe('function');
    });

    it('should use default tracer name when not specified', () => {
      setAutolemetryTracerProvider(customProvider);

      const tracer = getAutolemetryTracer();

      expect(tracer).toBeDefined();
    });

    it('should respect custom tracer name', () => {
      setAutolemetryTracerProvider(customProvider);

      const tracer = getAutolemetryTracer('custom-name', '1.0.0');

      expect(tracer).toBeDefined();
    });

    it('should support version parameter', () => {
      setAutolemetryTracerProvider(customProvider);

      const tracer = getAutolemetryTracer('my-service', '2.0.0');

      expect(tracer).toBeDefined();
    });
  });

  describe('Integration with Autolemetry config', () => {
    it('should allow isolated provider to work independently of init()', () => {
      // Don't call init(), just set isolated provider
      setAutolemetryTracerProvider(customProvider);

      const tracer = getAutolemetryTracer('standalone');
      expect(tracer).toBeDefined();

      // Should be able to create spans
      const span = tracer.startSpan('test-span');
      expect(span).toBeDefined();
      expect(typeof span.end).toBe('function');
      span.end();
    });

    it('should persist across multiple getTracer calls', () => {
      setAutolemetryTracerProvider(customProvider);

      const tracer1 = getAutolemetryTracer('service-1');
      const tracer2 = getAutolemetryTracer('service-2');

      // Both should come from the same provider
      expect(tracer1).toBeDefined();
      expect(tracer2).toBeDefined();
    });
  });

  describe('Global state isolation', () => {
    it('should not affect global OTel provider', () => {
      const globalProvider = trace.getTracerProvider();

      setAutolemetryTracerProvider(customProvider);

      // Global provider should remain unchanged
      expect(trace.getTracerProvider()).toBe(globalProvider);
      // But Autolemetry provider should be our custom one
      expect(getAutolemetryTracerProvider()).toBe(customProvider);
    });

    it('should allow both global and isolated providers to coexist', () => {
      const globalProvider = trace.getTracerProvider();
      setAutolemetryTracerProvider(customProvider);

      const globalTracer = trace.getTracer('global-tracer');
      const isolatedTracer = getAutolemetryTracer('isolated-tracer');

      expect(globalTracer).toBeDefined();
      expect(isolatedTracer).toBeDefined();

      // Can create spans from both
      const globalSpan = globalTracer.startSpan('global-span');
      const isolatedSpan = isolatedTracer.startSpan('isolated-span');

      expect(globalSpan).toBeDefined();
      expect(isolatedSpan).toBeDefined();

      globalSpan.end();
      isolatedSpan.end();
    });
  });
});
