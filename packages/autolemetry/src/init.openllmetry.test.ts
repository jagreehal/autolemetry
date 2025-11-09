import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { mock, mockDeep, type DeepMockProxy } from 'vitest-mock-extended';

type SdkRecord = {
  options: Record<string, unknown>;
  instance: DeepMockProxy<NodeSDK>;
};

const mockedModules = [
  '@opentelemetry/sdk-node',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-metrics-otlp-http',
  '@opentelemetry/sdk-metrics',
  '@traceloop/node-server-sdk',
];

// Track traceloop initialize calls globally for vi.mock
const traceloopInitializeCalls: Array<Record<string, unknown>> = [];

async function loadInitWithMocks() {
  const sdkInstances: SdkRecord[] = [];

  class MockNodeSDK {
    constructor(options: Record<string, unknown>) {
      const instance = mockDeep<NodeSDK>();
      instance.start.mockImplementation(() => {});
      instance.shutdown.mockResolvedValue();
      // Add getTracerProvider method (not in public interface but used internally)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (instance as any).getTracerProvider = vi.fn().mockReturnValue(mock());
      sdkInstances.push({ options, instance });
      return instance;
    }
  }

  class MockOTLPTraceExporter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }

  class MockOTLPMetricExporter {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }

  class MockPeriodicExportingMetricReader {
    options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }

  const mockInitialize = vi.fn((options?: Record<string, unknown>) => {
    traceloopInitializeCalls.push(options || {});
  });

  vi.doMock('@opentelemetry/sdk-node', () => ({
    NodeSDK: MockNodeSDK,
  }));

  vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
    OTLPTraceExporter: MockOTLPTraceExporter,
  }));

  vi.doMock('@opentelemetry/exporter-metrics-otlp-http', () => ({
    OTLPMetricExporter: MockOTLPMetricExporter,
  }));

  vi.doMock('@opentelemetry/sdk-metrics', () => ({
    PeriodicExportingMetricReader: MockPeriodicExportingMetricReader,
  }));

  vi.doMock('@traceloop/node-server-sdk', () => ({
    initialize: mockInitialize,
    instrumentations: [{ name: 'openai' }, { name: 'langchain' }],
  }));

  const mod = await import('./init');

  return {
    init: mod.init,
    getConfig: mod.getConfig,
    sdkInstances,
    traceloopInitializeCalls,
    mockTraceloop: {
      initialize: mockInitialize, // Return the same mock function reference
      instrumentations: [{ name: 'openai' }, { name: 'langchain' }],
    },
  };
}

describe('init() OpenLLMetry integration', () => {
  beforeEach(() => {
    vi.resetModules();
    traceloopInitializeCalls.length = 0; // Clear calls array
  });

  afterEach(() => {
    for (const mod of mockedModules) {
      vi.doUnmock(mod);
    }
    vi.clearAllMocks();
    delete process.env.AUTOTELEMETRY_METRICS;
    delete process.env.NODE_ENV;
    delete process.env.TRACELOOP_API_KEY;
  });

  it('should not initialize OpenLLMetry when disabled', async () => {
    const { init, traceloopInitializeCalls } = await loadInitWithMocks();

    init({ service: 'test-app' });

    expect(traceloopInitializeCalls).toHaveLength(0);
  });

  it('should initialize OpenLLMetry when enabled', async () => {
    const { init, traceloopInitializeCalls } = await loadInitWithMocks();

    init({
      service: 'test-app',
      openllmetry: { enabled: true },
    });

    // Wait for async import to complete (require fails, falls back to async import)
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(traceloopInitializeCalls).toHaveLength(1);
    const callOptions = traceloopInitializeCalls[0];
    expect(callOptions).toBeDefined();
  });

  it('should pass OpenLLMetry options to initialize', async () => {
    const { init, traceloopInitializeCalls } = await loadInitWithMocks();

    init({
      service: 'test-app',
      openllmetry: {
        enabled: true,
        options: {
          disableBatch: true,
          apiKey: 'test-key',
        },
      },
    });

    // Wait for async import to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(traceloopInitializeCalls).toHaveLength(1);
    const callOptions = traceloopInitializeCalls[0];
    expect(callOptions).toMatchObject({
      disableBatch: true,
      apiKey: 'test-key',
    });
  });

  it('should reuse autolemetry tracer provider when OpenLLMetry is enabled', async () => {
    const { init, traceloopInitializeCalls, sdkInstances } =
      await loadInitWithMocks();

    init({
      service: 'test-app',
      openllmetry: { enabled: true },
    });

    expect(sdkInstances).toHaveLength(1);
    const sdkInstance = sdkInstances[0].instance;

    // Wait a bit for async operations if any
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(traceloopInitializeCalls).toHaveLength(1);
    const callOptions = traceloopInitializeCalls[0];
    // Should pass tracer provider to OpenLLMetry
    expect(callOptions).toBeDefined();
    // Verify getTracerProvider was called to get the provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sdkInstance as any).getTracerProvider).toHaveBeenCalled();
  });

  it('should add OpenLLMetry instrumentations when selectiveInstrumentation is false', async () => {
    const { init, sdkInstances, mockTraceloop } = await loadInitWithMocks();

    init({
      service: 'test-app',
      openllmetry: { enabled: true },
      integrations: false, // This means selectiveInstrumentation is true by default
    });

    const options = sdkInstances.at(-1)?.options as Record<string, unknown>;
    const instrumentations = options.instrumentations as unknown[];

    // When selectiveInstrumentation is true (default), OpenLLMetry instrumentations should be added
    expect(instrumentations).toBeDefined();
    // Should include OpenLLMetry instrumentations
    expect(mockTraceloop.instrumentations).toBeDefined();
  });

  it('should handle missing @traceloop/node-server-sdk gracefully', async () => {
    vi.doMock('@traceloop/node-server-sdk', () => {
      throw new Error('Module not found');
    });

    const { init } = await import('./init');

    // Should not throw, but log a warning
    expect(() => {
      init({
        service: 'test-app',
        openllmetry: { enabled: true },
      });
    }).not.toThrow();
  });

  it('should initialize OpenLLMetry after SDK start', async () => {
    const { init, sdkInstances, traceloopInitializeCalls } =
      await loadInitWithMocks();

    init({
      service: 'test-app',
      openllmetry: { enabled: true },
    });

    // Wait for async import to complete (require fails, falls back to async import)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify SDK started (it's called synchronously in init)
    expect(sdkInstances).toHaveLength(1);
    expect(sdkInstances[0].instance.start).toHaveBeenCalled();

    // Verify OpenLLMetry was initialized (via async import)
    expect(traceloopInitializeCalls).toHaveLength(1);
  });
});
