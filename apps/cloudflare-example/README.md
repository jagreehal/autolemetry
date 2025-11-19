# Cloudflare Example

This example demonstrates all features of `autolemetry-edge` for Cloudflare Workers:

## Features Demonstrated

- ✅ **HTTP Handler Instrumentation** - Automatic spans for fetch requests
- ✅ **Scheduled Handler** - Cron job instrumentation
- ✅ **Queue Handler** - Message processing with ack/retry tracking
- ✅ **Email Handler** - Email processing instrumentation
- ✅ **Auto-instrumented Bindings** - KV, R2, D1, and Service Bindings automatically traced
- ✅ **Global Fetch Instrumentation** - All fetch() calls traced
- ✅ **Global Cache Instrumentation** - Cache API operations traced
- ✅ **Adaptive Sampling** - Production-ready sampling (10% baseline, all errors, all slow requests)
- ✅ **Error Handling** - Proper span status codes and exception recording
- ✅ **Attribute Extractors** - Automatic attribute extraction from function args and results
- ✅ **Nested Spans** - Complex workflows with multiple nested operations
- ✅ **Code Block Tracing** - Using `span()` for tracing specific code blocks
- ✅ **Distributed Tracing** - Automatic trace context propagation across services
- ✅ **Fetch Span Customization** - postProcess callback for custom attributes
- ✅ **Disable Flag** - Option to disable instrumentation for local dev
- ✅ **Traced Functions** - Custom business logic tracing
- ✅ **Edge Logger** - Structured logging with trace correlation
- ✅ **Edge Adapters** - Events event tracking

## Usage

### Development

```bash
pnpm dev
```

The worker will start on `http://localhost:8787` and automatically connect to your local OTLP endpoint at `http://localhost:4318/v1/traces`.

### Endpoints

- `GET /` - Basic request processing with attribute extractors
- `GET /kv` - Demonstrates KV auto-instrumentation with attribute extractors (requires MY_KV binding)
- `GET /r2` - Demonstrates R2 auto-instrumentation (requires MY_R2 binding)
- `GET /d1` - Demonstrates D1 auto-instrumentation with result attributes (requires MY_D1 binding)
- `GET /service` - Demonstrates Service Binding auto-instrumentation (requires MY_SERVICE binding)
- `GET /cache` - Demonstrates cache instrumentation using `span()` for code blocks
- `GET /external` - Demonstrates distributed tracing with automatic context propagation
- `POST /payment` - Demonstrates error handling with proper span status codes
- `POST /users` - Demonstrates nested spans with validation and database operations

### Environment Variables

- `OTLP_ENDPOINT` - OTLP exporter URL (defaults to `http://localhost:4318/v1/traces`)
- `OTLP_HEADERS` - JSON string of headers for OTLP exporter
- `ENVIRONMENT` - Set to `"production"` for production sampling, otherwise uses 100% sampling
- `DISABLE_INSTRUMENTATION` - Set to `"true"` to disable all instrumentation

### Bindings

Add bindings in `alchemy.run.ts` or `wrangler.toml`:

```typescript
export const worker = await Worker('hello-worker', {
  entrypoint: './src/worker.ts',
  compatibilityFlags: ['nodejs_compat'],
  // Add bindings here
});
```

## What Gets Traced

1. **HTTP Requests**: All fetch handler requests create spans with:
   - `http.request.method`
   - `url.full`
   - `http.response.status_code`
   - Custom attributes via `postProcess` callback

2. **Scheduled Tasks**: Cron jobs create spans with:
   - `faas.trigger` (timer)
   - `faas.cron`
   - `faas.scheduled_time`
   - `faas.coldstart`

3. **Queue Messages**: Queue processing creates spans with:
   - `queue.name`
   - `queue.messages_count`
   - `queue.messages_success`
   - `queue.messages_failed`
   - Events for `messageAck`, `messageRetry`, etc.

4. **Email Processing**: Email handlers create spans with:
   - `messaging.destination.name`
   - `rpc.message.id`
   - `email.header.*` (all headers)

5. **Cloudflare Bindings**: All binding operations create spans:
   - **KV**: `KV {namespace}: {operation}` spans
   - **R2**: `R2 {bucket}: {operation}` spans
   - **D1**: `D1 {database}: {operation}` spans
   - **Service Bindings**: `Service {name}: {method}` spans

6. **Traced Functions**: Custom functions wrapped with `trace()` create nested spans with:
   - Automatic span naming from function names
   - Attribute extraction from arguments and results
   - Proper error handling with span status codes
   - Exception recording for debugging

7. **Adaptive Sampling**: Production-ready sampling configuration:
   - **Production**: 10% baseline, all errors, all slow requests (>1s)
   - **Development**: 100% sampling for debugging
   - **High Traffic**: 1% baseline, all errors, slow >2s
   - **Debugging**: 50% baseline, all errors, slow >500ms

8. **Error Handling**: Proper error tracking with:
   - `SpanStatusCode.ERROR` for failed operations
   - Exception recording via `recordException()`
   - Error messages in span status
   - Automatic error detection in sampling

9. **Nested Spans**: Complex workflows create hierarchical traces:
   - Parent spans for high-level operations
   - Child spans for sub-operations
   - Automatic context propagation
   - Full trace visibility across operations

