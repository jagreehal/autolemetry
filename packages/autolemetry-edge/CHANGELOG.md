# autolemetry-edge

## 0.1.0

### Minor Changes

- a6e514b: Initial release (v0.0.1)

  ## 🎉 Features

  ### autolemetry
  - ✅ Zero-boilerplate OpenTelemetry tracing with `trace()` function
  - ✅ Auto-enrichment: Automatic capture of trace context, operation names, service version, and environment
  - ✅ Functional API: `trace()`, `span()`, `instrument()`, `withTracing()`
  - ✅ Business metrics via `Metrics` class (OpenTelemetry metrics for Prometheus/Grafana)
  - ✅ Product analytics via `track()` function and `Analytics` class
  - ✅ Structured logging with Pino and Winston adapters
  - ✅ Database instrumentation (`instrumentDatabase()`)
  - ✅ HTTP instrumentation helpers
  - ✅ Adaptive sampling (10% baseline, 100% errors/slow)
  - ✅ Rate limiting, circuit breakers, and graceful shutdown
  - ✅ Sensitive data auto-redaction
  - ✅ TypeScript 5.0+ decorators support
  - ✅ Auto-instrumentation support (HTTP, Express, Pino, etc.)

  ### autolemetry-adapters
  - ✅ PostHog adapter
  - ✅ Mixpanel adapter
  - ✅ Amplitude adapter
  - ✅ Segment adapter
  - ✅ Slack adapter
  - ✅ Webhook adapter (generic HTTP webhooks)
  - ✅ Base adapter classes for building custom adapters
  - ✅ Built-in retry logic, circuit breakers, and batching
  - ✅ Standalone usage (no OpenTelemetry required)

  ### autolemetry-edge
  - ✅ Ultra-lightweight edge runtime support
  - ✅ Cloudflare Workers compatible
  - ✅ Vercel Edge Functions compatible
  - ✅ Deno Deploy compatible
  - ✅ Minimal bundle size (~10KB gzipped)

  ## 🚀 Getting Started

  ```bash
  npm install autolemetry
  # or
  pnpm add autolemetry
  ```

  ```typescript
  import { init, trace, track } from 'autolemetry';

  init({ service: 'my-app' });

  export const createUser = trace('user.create', async (data) => {
    track('user.signup', { userId: data.id });
    return await db.users.create(data);
  });
  ```

  See the [README](https://github.com/jagreehal/autolemetry#readme) for full documentation.
