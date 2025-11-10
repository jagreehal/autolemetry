import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpInstrumented, traceHttpRequest, injectTraceContext } from './http';
import { configure, resetConfig } from './config';

describe('HttpInstrumented', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('should instrument HTTP methods', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented({ serviceName: 'api-client' })
    class ApiClient {
      async getUser(userId: string) {
        return { status: 200, data: { id: userId, name: 'Test' } };
      }
    }

    const client = new ApiClient();
    const result = await client.getUser('123');

    expect(result.data).toEqual({ id: '123', name: 'Test' });
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP GET 123',
      expect.any(Function),
    );
    expect(mockSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'http.method': 'GET',
        'service.name': 'api-client',
        'operation.name': 'api-client.getUser',
      }),
    );
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should infer HTTP methods from method names', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented()
    class ApiClient {
      async fetchData() {
        return { status: 200 };
      }
      async createUser() {
        return { status: 201 };
      }
      async updateProfile() {
        return { status: 200 };
      }
      async deleteAccount() {
        return { status: 204 };
      }
    }

    const client = new ApiClient();

    await client.fetchData();
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP GET',
      expect.any(Function),
    );

    await client.createUser();
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP POST',
      expect.any(Function),
    );

    await client.updateProfile();
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP PUT',
      expect.any(Function),
    );

    await client.deleteAccount();
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP DELETE',
      expect.any(Function),
    );
  });

  it('should extract URL and parse it', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented()
    class ApiClient {
      async getUser(url: string) {
        return { status: 200, url };
      }
    }

    const client = new ApiClient();
    await client.getUser('https://api.example.com/users/123?include=profile');

    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'HTTP GET /users/123',
      expect.any(Function),
    );
    expect(mockSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'http.scheme': 'https',
        'http.host': 'api.example.com',
        'http.target': '/users/123?include=profile',
      }),
    );
  });

  it('should mark slow requests', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented({ slowRequestThresholdMs: 10 })
    class ApiClient {
      async slowRequest() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { status: 200 };
      }
    }

    const client = new ApiClient();
    await client.slowRequest();

    expect(mockSpan.setAttribute).toHaveBeenCalledWith(
      'http.slow_request',
      true,
    );
    expect(mockSpan.setAttribute).toHaveBeenCalledWith(
      'http.slow_request_threshold_ms',
      10,
    );
  });

  it('should mark 4xx/5xx as errors', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented()
    class ApiClient {
      async notFound() {
        return { status: 404 };
      }
    }

    const client = new ApiClient();
    await client.notFound();

    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 2, // SpanStatusCode.ERROR
      message: 'HTTP 404',
    });
  });

  it('should handle errors correctly', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      setAttribute: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    @HttpInstrumented()
    class ApiClient {
      async failingRequest() {
        throw new Error('Network timeout');
      }
    }

    const client = new ApiClient();

    await expect(client.failingRequest()).rejects.toThrow('Network timeout');

    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 2, // SpanStatusCode.ERROR
      message: 'Network timeout',
    });
    expect(mockSpan.end).toHaveBeenCalled();
  });
});

describe('traceHttpRequest', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('should trace HTTP requests', async () => {
    const mockSpan = {
      setStatus: vi.fn(),
      setAttributes: vi.fn(),
      end: vi.fn(),
    };

    const mockTracer = {
      startActiveSpan: vi.fn((name, fn) => fn(mockSpan)),
    };

    configure({
      tracer: mockTracer as any,
    });

    const result = await traceHttpRequest(
      'GET /api/users',
      async () => ({ data: [1, 2, 3] }),
      {
        'http.method': 'GET',
        'http.target': '/api/users',
      },
    );

    expect(result).toEqual({ data: [1, 2, 3] });
    expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
      'GET /api/users',
      expect.any(Function),
    );
    expect(mockSpan.setAttributes).toHaveBeenCalledWith({
      'http.method': 'GET',
      'http.target': '/api/users',
    });
    expect(mockSpan.end).toHaveBeenCalled();
  });
});

describe('injectTraceContext', () => {
  it('should inject traceparent header', async () => {
    const mockSpanContext = {
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      traceFlags: 1,
    };

    const mockSpan = {
      spanContext: () => mockSpanContext,
    };

    // Mock the trace.getSpan to return our mock span
    const { context, trace } = await import('@opentelemetry/api');

    vi.spyOn(trace, 'getSpan').mockReturnValue(mockSpan as any);

    vi.spyOn(context, 'active').mockReturnValue({} as any);

    const headers = injectTraceContext({
      'Content-Type': 'application/json',
    });

    expect(headers['traceparent']).toBe(
      '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    );
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should return headers unchanged if no active span', async () => {
    const { context, trace } = await import('@opentelemetry/api');
    // eslint-disable-next-line unicorn/no-useless-undefined
    vi.spyOn(trace, 'getSpan').mockReturnValue(undefined);

    vi.spyOn(context, 'active').mockReturnValue({} as any);

    const headers = injectTraceContext({
      'Content-Type': 'application/json',
    });

    expect(headers).toEqual({ 'Content-Type': 'application/json' });
    expect(headers['traceparent']).toBeUndefined();
  });
});
