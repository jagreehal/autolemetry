# autolemetry-edge

OpenTelemetry SDK for edge runtimes. Supports Cloudflare Workers, Vercel Edge Functions, Netlify Edge Functions, and Deno Deploy.

## Installation

```bash
npm install autolemetry-edge @opentelemetry/api
```

**Requirements:**
- Cloudflare Workers: requires `nodejs_compat` compatibility flag
- Vercel Edge: no additional configuration
- Netlify Edge: no additional configuration
- Deno Deploy: no additional configuration

## Examples

### Complete Example: API Worker with Tracing

```typescript
import { trace, createEdgeLogger, instrument } from 'autolemetry-edge'
import { SamplingPresets } from 'autolemetry-edge/sampling'

export interface Env {
  OTLP_ENDPOINT: string
  API_KEY: string
  DB: D1Database
}

const log = createEdgeLogger('api-worker')

// Business logic with automatic tracing
const getUser = trace({
  name: 'db.getUser',
  attributesFromArgs: ([userId]) => ({ 'user.id': userId }),
  attributesFromResult: (user) => ({ 'user.exists': !!user })
}, async function getUser(userId: string, db: D1Database) {
  const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  return result as { id: string; email: string } | null
})

const createUser = trace({
  name: 'db.createUser',
  attributesFromArgs: ([email]) => ({ 'user.email': email })
}, async function createUser(email: string, db: D1Database) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run()
  log.info('User created', { userId: id, email })
  return { id, email }
})

// Handler with automatic HTTP instrumentation
const handler: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    
    if (url.pathname === '/users' && request.method === 'POST') {
      const { email } = await request.json()
      const user = await createUser(email, env.DB)
      return Response.json(user, { status: 201 })
    }
    
    if (url.pathname.startsWith('/users/')) {
      const userId = url.pathname.split('/')[2]
      const user = await getUser(userId, env.DB)
      
      if (!user) {
        return Response.json({ error: 'Not found' }, { status: 404 })
      }
      
      return Response.json(user)
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}

export default instrument(handler, (env: Env) => ({
  exporter: {
    url: env.OTLP_ENDPOINT,
    headers: { 'x-api-key': env.API_KEY }
  },
  service: {
    name: 'api-worker',
    version: '1.0.0'
  },
  sampling: {
    tailSampler: SamplingPresets.production()
  }
}))
```

### Error Handling Example

```typescript
import { trace, createEdgeLogger } from 'autolemetry-edge'
import { SpanStatusCode } from '@opentelemetry/api'

const log = createEdgeLogger('payment')

const processPayment = trace(ctx => async function processPayment(
  amount: number,
  userId: string
) {
  try {
    ctx.setAttribute('payment.amount', amount)
    ctx.setAttribute('payment.user_id', userId)
    
    // Simulate payment processing
    if (amount < 0) {
      throw new Error('Invalid amount')
    }
    
    const result = await chargeCard(userId, amount)
    ctx.setAttribute('payment.transaction_id', result.id)
    
    return result
  } catch (error) {
    ctx.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    ctx.recordException(error instanceof Error ? error : new Error(String(error)))
    log.error('Payment failed', { error, amount, userId })
    throw error
  }
})
```

### Vercel Edge Function Example

```typescript
import { trace, createEdgeLogger } from 'autolemetry-edge'

const log = createEdgeLogger('vercel-edge')

const fetchUserData = trace({
  name: 'api.fetchUserData',
  attributesFromArgs: ([userId]) => ({ 'user.id': userId })
}, async function fetchUserData(userId: string) {
  const response = await fetch(`https://api.example.com/users/${userId}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`)
  }
  return response.json()
})

