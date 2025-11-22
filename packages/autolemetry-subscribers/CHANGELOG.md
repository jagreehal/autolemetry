# autolemetry-subscribers

## 2.0.1

### Patch Changes

- Updated dependencies [da08e8d]
  - autolemetry@1.0.1

## 2.0.0

### Major Changes

- b5bd9ab: **BREAKING CHANGE**: Rename adapters → subscribers terminology across all packages

  This is a major refactoring to improve naming clarity and align with pub/sub patterns:

  ## autolemetry
  - **Class names**: `Analytics` → `Event`, `Metrics` → `Metric`
  - **Export paths**: `autolemetry/analytics` → `autolemetry/event`, `autolemetry/metrics` → `autolemetry/metric`
  - **Config property**: `adapters:` → `subscribers:` in `init()`
  - **Types**: `AnalyticsAdapter` → `EventSubscriber`, `AnalyticsPayload` → `EventPayload`

  ## autolemetry-subscribers
  - **Class names**: All adapter classes renamed (e.g., `PostHogAdapter` → `PostHogSubscriber`)
  - **Base class**: `AnalyticsAdapter` → `EventSubscriber`
  - **Streaming base**: `StreamingAnalyticsAdapter` → `StreamingEventSubscriber`
  - **Export paths**: All imports from `autolemetry-subscribers/posthog` etc. remain the same, just class names changed

  ## autolemetry-edge
  - **Types**: `EdgeAdaptersEvent` → `EdgeEvent`, `EdgeAdaptersAdapter` → `EdgeSubscriber`
  - **Functions**: `createEdgeAdapters()` → `createEdgeSubscribers()`, `getEdgeAdapters()` → `getEdgeSubscribers()`
  - **Config property**: `adapters:` → `subscribers:`

  ## Migration Guide

  ### Before

  ```typescript
  import { init } from 'autolemetry';
  import { PostHogAdapter } from 'autolemetry-subscribers/posthog';

  init({
    service: 'my-app',
    adapters: [new PostHogAdapter({ apiKey: '...' })],
  });
  ```

  ### After

  ```typescript
  import { init } from 'autolemetry';
  import { PostHogSubscriber } from 'autolemetry-subscribers/posthog';

  init({
    service: 'my-app',
    subscribers: [new PostHogSubscriber({ apiKey: '...' })],
  });
  ```

  ### Edge Runtime - Before

  ```typescript
  import { createEdgeAdapters, type EdgeAdaptersEvent } from 'autolemetry-edge';

  const adapters = createEdgeAdapters({
    transport: async (event: EdgeAdaptersEvent) => {
      /* ... */
    },
  });
  ```

  ### Edge Runtime - After

  ```typescript
  import { createEdgeSubscribers, type EdgeEvent } from 'autolemetry-edge';

  const subscribers = createEdgeSubscribers({
    transport: async (event: EdgeEvent) => {
      /* ... */
    },
  });
  ```

### Patch Changes

- Updated dependencies [b5bd9ab]
  - autolemetry@1.0.0

## 1.1.0

### Minor Changes

- feb78b4: - Updated dependencies: vitest to v4.0.10, typescript-eslint to v8.47.0, and other dev dependencies
  - Enhanced compatibility with autolemetry core package updates including gRPC protocol support and Honeycomb preset
  - Improved type safety and build tooling across all packages

## 1.0.3

### Patch Changes

- 856a69e: Refresh LLM quickstart docs with user-focused recipes, migration notes, and troubleshooting tips.
- Updated dependencies [856a69e]
  - autolemetry@0.1.3

## 1.0.2

### Patch Changes

- e413019: Update TypeScript ESLint dependencies to 8.46.4
  - Updated `@typescript-eslint/eslint-plugin` from ^8.46.3 to ^8.46.4
  - Updated `@typescript-eslint/parser` from ^8.46.3 to ^8.46.4
  - Updated `typescript-eslint` from ^8.46.3 to ^8.46.4

- Updated dependencies [e413019]
  - autolemetry@0.1.2

## 1.0.1

### Patch Changes

- Updated dependencies [d0cc838]
  - autolemetry@0.1.1

## 1.0.0

### Minor Changes

- a6e514b: Initial release (v0.0.1)

  ## 🎉 Features

  ### autolemetry
  - ✅ Zero-boilerplate OpenTelemetry tracing with `trace()` function
  - ✅ Auto-enrichment: Automatic capture of trace context, operation names, service version, and environment
  - ✅ Functional API: `trace()`, `span()`, `instrument()`, `withTracing()`
  - ✅ Business metrics via `Metrics` class (OpenTelemetry metrics for Prometheus/Grafana)
  - ✅ Product events via `track()` function and `Events` class
  - ✅ Structured logging with Pino and Winston adapters
  - ✅ Database instrumentation (`instrumentDatabase()`)
  - ✅ HTTP instrumentation helpers
  - ✅ Adaptive sampling (10% baseline, 100% errors/slow)
  - ✅ Rate limiting, circuit breakers, and graceful shutdown
  - ✅ Sensitive data auto-redaction
  - ✅ TypeScript 5.0+ decorators support
  - ✅ Auto-instrumentation support (HTTP, Express, Pino, etc.)

  ### autolemetry-subscribers
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

### Patch Changes

- Updated dependencies [a6e514b]
  - autolemetry@0.1.0
