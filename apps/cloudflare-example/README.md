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
- ✅ **Fetch Span Customization** - postProcess callback for custom attributes
- ✅ **Disable Flag** - Option to disable instrumentation for local dev
- ✅ **Traced Functions** - Custom business logic tracing
- ✅ **Edge Logger** - Structured logging with trace correlation
- ✅ **Edge Adapters** - Analytics event tracking

## Usage

### Development

```bash
pnpm dev
```

The worker will start on `http://localhost:8787` and automatically connect to your local OTLP endpoint at `http://localhost:4318/v1/traces`.

### Endpoints

- `GET /` - Basic request processing
- `GET /kv` - Demonstrates KV auto-instrumentation (requires MY_KV binding)
- `GET /r2` - Demonstrates R2 auto-instrumentation (requires MY_R2 binding)
- `GET /d1` - Demonstrates D1 auto-instrumentation (requires MY_D1 binding)
- `GET /service` - Demonstrates Service Binding auto-instrumentation (requires MY_SERVICE binding)

### Environment Variables

- `OTLP_ENDPOINT` - OTLP exporter URL (defaults to `http://localhost:4318/v1/traces`)
- `OTLP_HEADERS` - JSON string of headers for OTLP exporter
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

6. **Traced Functions**: Custom functions wrapped with `trace()` create nested spans

## Local Development

This example is configured to work in local development without requiring paid Cloudflare features:

- Defaults to local OTLP endpoint (`http://localhost:4318/v1/traces`)
- Scheduled handlers work in dev mode
- Queue and Email handlers compile but require paid features to run
- All bindings are optional - code handles missing bindings gracefully

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