export const config = {
  runtime: 'edge'
}

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  
  if (!userId) {
    return Response.json({ error: 'Missing userId' }, { status: 400 })
  }
  
  try {
    const userData = await fetchUserData(userId)
    log.info('User data fetched', { userId })
    return Response.json(userData)
  } catch (error) {
    log.error('Failed to fetch user data', { error, userId })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Multiple Nested Spans Example

```typescript
import { trace } from 'autolemetry-edge'

const validateInput = trace(async function validateInput(data: any) {
  if (!data.email) throw new Error('Email required')
  if (!data.name) throw new Error('Name required')
  return data
})

const checkDuplicate = trace({
  name: 'db.checkDuplicate',
  attributesFromArgs: ([email]) => ({ 'user.email': email })
}, async function checkDuplicate(email: string, db: D1Database) {
  const result = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  return !!result
})

const insertUser = trace({
  name: 'db.insertUser',
  attributesFromArgs: ([user]) => ({ 'user.email': user.email })
}, async function insertUser(user: { email: string; name: string }, db: D1Database) {
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)')
    .bind(id, user.email, user.name)
    .run()
  return { id, ...user }
})

const createUser = trace({
  name: 'user.create',
  attributesFromArgs: ([data]) => ({ 'user.email': data.email }),
  attributesFromResult: (user) => ({ 'user.id': user.id })
}, async function createUser(data: { email: string; name: string }, db: D1Database) {
  const valid = await validateInput(data)
  const exists = await checkDuplicate(valid.email, db)
  
  if (exists) {
    throw new Error('User already exists')
  }
  
  return insertUser(valid, db)
})
```

### Batch Operations Example

```typescript
import { trace, instrument } from 'autolemetry-edge'

export interface Env {
  OTLP_ENDPOINT: string
  API_KEY: string
}

const processItem = trace({
  name: 'batch.processItem',
  attributesFromArgs: ([item]) => ({ 'item.id': item.id })
}, async function processItem(item: { id: string; data: any }) {
  // Process individual item
  return { id: item.id, processed: true }
})

const processBatch = trace({
  name: 'batch.process',
  attributesFromArgs: ([items]) => ({ 'batch.size': items.length })
}, async function processBatch(items: { id: string; data: any }[]) {
  const results = await Promise.all(
    items.map(item => processItem(item))
  )
  return results
})

const handler: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === 'POST') {
      const { items } = await request.json()
      const results = await processBatch(items)
      return Response.json({ processed: results.length })
    }
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
}

export default instrument(handler, (env: Env) => ({
  exporter: {
    url: env.OTLP_ENDPOINT,
    headers: { 'x-api-key': env.API_KEY }
  },
  service: { name: 'batch-processor', version: '1.0.0' }
}))
```

### Cache with Tracing Example

```typescript
import { trace } from 'autolemetry-edge'

const fetchWithCache = trace({
  name: 'cache.fetch',
  attributesFromArgs: ([url]) => ({ 'cache.url': url })
}, async function fetchWithCache(url: string, cache: Cache) {
  // Check cache first
  const cached = await cache.match(url)
  if (cached) {
    return cached
  }
  
  // Fetch and cache
  const response = await fetch(url)
  await cache.put(url, response.clone())
  return response
})
```

### Distributed Tracing Example

```typescript
import { trace, instrument } from 'autolemetry-edge'

export interface Env {
  OTLP_ENDPOINT: string
  API_KEY: string
}

// Service A: Initiates trace
const getUserData = trace({
  name: 'api.getUserData',
  attributesFromArgs: ([userId]) => ({ 'user.id': userId })
}, async function getUserData(userId: string) {
  const response = await fetch(`https://api.example.com/users/${userId}`)
  return response.json()
})

const handlerA: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const userId = new URL(request.url).searchParams.get('userId')
    
    // Call Service B with trace context automatically propagated via headers
    const response = await fetch(`https://service-b.example.com/api/user/${userId}`, {
      headers: request.headers // Trace context automatically in headers
    })
    
    return response
  }
}

// Service B: Continues trace from Service A
const handlerB: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const userId = new URL(request.url).pathname.split('/').pop()
    const user = await getUserData(userId || '')
    return Response.json(user)
  }
}

// Both services export instrumented handlers
// Service A
export default instrument(handlerA, (env: Env) => ({
  exporter: { url: env.OTLP_ENDPOINT },
  service: { name: 'service-a', version: '1.0.0' }
}))

// Service B (in separate file)
// export default instrument(handlerB, (env: Env) => ({
//   exporter: { url: env.OTLP_ENDPOINT },
//   service: { name: 'service-b', version: '1.0.0' }
// }))
```

## Usage

### Functional API

Wrap functions with `trace()` to create spans. **Use named function expressions** so Autolemetry can infer the span name automatically.

```typescript
import { trace, createEdgeLogger } from 'autolemetry-edge'

const log = createEdgeLogger('user')

// ✅ Recommended: named function expression – span name inferred as "createUser"
export const createUser = trace(async function createUser(email: string) {
  log.info('Creating user', { email })
  return { id: '123', email }
})

// Alternative: provide an explicit name when using arrow functions
// export const createUser = trace('user.create', async (email: string) => {
//   return { id: '123', email }
// })

