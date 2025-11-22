# autolemetry-web

Ultra-lightweight browser SDK for distributed tracing (**1.6KB gzipped**)

**Purpose:** Enable distributed tracing between browser and backend applications. The browser propagates W3C `traceparent` headers, and your backend (using [Autolemetry](../autolemetry)) automatically continues the trace.

**Core Philosophy:** The backend does all the real tracing — timing, spans, errors, export — while the browser only propagates the trace context via headers.

**No OpenTelemetry dependencies. No exporters. No collectors. No CORS. Just header injection.**

```
┌─────────┐  traceparent   ┌─────────┐   spans    ┌───────────┐
│ Browser │  ----------->  │ Backend │  ------->  │ Collector │
│  1.6KB  │    header      │ (OTel)  │   export   │ (Datadog) │
└─────────┘                └─────────┘            └───────────┘
```

## Features

✅ **Tiny bundle** - **1.6KB gzipped** (33x smaller than full OTel browser SDK)
✅ **Zero dependencies** - No `@opentelemetry/*` packages needed
✅ **W3C trace propagation** - Automatic `traceparent` header injection on fetch/XHR
✅ **SSR-safe** - Works with Next.js, Remix, and other SSR frameworks
✅ **Framework-agnostic** - Works with React, Vue, Svelte, Angular, vanilla JS
✅ **No real spans** - Browser just propagates context, backend does real tracing

## Installation

```bash
npm install autolemetry-web
# or
pnpm add autolemetry-web
# or
yarn add autolemetry-web
```

**Important:** You do NOT need to install any `@opentelemetry/*` packages. This package has **zero dependencies**.

## Quick Start

### 1. Initialize in Browser

```typescript
import { init } from 'autolemetry-web'

// Call once, client-side only
init({ service: 'my-frontend-app' })

// That's it! All fetch/XHR calls now include traceparent headers
fetch('/api/users')  // <-- traceparent header automatically injected!
```

### 2. Backend Receives Trace

Your backend using Autolemetry automatically extracts the `traceparent` header and continues the trace:

```typescript
// Backend (Express + Autolemetry)
import { init, trace } from 'autolemetry'

init({
  service: 'my-api',
  endpoint: 'http://localhost:4318'  // Your OTel collector
})

app.get('/api/users', async (req, res) => {
  // Autolemetry automatically extracts traceparent from req.headers
  // and creates a child span
  const users = await trace(async () => {
    return db.users.findAll()
  })()

  res.json(users)
})
```

### 3. View Distributed Trace

Open your observability platform (Honeycomb, Datadog, Jaeger, etc.) and see the complete trace from browser → backend → database!

## Framework Integration

### React (Client-Only)

```typescript
// src/App.tsx
import { useEffect } from 'react'
import { init } from 'autolemetry-web'

function App() {
  useEffect(() => {
    init({ service: 'my-react-app' })
  }, [])

  return <div>Your app</div>
}
```

### Next.js App Router (SSR-Safe)

```typescript
// app/telemetry-init.tsx (Client Component)
'use client'

import { useEffect } from 'react'
import { init } from 'autolemetry-web'

export function TelemetryInit() {
  useEffect(() => {
    init({ service: 'my-nextjs-app' })
  }, [])

  return null
}

// app/layout.tsx
import { TelemetryInit } from './telemetry-init'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TelemetryInit />
        {children}
      </body>
    </html>
  )
}
```

### Next.js Pages Router

```typescript
// pages/_app.tsx
import { useEffect } from 'react'
import { init } from 'autolemetry-web'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    init({ service: 'my-nextjs-app' })
  }, [])

  return <Component {...pageProps} />
}
```

### Remix

```typescript
// app/entry.client.tsx
import { RemixBrowser } from '@remix-run/react'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { init } from 'autolemetry-web'

// Initialize before hydration
init({ service: 'my-remix-app' })

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  )
})
```

### Vue

```typescript
// src/main.ts
import { createApp } from 'vue'
import { init } from 'autolemetry-web'
import App from './App.vue'

init({ service: 'my-vue-app' })

createApp(App).mount('#app')
```

### Vanilla JavaScript

