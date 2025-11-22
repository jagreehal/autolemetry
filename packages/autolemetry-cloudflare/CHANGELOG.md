# autolemetry-cloudflare

## 2.0.0

### Major Changes

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

### Patch Changes

- Updated dependencies [da08e8d]
  - autolemetry-edge@3.0.0