// ⚠️ Anonymous arrow functions (`trace(async () => ...)`) show up as "unknown" in traces

export default {
  async fetch(request: Request) {
    const user = await createUser('test@example.com')
    return Response.json(user)
  }
}
```

Access trace context via the `ctx` parameter:

```typescript
import { trace } from 'autolemetry-edge'

// Factory pattern - returns a wrapped function
export const createUser = trace(ctx => async function createUser(email: string) {
  ctx.setAttribute('user.email', email)
  ctx.setAttribute('operation.type', 'create')
  console.log('Trace ID:', ctx.traceId)
  console.log('Function name:', ctx['code.function'])
  return { id: '123', email }
})

// Immediate execution - wraps and executes instantly (for middleware/wrappers)
function timed<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  return trace(operation, async (ctx) => {
    ctx.setAttribute('operation', operation);
    return await fn();
  });
}
// Executes immediately, returns Promise<T> directly
```

**Two patterns supported:**

1. **Factory pattern** `trace(ctx => (...args) => result)` – Returns a wrapped function for reuse
2. **Immediate execution** `trace(ctx => result)` – Executes once immediately, returns the result directly

### Trace Specific Code Blocks

Use `span()` to trace smaller blocks of code without wrapping an entire function.

```typescript
import { span } from 'autolemetry-edge'

export async function rollTheDice(times: number) {
  const rolls: number[] = []

  for (let i = 0; i < times; i++) {
    await span({ name: 'roll.once', attributes: { attempt: i + 1 } }, async (childSpan) => {
      const value = Math.floor(Math.random() * 6) + 1
      childSpan.setAttribute('value', value)
      rolls.push(value)
    })
  }

  const total = span({ name: 'calculate.total' }, () => rolls.reduce((sum, value) => sum + value, 0))

  return { rolls, total }
}
```

`span()` works for synchronous callbacks too:

```typescript
const latencyBucket = span({ name: 'bucket.latency' }, () => computeLatencyBucket(latencyMs))
```

### Attribute Extractors

Extract attributes from function arguments and return values:

```typescript
export const createUser = trace({
  name: 'user.create',
  attributesFromArgs: ([email]) => ({ 'user.email': email }),
  attributesFromResult: (user) => ({ 'user.id': user.id })
}, async (email: string) => {
  return { id: '123', email }
})
```

### Per-Function Sampling

Apply custom samplers to individual functions:

```typescript
import { TraceIdRatioBasedSampler, AlwaysOffSampler } from '@opentelemetry/sdk-trace-base'

export const heavyOperation = trace({
  name: 'heavy.operation',
  sampler: new TraceIdRatioBasedSampler(0.1)
}, async (data: any) => {
  return processData(data)
})

export const healthCheck = trace({
  name: 'health.check',
  sampler: new AlwaysOffSampler()
}, async () => {
  return { status: 'ok' }
})
```

### Composable Middleware

Use `withTracing()` to apply consistent configuration across multiple functions:

```typescript
const withUserTracing = withTracing({ serviceName: 'user' })

export const createUser = withUserTracing(async function createUser(email) {
  return { id: '123', email }
})
// Span name: "user.createUser"

export const updateUser = withUserTracing(async function updateUser(id, data) {
  return { id, ...data }
})
// Span name: "user.updateUser"
```

### Handler Instrumentation

Instrument Cloudflare Workers fetch handlers to automatically create HTTP spans:

```typescript
import { trace, createEdgeLogger, instrument } from 'autolemetry-edge'

export interface Env {
  OTLP_ENDPOINT: string
  API_KEY: string
}

const log = createEdgeLogger('my-worker')

export const createUser = trace({
  name: 'user.create',
  attributesFromArgs: ([email]: [string]) => ({ 'user.email': email }),
  attributesFromResult: (user: { id: string }) => ({ 'user.id': user.id })
}, async function createUser(email: string) {
  log.info('Creating user', { email })
  return { id: '123', email }
})

const handler: ExportedHandler<Env> = {
  async fetch(request, env, ctx): Promise<Response> {
    const user = await createUser('test@example.com')
    return Response.json(user)
  }
}