```html
<!-- index.html -->
<script type="module">
  import { init } from 'autolemetry-web'

  init({ service: 'my-vanilla-app' })

  // Now all fetch calls include traceparent headers
  fetch('/api/data')
    .then(res => res.json())
    .then(data => console.log(data))
</script>
```

## W3C Trace Context Propagation

autolemetry-web **implements the W3C Trace Context format directly**, without pulling in the OpenTelemetry propagator. It generates and injects `traceparent` headers on all outgoing HTTP requests using native browser APIs (`crypto.getRandomValues()`).

### Header Format

```
traceparent: 00-{trace-id}-{span-id}-{trace-flags}
```

**Example:**
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

- `00` - Version
- `4bf92f3577b34da6a3ce929d0e0e4736` - Trace ID (128-bit hex)
- `00f067aa0ba902b7` - Span ID (64-bit hex)
- `01` - Trace flags (sampled=1)

### Verification

You can verify the header is being sent using browser DevTools:

1. Open DevTools → Network tab
2. Make a fetch/XHR request
3. Check Request Headers
4. Look for `traceparent` header

## Backend Integration

### Automatic Extraction (Express)

Autolemetry automatically extracts `traceparent` from incoming requests:

```typescript
import express from 'express'
import { init, trace } from 'autolemetry'

init({
  service: 'my-api',
  endpoint: 'http://localhost:4318'
})

const app = express()

app.get('/api/users/:id', async (req, res) => {
  // Parent context is automatically extracted from req.headers.traceparent
  const user = await trace(async () => {
    return db.users.findById(req.params.id)
  })()

  res.json(user)
})
```

### Manual Extraction (Next.js API Routes)

For frameworks where automatic extraction doesn't work, use `extractTraceContext`:

```typescript
// app/api/users/route.ts (Next.js App Router)
import { init } from 'autolemetry'
import { context, trace as otelTrace } from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

init({ service: 'my-api', endpoint: 'http://localhost:4318' })

const propagator = new W3CTraceContextPropagator()

export async function GET(request: Request) {
  // Extract parent context from headers
  const parentContext = propagator.extract(
    context.active(),
    request.headers,
    {
      get: (headers, key) => headers.get(key) ?? undefined,
      keys: (headers) => Array.from(headers.keys()),
    }
  )

  // Run in extracted context
  return context.with(parentContext, async () => {
    const tracer = otelTrace.getTracer('my-api')

    return tracer.startActiveSpan('fetchUsers', async (span) => {
      try {
        const users = await db.users.findAll()
        span.end()
        return Response.json(users)
      } catch (error) {
        span.recordException(error)
        span.end()
        throw error
      }
    })
  })
}
```

## API Reference

### `init(config)`

Initialize the browser SDK. Call once, client-side only.

```typescript
interface AutolemetryWebConfig {
  /** Service name for the browser application */
  service: string

  /** Service version (optional, default: '1.0.0') */
  version?: string

  /** Additional resource attributes */
  resourceAttributes?: {
    'deployment.environment'?: string
    'team'?: string
    [key: string]: string | number | boolean | undefined
  }

  /** Enable fetch instrumentation (default: true) */
  instrumentFetch?: boolean

  /** Enable XMLHttpRequest instrumentation (default: true) */
  instrumentXHR?: boolean

  /** Enable debug logging (default: false) */
  debug?: boolean
}
```

**Example:**

```typescript
init({
  service: 'my-spa',
  version: '2.1.0',
  resourceAttributes: {
    'deployment.environment': 'production',
    'team': 'frontend'
  },
  debug: false
})
```

### `trace(fn)` and `trace(ctx => fn)`

Wrap functions with automatic tracing.

**Direct Pattern (no context access):**

```typescript
import { trace } from 'autolemetry-web'

export const fetchUser = trace(async (id: string) => {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
})

// Usage
const user = await fetchUser('123')
```

**Factory Pattern (with context access):**

```typescript
export const fetchUser = trace(ctx => async (id: string) => {
  ctx.setAttribute('user.id', id)

  const response = await fetch(`/api/users/${id}`)
  const user = await response.json()

  ctx.setAttribute('user.email', user.email)
  return user
})

// Usage
const user = await fetchUser('123')
```

