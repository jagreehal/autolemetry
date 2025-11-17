# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Autolemetry is a monorepo containing three packages that provide ergonomic OpenTelemetry instrumentation for Node.js and edge runtimes. The core philosophy is "Write once, observe everywhere" - instrument code a single time and stream observability data to any OTLP-compatible backend without vendor lock-in.

## Package Architecture

### `packages/autolemetry` (Core)
The main package providing OpenTelemetry instrumentation with an ergonomic functional API. Key concepts:

- **Functional API**: Primary interface using `trace()`, `span()`, and `instrument()` functions that wrap business logic with automatic span lifecycle management
- **Dual Configuration System**:
  - `init()` sets up global OpenTelemetry SDK (service name, exporters, resource detection)
  - `getConfig()` provides runtime configuration for sampling, rate limiting, circuit breakers
- **Production Hardening**: Built-in rate limiters, circuit breakers, and PII redaction
- **Adaptive Sampling**: Defaults to 10% baseline sampling, 100% for errors/slow operations (tail sampling)
- **Analytics Integration**: Unified API to send product analytics events to any platform via adapters
- **Multiple Entry Points**: Package uses explicit exports (check `package.json` exports field) for tree-shaking:
  - `autolemetry` - Core trace/span/init functions
  - `autolemetry/logger` - Pino integration
  - `autolemetry/analytics` - Analytics API
  - `autolemetry/metrics` - Metrics helpers
  - `autolemetry/testing` - Test utilities
  - And more (see package.json exports)

### `packages/autolemetry-adapters`
Analytics adapters for product analytics platforms (PostHog, Mixpanel, Amplitude, Segment, webhooks). All adapters extend `AnalyticsAdapter` base class which provides:
- Error handling and retry logic
- Graceful shutdown with pending request tracking
- Consistent payload normalization
- Tree-shakeable exports (each adapter is a separate entry point)

### `packages/autolemetry-edge`
Lightweight OpenTelemetry implementation for edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy). Bundle size optimized (~43KB vs 700KB for Node.js version). Implements a minimal OpenTelemetry SDK subset compatible with edge constraints.

## Development Commands

### Building
```bash
pnpm build              # Build all packages (uses Turborepo)
pnpm dev                # Watch mode for all packages
```

### Testing
```bash
# Run all tests (unit + integration)
pnpm test

# Package-specific testing (in package directory)
pnpm test               # Unit tests only (vitest.unit.config.ts)
pnpm test:watch         # Unit tests in watch mode
pnpm test:integration   # Integration tests (vitest.integration.config.ts)

# Run single test file
npx vitest run src/functional.test.ts
```

**Important**: The core `autolemetry` package has separate unit and integration test configs:
- `vitest.unit.config.ts` - Excludes `*.integration.test.ts` files
- `vitest.integration.config.ts` - Only runs `*.integration.test.ts` files

### Linting & Formatting
```bash
pnpm lint               # Lint all packages (ESLint)
pnpm format             # Format with Prettier
pnpm type-check         # TypeScript type checking
```

### Quality Check
```bash
pnpm quality            # Runs: build + lint + format + type-check + test + test:integration
```

### Running Examples
```bash
# Basic example (demonstrates trace() usage)
pnpm --filter @jagreehal/example-basic start

# HTTP server example
pnpm --filter @jagreehal/example-http start

# Cloudflare Workers example
pnpm --filter cloudflare-example dev
```

### Changesets (Version Management)
```bash
pnpm changeset          # Create a changeset for your changes
pnpm version-packages   # Bump versions based on changesets
pnpm release            # Build and publish to npm
```

When creating changesets:
- Select affected packages (autolemetry, autolemetry-adapters, autolemetry-edge)
- Choose semver bump: patch (bug fixes), minor (new features), major (breaking changes)
- Write clear summary for CHANGELOG

## Code Structure Patterns

### Functional API Pattern (`packages/autolemetry/src/functional.ts`)
The core `trace()` function uses a factory pattern to detect if the user is passing a function that needs a context parameter:

```typescript
// Factory pattern (receives ctx)
export const createUser = trace(ctx => async (data) => {
  ctx.setAttribute('user.id', data.id)
  return await db.users.create(data)
})

// Direct pattern (no ctx needed)
export const getUser = trace(async (id) => {
  return await db.users.findById(id)
})
```

The implementation auto-detects the pattern by analyzing the function signature and checking the first parameter name against known hints (`ctx`, `context`, `tracecontext`, etc.).

#### Trace Name Inference

Trace names are inferred automatically with the following priority:
1. **Explicit name** (from `trace('customName', ...)` or `instrument()` key)
2. **Named function expressions** (e.g., `trace((ctx) => async function createUser() {})`)
3. **Variable name from assignment** (e.g., `const processDocuments = trace(...)` → "processDocuments")
4. **Factory function name** (if the outer function is named)