export default instrument(handler, (env: Env) => ({
  exporter: {
    url: env.OTLP_ENDPOINT,
    headers: { 'x-api-key': env.API_KEY }
  },
  service: {
    name: 'my-worker',
    version: '1.0.0'
  }
}))
```

This creates:
- HTTP span with method, URL, and status code
- Nested business logic spans
- Structured logs with trace correlation
- Context propagation across async boundaries
- Span flushing via `ExecutionContext.waitUntil()`

**wrangler.toml:**
```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-10-11"
compatibility_flags = ["nodejs_compat"]
```

**Set secrets:**
```bash
wrangler secret put OTLP_ENDPOINT
wrangler secret put API_KEY
```

### Durable Objects Instrumentation

Instrument Durable Object classes to automatically trace `fetch()` and `alarm()` methods:

```typescript
import { DurableObject } from 'cloudflare:workers'
import { instrumentDO, trace } from 'autolemetry-edge'

export class Counter extends DurableObject<Env> {
  async fetch(request: Request) {
    await this.increment()
    return Response.json({ count: this.count })
  }

  async alarm() {
    await this.reset()
  }

  increment = trace(async function increment(this: Counter) {
    this.count++
    await this.ctx.storage.put('count', this.count)
  })
}

export const CounterDO = instrumentDO(Counter, (env: Env) => ({
  exporter: {
    url: env.OTLP_ENDPOINT,
    headers: { 'x-api-key': env.API_KEY }
  },
  service: { name: 'counter-do', version: '1.0.0' }
}))
```

This creates:
- Spans for `fetch()` with HTTP attributes
- Spans for `alarm()` calls
- Cold start tracking via `faas.coldstart` attribute
- Context propagation from Worker to Durable Object
- Durable Object attributes: `do.id`, `do.id.name`

**wrangler.toml:**
```toml
[[durable_objects.bindings]]
name = "COUNTER"
class_name = "CounterDO"
script_name = "your-worker-name"
```

## Adaptive Sampling

Use tail sampling to reduce telemetry costs while capturing errors and slow requests:

```typescript
import { instrument } from 'autolemetry-edge'
import { createAdaptiveTailSampler, SamplingPresets } from 'autolemetry-edge/sampling'

export default instrument(handler, {
  sampling: {
    tailSampler: SamplingPresets.production()
  }
})
```

Or configure custom sampling:

```typescript
tailSampler: createAdaptiveTailSampler({
  baselineSampleRate: 0.1,
  slowThresholdMs: 1000,
  alwaysSampleErrors: true,
  alwaysSampleSlow: true
})
```

Available samplers:
- `createAdaptiveTailSampler()` - Baseline rate plus errors and slow requests
- `createErrorOnlyTailSampler()` - Only errors
- `createSlowOnlyTailSampler()` - Only slow requests
- `createRandomTailSampler()` - Fixed percentage
- `combineTailSamplers()` - Combine multiple strategies
- `SamplingPresets.production()` - 10% baseline, all errors, slow >1s
- `SamplingPresets.highTraffic()` - 1% baseline, all errors, slow >2s
- `SamplingPresets.debugging()` - 50% baseline, all errors, slow >500ms

## Global Auto-Instrumentation

Automatically trace all `fetch()` calls and cache operations:

```typescript
import { instrument } from 'autolemetry-edge'

export default instrument(handler, {
  instrumentation: {
    instrumentGlobalFetch: true,
    instrumentGlobalCache: true
  }
})
```

### fetch() Instrumentation

All `fetch()` calls are automatically traced:

```typescript
const response = await fetch('https://api.example.com/users')
```

Creates a span with:
- Name: `GET api.example.com`
- Attributes: `http.request.method`, `url.full`, `http.response.status_code`
- Automatic trace context propagation

### Cache API Instrumentation

All cache operations are automatically traced:

```typescript
await caches.default.match(request)  // Span: "Cache default.match" + hit/miss
await caches.default.put(key, value) // Span: "Cache default.put"
await caches.default.delete(key)     // Span: "Cache default.delete"
```

Span attributes: `cache.name`, `cache.operation`, `cache.key`, `cache.hit`

Disable if needed:

```typescript
export default instrument(handler, {
  instrumentation: {
    instrumentGlobalFetch: false,
    instrumentGlobalCache: false
  }
})
```

## Composition Utilities

Compose instrumentation setup functions:

```typescript
import { compose, when, pipe, memoize, retry } from 'autolemetry-edge/compose'
import { instrumentGlobalFetch, instrumentGlobalCache } from 'autolemetry-edge/instrumentation'
```

### Combine Multiple Instrumentations

```typescript
const setupInstrumentation = compose(
  instrumentGlobalFetch,
  instrumentGlobalCache
)