### `span(name, fn)`

Create a manual span for a block of code:

```typescript
import { span } from 'autolemetry-web'

const result = await span('processData', async (ctx) => {
  ctx.setAttribute('data.size', data.length)
  return await processData(data)
})
```

### `getActiveContext()`

Get the current active trace context:

```typescript
import { getActiveContext } from 'autolemetry-web'

const ctx = getActiveContext()
if (ctx) {
  console.log('Trace ID:', ctx.traceId)
  console.log('Span ID:', ctx.spanId)
}
```

## Using with Other SDKs

### Sentry

autolemetry-web and Sentry can coexist. Both will instrument fetch/XHR.

**Recommendation:** Initialize Sentry first, then autolemetry-web.

```typescript
import * as Sentry from '@sentry/browser'
import { init } from 'autolemetry-web'

// 1. Initialize Sentry first
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  tracesSampleRate: 1.0,
})

// 2. Then initialize autolemetry-web
init({ service: 'my-app' })
```

Sentry's instrumentation typically preserves existing `traceparent` headers, so both should work together.

### Datadog RUM

Similar to Sentry, initialize Datadog RUM first:

```typescript
import { datadogRum } from '@datadog/browser-rum'
import { init } from 'autolemetry-web'

// 1. Initialize Datadog RUM first
datadogRum.init({
  applicationId: 'YOUR_APP_ID',
  clientToken: 'YOUR_CLIENT_TOKEN',
  site: 'datadoghq.com',
  service: 'my-app',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
})

// 2. Then initialize autolemetry-web
init({ service: 'my-app' })
```

### Conflicts

If you experience conflicts (e.g., duplicate instrumentation or missing headers):

**Option 1:** Choose one SDK for distributed tracing
- For full RUM (errors, session replay, performance): Use vendor SDK only
- For distributed tracing only: Use autolemetry-web only

**Option 2:** Disable fetch/XHR instrumentation in autolemetry-web:

```typescript
init({
  service: 'my-app',
  instrumentFetch: false,
  instrumentXHR: false
})
```

Then manually inject `traceparent` headers:

```typescript
import { getActiveContext } from 'autolemetry-web'

const ctx = getActiveContext()
if (ctx) {
  fetch('/api/data', {
    headers: {
      traceparent: `00-${ctx.traceId}-${ctx.spanId}-01`
    }
  })
}
```

## SSR Safety

autolemetry-web is **SSR-safe** by design. All browser APIs (WebTracerProvider, ZoneContextManager) are accessed inside `init()`, not at module load time.

### Safe: ✅

```typescript
// ✅ Safe: init() called in useEffect (client-side only)
useEffect(() => {
  init({ service: 'my-app' })
}, [])

// ✅ Safe: init() called in entry.client.tsx (Remix)
init({ service: 'my-app' })

// ✅ Safe: init() called in 'use client' component (Next.js)
'use client'
init({ service: 'my-app' })
```

### Unsafe: ❌

```typescript
// ❌ Unsafe: init() at module top-level
import { init } from 'autolemetry-web'
init({ service: 'my-app' })  // This runs during SSR!
export default function MyComponent() { ... }
```

## Bundle Size

- **Unminified:** 5.05KB
- **Gzipped:** **1.6KB** 🎉
- **Brotli:** ~1.4KB (typical)

**Zero dependencies.** No `@opentelemetry/*` packages. Just pure JavaScript using native `crypto.getRandomValues()`.

## Architecture: Header-Only Approach

autolemetry-web takes a **minimalist approach** to browser tracing:

### What it DOES:
✅ Generates W3C `traceparent` headers (`00-{traceId}-{spanId}-01`)
✅ Automatically injects headers on fetch/XHR calls
✅ Provides a nice DX with `trace()` wrappers

### What it DOESN'T do:
❌ Create real spans in the browser
❌ Measure timing/duration
❌ Export to collectors
❌ Use OpenTelemetry SDKs

### Why?

The browser's job is **trace propagation only**. Your backend (using Autolemetry) receives the `traceparent` header and creates the real spans with timing, errors, and full context.