The variable name inference (priority #3) works by analyzing the call stack to find the source line where `trace()` is called, then parsing it to extract the variable name from const/let/var assignments. This is especially useful for arrow functions in the factory pattern:

```typescript
// Arrow function with inferred name from const assignment
export const processDocuments = trace((ctx) => async (data: string) => {
  ctx.setAttribute('document.count', data.length)
  return data.toUpperCase()
})
// Trace name: "processDocuments" (inferred from const)

// Named function expression (takes precedence)
export const processDocuments = trace((ctx) => async function processData(data: string) => {
  return data.toUpperCase()
})
// Trace name: "processData" (from named function, not "processDocuments")
```

**Limitations:**
- Minified/obfuscated code may prevent name inference
- Edge runtimes without file system access will fall back to unnamed spans
- Results are cached per source location for performance

### Analytics Queue Pattern (`packages/autolemetry/src/analytics-queue.ts`)
Analytics events use an async queue to prevent blocking the main execution path:
- Events are queued immediately and returned
- Background worker processes queue and sends to all configured adapters
- Adapters can implement batching/buffering independently
- Shutdown waits for queue to drain

### Configuration Layering
Two separate config systems serve different purposes:
1. **Init Config** (`init.ts`): Global OpenTelemetry SDK setup (resource, exporters, instrumentations)
2. **Runtime Config** (`config.ts`): Per-operation configuration (sampling rates, rate limits, circuit breaker thresholds)

### Tail Sampling Processor (`packages/autolemetry/src/tail-sampling-processor.ts`)
Implements deferred sampling decisions:
- Spans are buffered in-memory during execution
- Sampling decision made after span ends (can inspect attributes, status, duration)
- Default `AdaptiveSampler`: 10% baseline, 100% errors, 100% slow requests
- Custom samplers can implement `Sampler` interface

## Testing Patterns

### Test Harnesses
Use provided test harnesses for consistent testing:

```typescript
// Analytics adapters
import { AdapterTestHarness } from 'autolemetry-adapters/testing'

const harness = new AdapterTestHarness(new MyAdapter(config))
await harness.testBasicEvent()
await harness.testErrorHandling()

// Core testing utilities
import { InMemorySpanExporter } from 'autolemetry/testing'

const exporter = new InMemorySpanExporter()
// Use in tests to capture spans
```

### Integration Tests
Integration tests require OpenTelemetry SDK setup, so they're isolated in `*.integration.test.ts` files and run with a separate vitest config.

## Important Patterns & Conventions

### Tree-Shaking & Bundle Size
All packages are configured for aggressive tree-shaking:
- Use `"sideEffects": false` in package.json
- Export all public APIs explicitly in package.json `exports` field
- Keep dependencies minimal (especially in autolemetry-edge)
- External dependencies (pino, winston) are marked as peer/optional

### TypeScript Decorators
The codebase uses TypeScript 5.0+ decorators (not experimental legacy decorators). Test execution uses `tsx` which supports the new decorator syntax. The `decorators.ts` module provides `@Trace` decorator for class methods.

### OpenTelemetry Context Propagation
The library uses standard OpenTelemetry context propagation:
- Active context is stored in AsyncLocalStorage (Node.js) or async context (edge)
- `trace()` automatically creates child spans in the active context
- Use `withNewContext()` to create isolated trace trees
- Context includes custom attributes via `runInOperationContext()`

### Graceful Shutdown
All components implement graceful shutdown:
- `shutdown()` function flushes pending spans/metrics/logs
- Analytics queue drains before shutdown completes
- Adapters track pending requests and wait for completion
- Use `flush()` for intermediate flushing without shutdown

## Common Development Workflows

### Adding a New Analytics Adapter
1. Create new file in `packages/autolemetry-adapters/src/`
2. Extend `AnalyticsAdapter` base class
3. Implement `sendToDestination(payload: AdapterPayload)` method
4. Add export to `packages/autolemetry-adapters/src/index.ts`
5. Add entry point to `package.json` exports field
6. Add tests using `AdapterTestHarness`
7. Create changeset with `pnpm changeset`

### Adding a New Instrumentation Integration
1. Add instrumentation logic to `packages/autolemetry/src/` (e.g., `redis.ts`)
2. Export from `packages/autolemetry/src/index.ts`
3. Add entry point to `package.json` exports if tree-shakeable
4. Add tests (unit tests in `.test.ts`, integration tests in `.integration.test.ts`)
5. Update `init.ts` if it needs special SDK configuration
6. Create changeset

### Working with Monorepo Dependencies
- Use `workspace:*` protocol in package.json for internal dependencies
- Changes to dependencies automatically trigger rebuilds (Turborepo cache)
- Install new dependency: `pnpm add <package> --filter <workspace-name>`
- Example: `pnpm add zod --filter autolemetry`

## Known Constraints

### Edge Runtime Limitations
- No Node.js APIs (fs, net, process) in autolemetry-edge
- Bundle size must stay under 1MB for Cloudflare Workers free tier
- Some OpenTelemetry features unavailable (auto-instrumentations, resource detectors)
- Context propagation uses minimal AsyncLocalStorage polyfill

### Peer Dependencies
- OpenTelemetry auto-instrumentations are optional peer dependencies
- Logger integrations (pino, winston) are optional
- OpenLLMetry integration (@traceloop/node-server-sdk) is optional
- Missing peer dependencies should gracefully degrade with helpful error messages

### Build Outputs
- ESM-first with CJS fallback for index.ts only
- Type definitions (.d.ts) generated from ESM build
- Source maps enabled for debugging
- Use `tsup` for bundling (not tsc directly)