setupInstrumentation({ enabled: true })
```

### Conditional Instrumentation

```typescript
import { when } from 'autolemetry-edge/compose'

const setupFetch = when(
  (env) => env.ENABLE_FETCH_TRACING === 'true',
  instrumentGlobalFetch
)

setupFetch(env)
```

### Pipeline Configuration

```typescript
import { pipe, tap } from 'autolemetry-edge/compose'

const setup = pipe(
  tap((config) => console.log('Initial config:', config)),
  (config) => ({ ...config, tracing: true }),
  (config) => ({ ...config, metrics: true }),
  (config) => initObservability(config)
)

setup({ service: 'my-worker' })
```

### Memoize Expensive Setup

```typescript
import { memoize } from 'autolemetry-edge/compose'

const setup = memoize(() => {
  instrumentGlobalFetch()
  instrumentGlobalCache()
})

setup() // Runs setup
setup() // Uses cached result
```

### Retry on Failure

```typescript
import { retry } from 'autolemetry-edge/compose'

const setupWithRetry = retry(
  async () => {
    await fetch('https://api.example.com/init')
  },
  {
    maxAttempts: 3,
    delayMs: 1000,
    onRetry: (attempt, error) => console.log(`Retry ${attempt}:`, error)
  }
)

await setupWithRetry()
```

Available utilities:
- `compose(...fns)` - Combine setup functions
- `composeAsync(...fns)` - Combine async setup functions
- `pipe(...fns)` - Left-to-right composition
- `when(predicate, fn)` - Conditional execution
- `whenAsync(predicate, fn)` - Async conditional execution
- `tap(fn)` - Side effects in pipes
- `memoize(fn)` - Cache expensive operations
- `retry(fn, options)` - Retry on failure

## Bundle Size

```
Core bundle (index.js):    24.58KB minified
Shared chunk:              15.04KB (included in index.js)
Sampling strategies:       3.40KB (optional, standalone)
Compose utilities:         1.59KB (optional, standalone)
Instrumentation exports:   152B (re-exports only)
Testing utilities:         68B (re-exports only)
──────────────────────────────────────────────────
Total source:              ~6,797 LOC
Main bundle (index.js):    24.58KB minified (~7.5KB gzipped)
With sampling:             +3.40KB (~1KB gzipped)
With compose:              +1.59KB (~0.5KB gzipped)
Full bundle (all):         ~43KB minified (~13KB gzipped)
```

Tree-shakeable exports:
- Core only: `import { trace } from 'autolemetry-edge'` → 24.58KB
- With sampling: `import { SamplingPresets } from 'autolemetry-edge/sampling'` → +3.40KB
- With compose: `import { compose } from 'autolemetry-edge/compose'` → +1.59KB

## API Reference

### Core Exports

- `trace()` - Wrap functions to create spans
- `withTracing()` - Create composable tracing middleware
- `instrument()` - Instrument Cloudflare Workers handlers
- `instrumentDO()` - Instrument Durable Object classes
- `createEdgeLogger()` - Create structured logger with trace correlation
- `getEdgeTraceContext()` - Get current trace context

### Subpath Exports

- `autolemetry-edge/sampling` - Sampling strategies and presets
- `autolemetry-edge/instrumentation` - Global instrumentation utilities
- `autolemetry-edge/compose` - Composition utilities
- `autolemetry-edge/testing` - Testing utilities

## Implementation Details

### Core Components

- WorkerTracer - Lightweight tracer implementation
- SpanImpl - Minimal span implementation
- OTLPExporter - Fetch-based OTLP exporter (~85 LOC)
- AsyncLocalStorageContextManager - Context propagation (~250 LOC)
- WorkerTracerProvider - Tracer provider with registration
- Buffer polyfill - For edge environments

### Logger

Structured JSON logging via `console.log`. Automatically includes `traceId` and `spanId` in log output. Pretty mode available for development. No external dependencies.

### Config System

Environment-based configuration resolution. Per-request config isolation prevents race conditions. Supports parent-based ratio sampling, tail sampling, and custom propagators (defaults to W3C Trace Context).

### Span Processor

- SpanProcessorWithFlush - Trace-level flushing
- TailSamplingSpanProcessor - Adaptive sampling support
- Distributed trace support with correct local root detection
- PostProcessor support for span transformation

## Testing

163 tests covering:
- Unit tests for all core components
- Integration tests for handler instrumentation
- Distributed trace scenarios
- Tail sampling edge cases
- Per-span sampler integration

## License

MIT