This approach:
- Keeps bundle size tiny (1.6KB vs 55KB for full OTel)
- Avoids CORS issues (no exporter endpoints)
- Eliminates Zone.js conflicts (Angular, etc.)
- Simplifies maintenance (no OTel version updates)

The backend does all the real work, which is where you want detailed telemetry anyway!

## Why Not Use OpenTelemetry in the Browser?

The official OpenTelemetry browser SDK (`@opentelemetry/sdk-trace-web`) is a **full-featured tracing implementation** with:
- Real span creation and lifecycle management
- Context propagation via Zone.js (~15KB)
- Span processors and exporters
- Automatic instrumentations
- **Result: ~55KB gzipped**

### When to Use Full OTel Browser SDK

✅ You need to **export spans directly from the browser** to a collector
✅ You need **client-side performance timing** (Core Web Vitals, resource timing)
✅ You're building a **monitoring/observability product** that requires browser-side analysis
✅ You need **detailed client-side error tracking** with full span context

### When to Use autolemetry-web (This Package)

✅ You only need **trace correlation** between frontend and backend
✅ Your backend **already exports to a collector** (OTLP, Datadog, etc.)
✅ You want **minimal bundle size impact** (~1.6KB vs ~55KB)
✅ You want to **avoid Zone.js** (conflicts with Angular, adds complexity)
✅ You prefer **zero dependencies** and simpler maintenance

**Bottom Line:** If your backend already does tracing, you don't need full OpenTelemetry in the browser. Just propagate the trace context with autolemetry-web.

## Performance Impact

autolemetry-web has **effectively zero performance overhead**:

✅ **No promise wrapping** - Your async code runs unchanged
✅ **No timer patching** - setTimeout/setInterval work normally
✅ **No Zone.js** - No global async context tracking
✅ **No span objects** - No memory allocation for browser spans
✅ **Header-only** - Just adds one HTTP header per request

**What it does:**
- Patches `window.fetch` and `XMLHttpRequest.prototype.open` at initialization
- Generates a 32-byte header value using `crypto.getRandomValues()`
- Adds the header to outgoing requests

**Benchmark:**
- Header generation: ~0.01ms
- Network overhead: +45 bytes per request (traceparent header)
- Memory: ~2KB for the SDK code

**Real-world impact:** Imperceptible. The network request itself takes orders of magnitude longer than the header injection.

## Examples

See the `apps/` directory at the repository root for complete working examples:

- **example-web-vanilla** - Simple HTML + script tag example showing traceparent header injection

More examples coming soon:
- React + Vite - Client-side React app
- Next.js - App Router with SSR
- Remix - Full-stack Remix app
- Vue - Vue 3 application

## Troubleshooting

### Headers not appearing

1. Check that `init()` was called:
```typescript
init({ service: 'my-app', debug: true })  // Enable debug logging
```

2. Verify in DevTools:
   - Open Network tab
   - Click on a request
   - Check "Request Headers" for `traceparent`

3. Ensure fetch/XHR instrumentation is enabled:
```typescript
init({
  service: 'my-app',
  instrumentFetch: true,  // default: true
  instrumentXHR: true,    // default: true
})
```

### Backend not receiving context

1. Check that backend is using Autolemetry or OpenTelemetry
2. Verify CORS headers allow `traceparent`:
```javascript
// Express CORS config
app.use(cors({
  exposedHeaders: ['traceparent', 'tracestate']
}))
```

3. For custom frameworks, manually extract context (see "Backend Integration" above)

### TypeScript errors

Ensure you're using TypeScript 5.0+ and have `@types/node` installed:

```bash
pnpm add -D typescript@^5.0.0 @types/node
```

## License

MIT © Jag Reehal

## Related Packages

- [autolemetry](../autolemetry) - Node.js OpenTelemetry SDK
- [autolemetry-edge](../autolemetry-edge) - Edge runtime SDK (Cloudflare Workers, Vercel Edge)
- [autolemetry-subscribers](../autolemetry-subscribers) - Event subscribers (PostHog, Mixpanel, etc.)

---

**Questions?** Open an issue at [github.com/jagreehal/autolemetry](https://github.com/jagreehal/autolemetry/issues)
