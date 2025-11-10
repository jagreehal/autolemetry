# 🔭 autolemetry

[![npm version](https://img.shields.io/npm/v/autolemetry.svg?label=autolemetry)](https://www.npmjs.com/package/autolemetry)
[![npm adapters](https://img.shields.io/npm/v/autolemetry-adapters.svg?label=adapters)](https://www.npmjs.com/package/autolemetry-adapters)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Write once, observe everywhere.** Instrument your Node.js code a single time, keep the DX you love, and stream traces, metrics, logs, and product analytics to **any** observability stack without vendor lock-in.

- **Drop-in DX** – one `init()` and ergonomic helpers like `trace()`, `span()`, `withTracing()`, decorators, and batch instrumentation.
- **Platform freedom** – OTLP-first design plus adapters for PostHog, Mixpanel, Amplitude, and anything else via custom exporters/readers.
- **Production hardening** – adaptive sampling (10% baseline, 100% errors/slow paths), rate limiting, circuit breakers, payload validation, and automatic sensitive-field redaction.
- **Auto enrichment** – service metadata, deployment info, and AsyncLocalStorage-powered correlation IDs automatically flow into spans, metrics, logs, and analytics events.

> Raw OpenTelemetry is verbose, and vendor SDKs create lock-in. Autolemetry gives you the best parts of both: clean ergonomics **and** total ownership of your telemetry.

## Table of Contents

- [🔭 autolemetry](#-autolemetry)
  - [Table of Contents](#table-of-contents)
  - [Why Autolemetry](#why-autolemetry)
  - [Quick Start](#quick-start)
    - [1. Install](#1-install)
    - [2. Initialize once at startup](#2-initialize-once-at-startup)
    - [3. Instrument code with `trace()`](#3-instrument-code-with-trace)
    - [4. See the value everywhere](#4-see-the-value-everywhere)
  - [Choose Any Destination](#choose-any-destination)
  - [LLM Observability with OpenLLMetry](#llm-observability-with-openllmetry)
    - [Installation](#installation)
    - [Usage](#usage)
  - [Core Building Blocks](#core-building-blocks)
    - [trace()](#trace)
    - [span()](#span)
    - [Trace Context (`ctx`)](#trace-context-ctx)
    - [Reusable Middleware Helpers](#reusable-middleware-helpers)
    - [Decorators (TypeScript 5+)](#decorators-typescript-5)
    - [Database Instrumentation](#database-instrumentation)
  - [Business Metrics \& Product Analytics](#business-metrics--product-analytics)
    - [OpenTelemetry Metrics (Metrics class + helpers)](#opentelemetry-metrics-metrics-class--helpers)
    - [Product Analytics (PostHog, Mixpanel, Amplitude, …)](#product-analytics-posthog-mixpanel-amplitude-)
  - [Logging with Trace Context](#logging-with-trace-context)
  - [Auto Instrumentation \& Advanced Configuration](#auto-instrumentation--advanced-configuration)
  - [Operational Safety \& Runtime Controls](#operational-safety--runtime-controls)
  - [Configuration Reference](#configuration-reference)
  - [Building Custom Instrumentation](#building-custom-instrumentation)
    - [Instrumenting Queue Consumers](#instrumenting-queue-consumers)
    - [Instrumenting Scheduled Jobs / Cron](#instrumenting-scheduled-jobs--cron)
    - [Creating Custom Analytics Adapters](#creating-custom-analytics-adapters)
    - [Low-Level Span Manipulation](#low-level-span-manipulation)
    - [Custom Metrics](#custom-metrics)
  - [API Reference](#api-reference)
  - [FAQ \& Next Steps](#faq--next-steps)

## Why Autolemetry

| Challenge                                                                                      | With autolemetry                                                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Writing raw OpenTelemetry spans/metrics takes dozens of lines and manual lifecycle management. | Wrap any function in `trace()` or `span()` and get automatic span lifecycle, error capture, attributes, and adaptive sampling.       |
| Vendor SDKs simplify setup but trap your data in a single platform.                            | Autolemetry is OTLP-native and works with Grafana Cloud, Datadog, New Relic, Tempo, Honeycomb, Elasticsearch, or your own collector. |
| Teams need both observability **and** product analytics.                                       | Ship technical telemetry and funnel/behavior events through the same API with contextual enrichment.                                 |
| Production readiness requires redaction, rate limiting, and circuit breakers.                  | Those guardrails are on by default so you can safely enable telemetry everywhere.                                                    |

## Quick Start

> Want to follow along in code? This repo ships with `apps/example-basic` (mirrors the steps below) and `apps/example-http` for an Express server, you can run either with `pnpm start` after `pnpm install && pnpm build` at the root.

### 1. Install

```bash
npm install autolemetry
# or
pnpm add autolemetry
```

### 2. Initialize once at startup

```typescript
import { init } from 'autolemetry';

init({
  service: 'checkout-api',
  environment: process.env.NODE_ENV,
});
```

Defaults:

- OTLP endpoint: `process.env.OTLP_ENDPOINT || http://localhost:4318`
- Metrics: on in every environment
- Sampler: adaptive (10% baseline, 100% for errors/slow spans)
- Version: auto-detected from `package.json`
- Analytics auto-flush when the root span finishes

### 3. Instrument code with `trace()`

```typescript
import { trace } from 'autolemetry';

export const createUser = trace(async function createUser(
  data: CreateUserData,
) {
  const user = await db.users.insert(data);
  return user;
});
```

- Named function expressions automatically become span names (`code.function`).
- Errors are recorded, spans are ended, and status is set automatically.

### 4. See the value everywhere

```typescript
import { init, track } from 'autolemetry';

init({
  service: 'checkout-api',
  endpoint: 'https://otlp-gateway-prod.grafana.net/otlp',
  adapters: [new PostHogAdapter({ apiKey: process.env.POSTHOG_KEY! })],
});

export const processOrder = trace(async function processOrder(order) {
  track('order.completed', { amount: order.total });
  return charge(order);
});
```

Every span, metric, log line, and analytics event includes `traceId`, `spanId`, `operation.name`, `service.version`, and `deployment.environment` automatically.

## Choose Any Destination

```typescript
import { init } from 'autolemetry';

init({
  service: 'my-app',
  // Grafana / Tempo / OTLP collector
  endpoint: 'https://otlp-gateway-prod.grafana.net/otlp',
});

init({
  service: 'my-app',
  // Datadog (traces + metrics + logs via OTLP)
  endpoint: 'https://http-intake.logs.datadoghq.com/api/v2/otlp',
  otlpHeaders: 'DD-API-KEY=...',
});

init({
  service: 'my-app',
  // Custom pipeline with your own exporters/readers
  spanProcessor: new BatchSpanProcessor(
    new JaegerExporter({ endpoint: 'http://otel:14268/api/traces' }),
  ),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'https://metrics.example.com/v1/metrics',
    }),
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: 'https://logs.example.com/v1/logs' }),
    ),
  ],
  instrumentations: [new HttpInstrumentation()],
});

init({
  service: 'my-app',
  // Product analytics adapters (ship alongside OTLP)
  adapters: [
    new PostHogAdapter({ apiKey: process.env.POSTHOG_KEY! }),
    new MixpanelAdapter({ projectToken: process.env.MIXPANEL_TOKEN! }),
  ],
});

init({
  service: 'my-app',
  // OpenLLMetry integration for LLM observability
  openllmetry: {
    enabled: true,
    options: {
      disableBatch: process.env.NODE_ENV !== 'production',
      apiKey: process.env.TRACELOOP_API_KEY,
    },
  },
});
```

Autolemetry never owns your data, it's a thin layer over OpenTelemetry with optional adapters.

## LLM Observability with OpenLLMetry

Autolemetry integrates seamlessly with [OpenLLMetry](https://github.com/traceloop/openllmetry) to provide comprehensive observability for LLM applications. OpenLLMetry automatically instruments LLM providers (OpenAI, Anthropic, etc.), vector databases, and frameworks (LangChain, LlamaIndex, etc.).

### Installation

Install the OpenLLMetry SDK as an optional peer dependency:

```bash
pnpm add @traceloop/node-server-sdk
# or
npm install @traceloop/node-server-sdk
```

### Usage

Enable OpenLLMetry in your autolemetry configuration:

```typescript
import { init } from 'autolemetry';

init({
  service: 'my-llm-app',
  endpoint: process.env.OTLP_ENDPOINT,
  openllmetry: {
    enabled: true,
    options: {
      // Disable batching in development for immediate traces
      disableBatch: process.env.NODE_ENV !== 'production',
      // Optional: Traceloop API key if using Traceloop backend
      apiKey: process.env.TRACELOOP_API_KEY,
    },
  },
});
```

OpenLLMetry will automatically:

- Instrument LLM calls (OpenAI, Anthropic, Cohere, etc.)
- Track vector database operations (Pinecone, Chroma, Qdrant, etc.)
- Monitor LLM frameworks (LangChain, LlamaIndex, LangGraph, etc.)
- Reuse autolemetry's OpenTelemetry tracer provider for unified traces

All LLM spans will appear alongside your application traces in your observability backend.

**AI Workflow Patterns:** See [AI/LLM Workflow Documentation](../../docs/AI_WORKFLOWS.md) for comprehensive patterns including:

- Multi-agent workflows (orchestration and handoffs)
- RAG pipelines (embeddings, search, generation)
- Streaming responses
- Evaluation loops
- Working examples in `apps/example-ai-agent`

## Core Building Blocks

### trace()

Wrap any sync/async function to create spans automatically.

```typescript
import { trace } from 'autolemetry';

export const updateUser = trace(async function updateUser(
  id: string,
  data: UserInput,
) {
  return db.users.update(id, data);
});

// Explicit name (useful for anonymous/arrow functions)
export const deleteUser = trace('user.delete', async (id: string) => {
  return db.users.delete(id);
});

// Factory form exposes the `ctx` helper (see below)
export const createOrder = trace((ctx) => async (order: Order) => {
  ctx.setAttribute('order.id', order.id);
  return submit(order);
});

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

- Automatic span lifecycle (`start`, `end`, status, and error recording).
- Function names feed `operation.name`, `code.function`, and analytics enrichment.
- Works with promises, async/await, or sync functions.

### span()

Create nested spans for individual code blocks without wrapping entire functions.

```typescript
import { span, trace } from 'autolemetry';

export const rollDice = trace(async function rollDice(rolls: number) {
  const results: number[] = [];

  for (let i = 0; i < rolls; i++) {
    await span(
      { name: 'roll.once', attributes: { roll: i + 1 } },
      async (span) => {
        span.setAttribute('range', '1-6');
        results.push(rollOnce());
      },
    );
  }

  return results;
});
```

Nested spans automatically inherit context and correlation IDs.

### Trace Context (`ctx`)

Every `trace((ctx) => ...)` factory receives a type-safe helper backed by `AsyncLocalStorage`.

```typescript
export const createUser = trace((ctx) => async (input: CreateUserData) => {
  logger.info('Handling request', { traceId: ctx.traceId });
  ctx.setAttributes({ 'user.id': input.id, 'user.plan': input.plan });

  try {
    const user = await db.users.create(input);
    ctx.setStatus({ code: SpanStatusCode.OK });
    return user;
  } catch (error) {
    ctx.recordException(error as Error);
    ctx.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Failed to create user',
    });
    throw error;
  }
});
```

Available helpers: `traceId`, `spanId`, `correlationId`, `setAttribute`, `setAttributes`, `setStatus`, `recordException`.

### Reusable Middleware Helpers

- `withTracing(options)` – create a preconfigured wrapper (service name, default attributes, skip rules).
- `instrument(object, options)` – batch-wrap entire modules while skipping helpers or private functions.

```typescript
import { withTracing, instrument } from 'autolemetry';

const traceFn = withTracing({ serviceName: 'user' });

export const create = traceFn((ctx) => async (payload) => {
  /* ... */
});
export const update = traceFn((ctx) => async (id, payload) => {
  /* ... */
});

export const repository = instrument(
  {
    createUser: async () => {
      /* ... */
    },
    updateUser: async () => {
      /* ... */
    },
    _internal: async () => {
      /* skipped */
    },
  },
  { serviceName: 'repository', skip: ['_internal'] },
);
```

### Decorators (TypeScript 5+)

Prefer classes or NestJS-style services? Use the `@Trace` decorator.

```typescript
import { Trace } from 'autolemetry/decorators';

class OrderService {
  @Trace('order.create', { withMetrics: true })
  async createOrder(data: OrderInput) {
    return db.orders.create(data);
  }

  // No arguments → method name becomes the span name
  @Trace()
  async processPayment(orderId: string) {
    return charge(orderId);
  }

  @Trace()
  async refund(orderId: string) {
    const ctx = (this as any).ctx;
    ctx.setAttribute('order.id', orderId);
    return refund(orderId);
  }
}
```

Decorators are optional, everything also works in plain functions.

### Database Instrumentation

Turn on query tracing in one line.

```typescript
import { instrumentDatabase } from 'autolemetry';

const db = drizzle(pool);

instrumentDatabase(db, {
  dbSystem: 'postgresql',
  dbName: 'myapp',
});

await db.select().from(users); // queries emit spans automatically
```

## Business Metrics & Product Analytics

Autolemetry treats metrics and analytics as first-class citizens so engineers and product teams share the same context.

### OpenTelemetry Metrics (Metrics class + helpers)

```typescript
import { Metrics, createHistogram } from 'autolemetry';

const metrics = new Metrics('checkout');
const revenue = createHistogram('checkout.revenue');

export const processOrder = trace((ctx) => async (order) => {
  metrics.trackEvent('order.completed', {
    orderId: order.id,
    amount: order.total,
  });
  metrics.trackValue('revenue', order.total, { currency: order.currency });
  revenue.record(order.total, { currency: order.currency });
});
```

- Emits OpenTelemetry counters/histograms via the OTLP endpoint configured in `init()`.
- Infrastructure metrics are enabled by default in **every** environment.

### Product Analytics (PostHog, Mixpanel, Amplitude, …)

```typescript
import { Analytics, track } from 'autolemetry';
import { PostHogAdapter } from 'autolemetry-adapters';

const analytics = new Analytics('checkout', {
  adapters: [new PostHogAdapter({ apiKey: process.env.POSTHOG_KEY! })],
});

export const signup = trace('user.signup', async (user) => {
  analytics.trackEvent('user.signup', { userId: user.id, plan: user.plan });
  analytics.trackFunnelStep('checkout', 'completed', {
    cartValue: user.cartTotal,
  });
  analytics.trackValue('lifetimeValue', user.cartTotal, { currency: 'USD' });
  analytics.trackOutcome('user.signup', 'success', { cohort: user.cohort });

  track('user.signup.global', { userId: user.id }); // global helper shares the same enrichment
});
```

Auto-enrichment adds `traceId`, `spanId`, `correlationId`, `operation.name`, `service.version`, and `deployment.environment` to every analytics payload without manual wiring.

## Logging with Trace Context

Structured logs use the same context as traces.

```typescript
import { createLogger, init, trace } from 'autolemetry';

const logger = createLogger('user-service', {
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

init({ service: 'user-service', logger });

export const createUser = trace(async (data: UserData) => {
  logger.info('Creating user', { userId: data.id });
  try {
    const user = await db.users.create(data);
    logger.info('User created', { userId: user.id });
    return user;
  } catch (error) {
    logger.error('Create failed', error as Error, { userId: data.id });
    throw error;
  }
});
```

- Logs automatically include `traceId`, `spanId`, and `correlationId`.
- Send logs through OTLP via `logRecordProcessors` or forward them anywhere with adapter support.

## Auto Instrumentation & Advanced Configuration

- `integrations` – Enable OpenTelemetry auto-instrumentations (HTTP, Express, Fastify, Prisma, Pino…). Requires `@opentelemetry/auto-instrumentations-node`.
- `instrumentations` – Provide manual instrumentation instances, e.g., `new HttpInstrumentation()`.
- `resource` / `resourceAttributes` – Declare cluster/region/tenant metadata once and it flows everywhere.
- `spanProcessor`, `metricReader`, `logRecordProcessors` – Plug in any OpenTelemetry exporter or your in-house pipeline.
- `otlpHeaders` – Attach vendor auth headers when using the built-in OTLP HTTP exporters.
- `sdkFactory` – Receive the Autolemetry defaults and return a fully customized `NodeSDK` for the rare cases you need complete control.

```typescript
import { init } from 'autolemetry';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

init({
  service: 'checkout',
  environment: 'production',
  resourceAttributes: {
    'cloud.region': 'us-east-1',
    'deployment.environment': 'production',
  },
  integrations: ['http', 'express', 'pino'],
  instrumentations: [new HttpInstrumentation()],
  otlpHeaders: 'Authorization=Basic ...',
  adapters: [new PostHogAdapter({ apiKey: 'phc_xxx' })],
});
```

## Operational Safety & Runtime Controls

- **Adaptive sampling** – 10% baseline, 100% for errors/slow spans by default (override via `sampler`).
- **Rate limiting & circuit breakers** – Prevent telemetry storms when backends misbehave.
- **Validation** – Configurable attribute/event name lengths, maximum counts, and nesting depth.
- **Sensitive data redaction** – Passwords, tokens, API keys, and any custom regex you provide are automatically masked before export.
- **Auto-flush** – Analytics buffers drain when root spans end (disable with `autoFlush: false`).
- **Runtime flags** – Toggle metrics or swap endpoints via env vars without code edits.

```bash
# Disable metrics without touching code (metrics are ON by default)
AUTOTELEMETRY_METRICS=off node server.js

# Point at a different collector
OTLP_ENDPOINT=https://otel.mycompany.com node server.js
```

## Configuration Reference

```typescript
init({
  service: string; // required
  adapters?: AnalyticsAdapter[];
  endpoint?: string;
  metrics?: boolean | 'auto';
  sampler?: Sampler;
  version?: string;
  environment?: string;
  autoFlush?: boolean;
  integrations?: string[] | boolean | Record<string, { enabled?: boolean }>;
  instrumentations?: NodeSDKConfiguration['instrumentations'];
  spanProcessor?: SpanProcessor;
  metricReader?: MetricReader;
  logRecordProcessors?: LogRecordProcessor[];
  resource?: Resource;
  resourceAttributes?: Record<string, string>;
  otlpHeaders?: string;
  sdkFactory?: (defaults: NodeSDK) => NodeSDK;
  validation?: Partial<ValidationConfig>;
  logger?: Logger; // created via createLogger() or bring your own
  openllmetry?: {
    enabled: boolean;
    options?: Record<string, unknown>; // Passed to @traceloop/node-server-sdk
  };
});
```

Validation tuning example:

```typescript
init({
  service: 'checkout',
  validation: {
    sensitivePatterns: [/password/i, /secret/i, /creditCard/i],
    maxAttributeValueLength: 5_000,
    maxAttributeCount: 100,
    maxNestingDepth: 5,
  },
});
```

## Building Custom Instrumentation

Autolemetry is designed as an **enabler** - it provides composable primitives that let you instrument anything in your codebase. Here's how to use the building blocks to create custom instrumentation for queues, cron jobs, and other patterns.

### Instrumenting Queue Consumers

```typescript
import { trace, span, track } from 'autolemetry';

// Wrap your consumer handler with trace()
export const processMessage = trace(async function processMessage(
  message: Message,
) {
  // Use span() to break down processing stages
  await span({ name: 'parse.message' }, async (ctx) => {
    ctx.setAttribute('message.id', message.id);
    ctx.setAttribute('message.type', message.type);
    return parseMessage(message);
  });

  await span({ name: 'validate.message' }, async () => {
    return validateMessage(message);
  });

  await span({ name: 'process.business.logic' }, async () => {
    return handleMessage(message);
  });

  // Track analytics events
  track('message.processed', {
    messageType: message.type,
    processingTime: Date.now() - message.timestamp,
  });
});

// Use in your queue consumer
consumer.on('message', async (msg) => {
  await processMessage(msg);
});
```

### Instrumenting Scheduled Jobs / Cron

```typescript
import { trace, getMetrics } from 'autolemetry';

export const dailyReportJob = trace(async function dailyReportJob() {
  const metrics = getMetrics();
  const startTime = Date.now();

  try {
    const report = await generateReport();

    // Record success metrics
    metrics.recordHistogram('job.duration', Date.now() - startTime, {
      job_name: 'daily_report',
      status: 'success',
    });

    return report;
  } catch (error) {
    // Record failure metrics
    metrics.recordHistogram('job.duration', Date.now() - startTime, {
      job_name: 'daily_report',
      status: 'error',
    });
    throw error;
  }
});

// Schedule with your preferred library
cron.schedule('0 0 * * *', () => dailyReportJob());
```

### Creating Custom Analytics Adapters

Implement the `AnalyticsAdapter` interface to send events to any analytics platform:

```typescript
import { type AnalyticsAdapter, type EventAttributes } from 'autolemetry';

export class CustomAnalyticsAdapter implements AnalyticsAdapter {
  constructor(private config: { apiKey: string; endpoint: string }) {}

  async track(
    eventName: string,
    attributes: EventAttributes,
    timestamp: Date,
  ): Promise<void> {
    await fetch(this.config.endpoint, {
      method: 'POST',
      headers: { 'X-API-Key': this.config.apiKey },
      body: JSON.stringify({
        event: eventName,
        properties: attributes,
        timestamp,
      }),
    });
  }

  async identify(userId: string, traits: EventAttributes): Promise<void> {
    // Implement user identification
  }

  async flush(): Promise<void> {
    // Implement flush if buffering
  }
}

// Use it in init()
init({
  service: 'my-app',
  adapters: [new CustomAnalyticsAdapter({ apiKey: '...', endpoint: '...' })],
});
```

### Low-Level Span Manipulation

For maximum control, use the `ctx` proxy or direct OpenTelemetry APIs:

```typescript
import { ctx, otelTrace, context } from 'autolemetry';

export async function customWorkflow() {
  // Access current trace context anywhere (via AsyncLocalStorage)
  console.log('Current trace:', ctx.traceId);
  ctx.setAttribute('workflow.step', 'start');

  // Or use OpenTelemetry APIs directly
  const tracer = otelTrace.getTracer('my-custom-tracer');
  const span = tracer.startSpan('custom.operation');

  try {
    // Your logic here
    span.setAttribute('custom.attribute', 'value');
    span.setStatus({ code: SpanStatusCode.OK });
  } finally {
    span.end();
  }
}
```

### Custom Metrics

Create custom business metrics using the meter helpers:

```typescript
import { getMeter, createCounter, createHistogram } from 'autolemetry';

// Create custom metrics
const requestCounter = createCounter('http.requests.total', {
  description: 'Total HTTP requests',
});

const responseTimeHistogram = createHistogram('http.response.time', {
  description: 'HTTP response time in milliseconds',
  unit: 'ms',
});

export async function handleRequest(req: Request) {
  const startTime = Date.now();

  requestCounter.add(1, { method: req.method, path: req.path });

  const response = await processRequest(req);

  responseTimeHistogram.record(Date.now() - startTime, {
    method: req.method,
    status: response.status,
  });

  return response;
}
```

**Key Principle:** All these primitives work together - spans automatically capture context, metrics and analytics events inherit trace IDs, and everything flows through the same configured exporters and adapters. Build what you need, when you need it.

## API Reference

- `init(config)` – Bootstraps the SDK (call once).
- `trace(fn | name, fn)` – Wraps functions with spans and optional context access.
- `span(options, fn)` – Creates nested spans for ad-hoc blocks.
- `withTracing(options)` – Produces reusable wrappers with shared configuration.
- `instrument(target, options)` – Batch-wraps an object of functions.
- `Trace` decorator – Adds tracing to class methods (TypeScript 5+).
- `instrumentDatabase(db, options)` – Adds automatic DB spans (Drizzle, etc.).
- `Metrics` class & helpers (`createHistogram`, etc.) – Emit OpenTelemetry metrics.
- `Analytics` class & `track()` helper – Send product analytics events/funnels/outcomes/values via adapters.
- `createLogger(name, options)` – Build a logger that automatically includes trace context.
- `PostHogAdapter`, `MixpanelAdapter`, … – Provided in `autolemetry-adapters`; create your own by implementing the `AnalyticsAdapter` interface.

Each API is type-safe, works in both ESM and CJS, and is designed to minimize boilerplate while staying close to OpenTelemetry primitives.

## FAQ & Next Steps

- **Do I need to abandon my current tooling?** No. Autolemetry layers on top of OpenTelemetry and forwards to whatever you already use (Datadog, Grafana, Tempo, Honeycomb, etc.).
- **Is this just for traces?** No. Spans, metrics, logs, and analytics all share the same context and exporters.
- **Can I customize everything?** Yes. Override exporters, readers, resources, validation, or even the full NodeSDK via `sdkFactory`.
- **Does it work in production?** Yes. Adaptive sampling, redaction, validation, rate limiting, and circuit breakers are enabled out of the box.
- **What about frameworks?** Use decorators, `withTracing()`, or `instrument()` for NestJS, Fastify, Express, Next.js actions, queues, workers, anything in Node.js.

**Next steps:**

1. `npm install autolemetry` and call `init()` at startup.
2. Wrap your critical paths with `trace()` (or `Trace` decorators if you prefer classes).
3. Point the OTLP endpoint at your favorite observability backend and optionally add analytics adapters.
4. Expand coverage with `instrumentDatabase()`, `withTracing()`, metrics, logging, and auto-instrumentations.

Happy observing!
