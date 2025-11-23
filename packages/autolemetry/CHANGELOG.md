# autolemetry

## 2.0.0

### Major Changes

- 955ac09: **BREAKING CHANGES**: Move vendor backends to separate package and align with OpenTelemetry SDK array APIs

  ## Breaking Changes

  ### 1. Move vendor backend configurations to autolemetry-backends package
  - Remove `autolemetry/presets/honeycomb` and `autolemetry/presets/datadog` exports from autolemetry package
  - Vendor backend configurations are now in the new `autolemetry-backends` package

  ### 2. Align with OpenTelemetry SDK's native multi-item support

  Changed `AutolemetryConfig` to use array-based APIs for processors, exporters, and readers, matching OpenTelemetry SDK's recommended patterns:
  - `spanProcessor` → `spanProcessors: SpanProcessor[]`
  - `spanExporter` → `spanExporters: SpanExporter[]`
  - `metricReader` → `metricReaders: MetricReader[]`

  **What changed:**
  - Removed custom `CompositeSpanProcessor` class (~70 lines) - SDK handles this natively
  - Updated `init()` to accept arrays and pass them directly to `NodeSDKConfiguration`
  - Tests and documentation updated to reflect new API

  ## Migration Guide

  ### Backend Package Migration

  Install the new package:

  ```bash
  npm install autolemetry-backends
  ```

  Update imports:

  ```typescript
  // Before
  import { createHoneycombConfig } from 'autolemetry/presets/honeycomb';
  import { createDatadogConfig } from 'autolemetry/presets/datadog';

  // After
  import { createHoneycombConfig } from 'autolemetry-backends/honeycomb';
  import { createDatadogConfig } from 'autolemetry-backends/datadog';
  ```

  The configuration options remain identical - only the import path has changed.

  ### Array API Migration

  ```typescript
  // Before
  init({
    service: 'my-app',
    spanProcessor: new BatchSpanProcessor(new JaegerExporter()),
    spanExporter: new ZipkinExporter(),
    metricReader: new PrometheusExporter(),
  });

  // After
  init({
    service: 'my-app',
    spanProcessors: [new BatchSpanProcessor(new JaegerExporter())],
    spanExporters: [new ZipkinExporter()],
    metricReaders: [new PrometheusExporter()],
  });
  ```

  ## Why These Changes?

  ### Backend Package Separation
  - Keeps autolemetry core vendor-agnostic
  - Follows "Write once, observe everywhere" philosophy
  - Backend configs are optional conveniences, not core functionality
  - Aligns with package naming: `autolemetry-plugins` (inputs) vs `autolemetry-backends` (outputs)

  ### Array API Alignment
  - `spanProcessor` (singular) is deprecated in OpenTelemetry SDK
  - Native SDK support for arrays is more efficient and standard
  - Enables users to easily send data to multiple backends simultaneously
  - Consistent with `logRecordProcessors` which was already an array

  ## Benefits
  - Send spans to multiple backends: `spanProcessors: [jaegerProcessor, datadogProcessor]`
  - Send metrics to OTLP + Prometheus: `metricReaders: [otlpReader, prometheusReader]`
  - Cleaner code - no custom composite processor needed

## 1.0.1

### Patch Changes