10. **Code Block Tracing**: Use `span()` to trace specific code blocks:
    - Cache operations
    - Data transformations
    - Conditional logic
    - Any code that needs visibility

## Local Development

This example is configured to work in local development without requiring paid Cloudflare features:

- Defaults to local OTLP endpoint (`http://localhost:4318/v1/traces`)
- Uses 100% sampling in development (set `ENVIRONMENT=production` to test production sampling)
- Scheduled handlers work in dev mode
- Queue and Email handlers compile but require paid features to run
- All bindings are optional - code handles missing bindings gracefully

## Advanced Features

### Adaptive Sampling

The example uses adaptive sampling to reduce telemetry costs while capturing critical data:

```typescript
sampling: {
  tailSampler:
    env.ENVIRONMENT === 'production'
      ? SamplingPresets.production() // 10% baseline, all errors, slow >1s
      : SamplingPresets.development(), // 100% in dev
}
```

**Sampling Presets:**
- `SamplingPresets.production()` - 10% baseline, all errors, all slow (>1s)
- `SamplingPresets.highTraffic()` - 1% baseline, all errors, slow >2s
- `SamplingPresets.debugging()` - 50% baseline, all errors, slow >500ms
- `SamplingPresets.development()` - 100% sampling

### Error Handling

Proper error handling with span status codes:

```typescript
const processPayment = trace({
  name: 'payment.process',
  attributesFromArgs: ([amount, userId]) => ({
    'payment.amount': amount,
    'payment.user_id': userId,
  }),
}, (ctx) => async function processPayment(amount: number, userId: string) {
  try {
    // ... processing logic
  } catch (error) {
    ctx.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    ctx.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
});
```

### Attribute Extractors

Automatically extract attributes from function arguments and results:

```typescript
const getUser = trace({
  name: 'db.getUser',
  attributesFromArgs: ([userId]) => ({ 'user.id': userId }),
  attributesFromResult: (user) => ({ 'user.exists': !!user })
}, async function getUser(userId: string, db: D1Database) {
  // ...
});
```

### Code Block Tracing

Use `span()` to trace specific code blocks:

```typescript
const cached = await span(
  { name: 'cache.check', attributes: { 'cache.key': url.pathname } },
  async (childSpan) => {
    const cached = await caches.default.match(request);
    childSpan.setAttribute('cache.hit', !!cached);
    return cached;
  },
);
```

### Distributed Tracing

Trace context is automatically propagated via HTTP headers:

```typescript
// Trace context automatically propagated
const response = await fetch('https://api.example.com/data', {
  headers: request.headers, // Trace context in headers
});
```

### Nested Spans

Create complex workflows with nested spans:

```typescript
const validateAndCreate = trace({
  name: 'user.create',
  attributesFromArgs: ([data]) => ({ 'user.email': data.email }),
  attributesFromResult: (user) => ({ 'user.id': user.id }),
}, async function validateAndCreate(data, db) {
  const valid = await validateInput(data);      // Child span
  const exists = await checkDuplicate(valid.email, db); // Child span
  if (exists) throw new Error('User already exists');
  return await insertUser(valid, db);          // Child span
});
```

## Running OTLP Collector Locally

Use Docker to run a local OTLP collector:

```bash
docker run -p 4318:4318 -p 4317:4317 \
  -v $(pwd)/otel-collector-config.yaml:/etc/otelcol/config.yaml \
  otel/opentelemetry-collector:latest
```

Or use the simple HTTP receiver:

```bash
docker run -p 4318:4318 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  otel/opentelemetry-collector:latest \
  --config=/etc/otelcol/config.yaml
```

## Configuration

### Using Alchemy (Current Setup)

This project uses `alchemy.run.ts` for configuration. See `alchemy.run.ts` for the current setup.

### Using Wrangler (Alternative)

If you prefer using `wrangler.toml`, see `wrangler.toml.example` for a complete configuration example.

## Production Deployment Checklist

- [ ] Set `ENVIRONMENT=production` for adaptive sampling
- [ ] Configure `OTLP_ENDPOINT` to your observability platform
- [ ] Set `OTLP_HEADERS` with authentication if required
- [ ] Review sampling rates based on your traffic volume
- [ ] Configure bindings (KV, R2, D1, Service Bindings) as needed
- [ ] Set up scheduled triggers if using cron jobs
- [ ] Configure queue consumers if using Cloudflare Queues
- [ ] Test error handling and verify exceptions are recorded
- [ ] Verify distributed tracing works across services
- [ ] Monitor telemetry costs and adjust sampling if needed

## Comparison with Other Examples

This example is more comprehensive than basic OpenTelemetry examples because it includes:

1. **Adaptive Sampling** - Production-ready cost optimization
2. **Error Handling** - Proper span status codes and exception recording
3. **Attribute Extractors** - Automatic attribute extraction
4. **Nested Spans** - Complex workflow tracing
5. **Code Block Tracing** - Fine-grained visibility
6. **Distributed Tracing** - Automatic context propagation
7. **Multiple Handler Types** - Fetch, Scheduled, Queue, Email
8. **Auto-instrumentation** - KV, R2, D1, Service Bindings, Fetch, Cache
9. **Edge Adapters** - Events event tracking
10. **Production Best Practices** - Environment-based configuration, proper error handling