- da08e8d: ## autolemetry-edge (v2.0.0)

  **BREAKING:** Split autolemetry-edge into vendor-agnostic foundation and Cloudflare-specific package

  **Breaking Changes:**
  - Package is now vendor-agnostic - Cloudflare-specific features moved to `autolemetry-cloudflare`
  - Removed: Handler instrumentation (`instrument()`, `instrumentDO()`, `instrumentWorkflow()`)
  - Removed: Bindings instrumentation (KV, R2, D1, etc.)
  - Removed: Cloudflare-specific global instrumentations

  **What Remains (Vendor-Agnostic):**
  - ✅ Core TracerProvider and OTLP exporter
  - ✅ Functional API (`trace()`, `span()`, `instrument()`)
  - ✅ Sampling strategies (adaptive, error-only, etc.)
  - ✅ Events system
  - ✅ Logger
  - ✅ Testing utilities

  **Tree-Shakeable Entry Points:**
  - `autolemetry-edge` - Core API
  - `autolemetry-edge/sampling` - Sampling strategies
  - `autolemetry-edge/events` - Events system
  - `autolemetry-edge/logger` - Logger
  - `autolemetry-edge/testing` - Testing utilities

  **Supported Runtimes:**
  - Cloudflare Workers (via `autolemetry-cloudflare`)
  - Vercel Edge Functions
  - Netlify Edge Functions
  - Deno Deploy
  - Any edge runtime with fetch() and AsyncLocalStorage

  ## autolemetry-cloudflare (v1.0.0)

  **New Package:** Complete OpenTelemetry solution for Cloudflare Workers

  **Features:**
  - ✅ Re-exports all of `autolemetry-edge` (functional API, sampling, events, logger, testing)
  - ✅ Complete bindings coverage (KV, R2, D1, DO, Workflows, AI, Vectorize, Hyperdrive, Service Bindings, Queue, Analytics Engine, Email)
  - ✅ Multiple API styles:
    - `instrument(handler, config)` - Compatible with @microlabs/otel-cf-workers
    - `wrapModule(config, handler)` - Compatible with workers-honeycomb-logger
    - `wrapDurableObject(config, DOClass)` - Durable Objects
  - ✅ Handler instrumentation (fetch, scheduled, queue, email)
  - ✅ Global instrumentations (fetch, cache)
  - ✅ Native Cloudflare OTel integration (works with wrangler.toml destinations)

  **Tree-Shakeable Entry Points:**
  - `autolemetry-cloudflare` - Everything
  - `autolemetry-cloudflare/bindings` - Just bindings
  - `autolemetry-cloudflare/handlers` - Just handlers
  - `autolemetry-cloudflare/sampling` - Re-export from autolemetry-edge
  - `autolemetry-cloudflare/events` - Re-export from autolemetry-edge
  - `autolemetry-cloudflare/logger` - Re-export from autolemetry-edge
  - `autolemetry-cloudflare/testing` - Re-export from autolemetry-edge

  **Bundle Size:** ~45KB (20KB edge + 25KB CF-specific)

  ## autolemetry (v1.x.x)

  **Bug Fix:** Fix ESM compatibility for auto-instrumentations loading

  Fixed a critical bug where the `integrations` option failed to load `@opentelemetry/auto-instrumentations-node` in ESM projects, even when the package was correctly installed. This affected all ESM projects using `"type": "module"` in package.json.

  **Symptoms:**
  - Warning appeared: `[autolemetry] Could not load auto-instrumentations...`
  - Warning showed even after installing `@opentelemetry/auto-instrumentations-node`
  - Only affected ESM contexts; CommonJS worked fine

  **Root Cause:**
  The code used bare `require()` which is undefined in ESM contexts. When bundled by tsup, it created a `__require()` helper that threw "Dynamic require not supported" errors in ESM.

  **Fix:**
  - Uses `createRequire(import.meta.url)` from Node's 'module' package for ESM compatibility
  - Falls back to native `require` in CommonJS contexts
  - Improved error handling to only catch MODULE_NOT_FOUND errors (package actually missing)
  - Other errors (syntax errors, etc.) are now properly propagated

  **Improved Warning Message:**
  The warning message is now more helpful when the package is actually missing:
  - Shows installation commands for npm, pnpm, and yarn
  - Explains the alternative (use functional API without auto-instrumentations)
  - Clarifies that integrations will be ignored until package is installed

  **Documentation Updates:**
  - Added "Optional: Auto-Instrumentations" section to Quick Start
  - Added FAQ entry explaining why it's an optional peer dependency
  - Clarified when users need vs. don't need auto-instrumentations

  **Testing:**
  - Verified fix works in example-http app (ESM with integrations)
  - Added dedicated test file documenting the ESM/CJS compatibility
  - All quality checks pass (type-check, lint, format, build, tests)

  This fix ensures autolemetry works seamlessly in both ESM and CommonJS projects while maintaining the lightweight, optional dependency architecture.

  ## Migration Guide

  ### For Cloudflare Workers Users

  **Before:**

  ```typescript
  import { instrument, trace } from 'autolemetry-edge';
  ```

  **After:**

  ```typescript
  import { instrument, trace } from 'autolemetry-cloudflare';
  // or
  import { wrapModule, trace } from 'autolemetry-cloudflare';
  ```

  ### For Other Edge Runtimes (Vercel, Netlify, Deno)

  Continue using `autolemetry-edge` - the functional API remains unchanged:

  ```typescript
  import { trace, init } from 'autolemetry-edge';

  init({
    service: { name: 'my-app' },
    exporter: { url: process.env.OTEL_ENDPOINT },
  });

  export const handler = trace(async (request: Request) => {
    return new Response('Hello World');
  });
  ```

## 1.0.0

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

## 0.1.3

### Patch Changes

- 856a69e: Refresh LLM quickstart docs with user-focused recipes, migration notes, and troubleshooting tips.

## 0.1.2

### Patch Changes

- e413019: Update TypeScript ESLint dependencies to 8.46.4
  - Updated `@typescript-eslint/eslint-plugin` from ^8.46.3 to ^8.46.4
  - Updated `@typescript-eslint/parser` from ^8.46.3 to ^8.46.4
  - Updated `typescript-eslint` from ^8.46.3 to ^8.46.4

## 0.1.1

### Patch Changes

- d0cc838: Add immediate execution pattern support to `trace()` function

  The `trace()` function now supports two patterns:
  1. **Factory pattern** - Returns a traced function: `trace(ctx => (...args) => result)`
  2. **Immediate execution** - Executes immediately with tracing: `trace(ctx => result)`

  This enables use cases like wrapper functions that need to execute immediately rather than returning a wrapped function.

## 0.1.0

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
