# autolemetry-adapters

**Send analytics to multiple platforms**

Adapters for [autolemetry](https://github.com/jagreehal/autolemetry) to send analytics to PostHog, Mixpanel, Amplitude, Segment, and custom webhooks.

## Why Use This?

**Track once, send everywhere:**
- Primary metrics → **OpenTelemetry** (infrastructure monitoring)
- Product analytics → **PostHog / Mixpanel / Amplitude**
- Customer data → **Segment**
- Custom integrations → **Webhooks** (Zapier, Make.com, etc.)

**Zero overhead when not used:**
Adapters are optional. If you don't use them, they're tree-shaken out (0 bytes).

---

## Building Custom Adapters

Two base classes available:

### `AnalyticsAdapter` - Standard Base Class

Use for most custom adapters. Provides production-ready features:

- Error handling (automatic catching + custom handlers)
- Pending request tracking (ensures delivery during shutdown)
- Graceful shutdown (drains pending requests)
- Enable/disable control (runtime toggle)

**When to use:** Any custom adapter (HTTP APIs, databases, webhooks, etc.)

```typescript
import { AnalyticsAdapter, AdapterPayload } from 'autolemetry-adapters';

class MyAdapter extends AnalyticsAdapter {
  readonly name = 'MyAdapter';

  protected async sendToDestination(payload: AdapterPayload): Promise<void> {
    // Send to your platform
    await fetch('https://api.example.com/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
```

### `StreamingAnalyticsAdapter` - For High-Throughput Streams

Extends `AnalyticsAdapter` with batching and partitioning for streaming platforms.

**When to use:** Kafka, Kinesis, Pub/Sub, event streams, high-volume data pipelines

```typescript
import { StreamingAnalyticsAdapter } from 'autolemetry-adapters';

class KafkaAdapter extends StreamingAnalyticsAdapter {
  readonly name = 'KafkaAdapter';

  protected async sendBatch(events: AdapterPayload[]): Promise<void> {
    await this.producer.send({
      topic: 'analytics',
      messages: events.map(e => ({ value: JSON.stringify(e) }))
    });
  }
}
```

---

## Installation

```bash
# Core package (required)
pnpm add autolemetry

# Adapters package (optional)
pnpm add autolemetry-adapters

# Install the analytics SDKs you need
pnpm add posthog-node      # For PostHog
pnpm add mixpanel          # For Mixpanel
pnpm add @segment/analytics-node  # For Segment
pnpm add @amplitude/analytics-node  # For Amplitude
```

---

## Quick Start

### Using Built-in Adapters (Easiest)

Import adapters directly from their entry points:

```typescript
import { Analytics } from 'autolemetry/analytics';
import { PostHogAdapter } from 'autolemetry-adapters/posthog';
import { WebhookAdapter } from 'autolemetry-adapters/webhook';

const analytics = new Analytics('checkout', {
  adapters: [
    new PostHogAdapter({ apiKey: process.env.POSTHOG_API_KEY! }),
    new WebhookAdapter({ url: 'https://your-webhook.com' })
  ]
});

// Sent to: OpenTelemetry + PostHog + Webhook
analytics.trackEvent('order.completed', { userId: '123', amount: 99.99 });
```

### Your First Custom Adapter (5 Minutes)

Create an adapter in 25 lines:

```typescript
import { AnalyticsAdapter, AdapterPayload } from 'autolemetry-adapters';

class MyAdapter extends AnalyticsAdapter {
  readonly name = 'MyAdapter';

  constructor(private apiKey: string) {
    super();
  }

  protected async sendToDestination(payload: AdapterPayload): Promise<void> {
    await fetch('https://your-api.com/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }
}

// Use it!
const analytics = new Analytics('my-app', {
  adapters: [new MyAdapter('your-api-key')]
});
```

**That's it!** Extend `AnalyticsAdapter` and implement `sendToDestination()`. You get error handling, graceful shutdown, and pending request tracking automatically. See [Your First Adapter Guide](./docs/your-first-adapter.md) for details.

### Test Your Adapter

```typescript
import { AdapterTestHarness } from 'autolemetry-adapters/testing';

const harness = new AdapterTestHarness(new MyAdapter('test-key'));
const results = await harness.runAll();

AdapterTestHarness.printResults(results);
// All tests passed! Your adapter is ready to use.
```

### Add Middleware (Retry, Sampling, etc.)

```typescript
import { applyMiddleware, retryMiddleware, samplingMiddleware } from 'autolemetry-adapters/middleware';

const adapter = applyMiddleware(
  new MyAdapter('api-key'),
  [
    retryMiddleware({ maxRetries: 3 }),  // Retry failed requests
    samplingMiddleware(0.1)               // Only send 10% of events
  ]
);
```

---

## Built-in Adapters

### PostHog

```typescript
import { Analytics } from 'autolemetry/analytics';
import { PostHogAdapter } from 'autolemetry-adapters/posthog';

const analytics = new Analytics('checkout', {
  adapters: [
    new PostHogAdapter({
      apiKey: process.env.POSTHOG_API_KEY!,
      host: 'https://us.i.posthog.com' // optional
    })
  ]
});

// Sent to: OpenTelemetry + PostHog
analytics.trackEvent('order.completed', { 
  userId: '123', 
  amount: 99.99 
});
```

### Mixpanel

```typescript
import { MixpanelAdapter } from 'autolemetry-adapters/mixpanel';

const analytics = new Analytics('checkout', {
  adapters: [
    new MixpanelAdapter({
      token: process.env.MIXPANEL_TOKEN!
    })
  ]
});
```

### Segment

```typescript
import { SegmentAdapter } from 'autolemetry-adapters/segment';

const analytics = new Analytics('checkout', {
  adapters: [
    new SegmentAdapter({
      writeKey: process.env.SEGMENT_WRITE_KEY!
    })
  ]
});
```

### Amplitude

```typescript
import { AmplitudeAdapter } from 'autolemetry-adapters/amplitude';

const analytics = new Analytics('checkout', {
  adapters: [
    new AmplitudeAdapter({
      apiKey: process.env.AMPLITUDE_API_KEY!
    })
  ]
});
```

### Webhook (Custom Integrations)

```typescript
import { WebhookAdapter } from 'autolemetry-adapters/webhook';

const analytics = new Analytics('checkout', {
  adapters: [
    new WebhookAdapter({
      url: 'https://hooks.zapier.com/hooks/catch/...',
      headers: { 'X-API-Key': 'secret' },
      maxRetries: 3
    })
  ]
});
```

---

## Multi-Platform Tracking

Send to **multiple platforms simultaneously**:

```typescript
import { Analytics } from 'autolemetry/analytics';
import { PostHogAdapter } from 'autolemetry-adapters/posthog';
import { MixpanelAdapter } from 'autolemetry-adapters/mixpanel';
import { SegmentAdapter } from 'autolemetry-adapters/segment';

const analytics = new Analytics('checkout', {
  adapters: [
    new PostHogAdapter({ apiKey: 'phc_...' }),
    new MixpanelAdapter({ token: '...' }),
    new SegmentAdapter({ writeKey: '...' })
  ]
});

// Sent to: OpenTelemetry + PostHog + Mixpanel + Segment
analytics.trackEvent('order.completed', { 
  userId: '123', 
  amount: 99.99,
  currency: 'USD'
});
```

---

## Delivery Patterns

Autolemetry-adapters provides **direct adapters** (fire-and-forget) - events are sent immediately to analytics platforms.

### Direct Adapters (Default)

**Simple, fire-and-forget tracking** - Events sent immediately to analytics platforms:

```typescript
const analytics = new Analytics('app', {
  adapters: [new PostHogAdapter({ apiKey: '...' })]
})

// Events sent immediately, real-time
analytics.trackEvent('user.signup', { userId: '123' })
analytics.trackEvent('page.viewed', { path: '/checkout' })
```

**Use for:**
- Page views, button clicks, feature usage
- User behavior tracking
- High-volume, non-critical analytics
- Real-time analytics dashboards

**Benefits:**
- Simple, zero infrastructure
- Real-time delivery
- No database overhead
- Fire-and-forget

**Trade-offs:**
- Events can be lost if adapter/network fails
- No atomicity with database transactions

### Transactional Outbox Pattern

**For guaranteed delivery with atomicity**, use the separate [`autolemetry-outbox`](https://github.com/jagreehal/autolemetry/tree/main/packages/autolemetry-outbox) package.

This provides:
- Guaranteed delivery (retries on failure)
- Atomicity with database state changes
- Fan-out to multiple destinations
- Requires database table + publisher worker
- Adds latency (1+ minute delay)

**Install:**
```bash
npm install autolemetry-outbox
```

**Usage:**
```typescript
import { OutboxAnalyticsAdapter } from 'autolemetry-outbox';
import { PostHogAdapter } from 'autolemetry-adapters/posthog';

const outbox = new DrizzleD1OutboxStorage(env.DB);
const analytics = new Analytics('checkout', {
  adapters: [
    new OutboxAnalyticsAdapter(outbox, { aggregateType: 'Order' })
  ]
});
```

---

## Adapter Methods

All adapters implement these methods:

```typescript
interface AnalyticsAdapter {
  // Track events
  trackEvent(name: string, attributes?: Record<string, any>): void;
  
  // Track conversion funnels
  trackFunnelStep(
    funnelName: string, 
    step: 'started' | 'completed' | 'abandoned' | 'failed',
    attributes?: Record<string, any>
  ): void;
  
  // Track business outcomes
  trackOutcome(
    operationName: string,
    outcome: 'success' | 'failure' | 'partial',
    attributes?: Record<string, any>
  ): void;
  
  // Track business values (revenue, counts, etc.)
  trackValue(
    name: string, 
    value: number,
    attributes?: Record<string, any>
  ): void;
}
```

---

## Custom Adapter

Create your own adapter for any platform:

```typescript
import { AnalyticsAdapter } from 'autolemetry/analytics-adapter';

class MyCustomAdapter implements AnalyticsAdapter {
  trackEvent(name: string, attributes?: Record<string, any>): void {
    // Send to your platform
    fetch('https://api.myplatform.com/events', {
      method: 'POST',
      body: JSON.stringify({ event: name, ...attributes })
    });
  }
  
  trackFunnelStep(funnel: string, step: string, attributes?: any): void {
    // Implement funnel tracking
  }
  
  trackOutcome(operation: string, outcome: string, attributes?: any): void {
    // Implement outcome tracking
  }
  
  trackValue(name: string, value: number, attributes?: any): void {
    // Implement value tracking
  }
}

// Use it
const analytics = new Analytics('app', {
  adapters: [new MyCustomAdapter()]
});
```

---

## Configuration

### Enable/Disable Adapters

```typescript
const analytics = new Analytics('checkout', {
  adapters: [
    new PostHogAdapter({ 
      apiKey: 'phc_...',
      enabled: process.env.NODE_ENV === 'production' // Only in prod
    }),
    new MixpanelAdapter({ 
      token: '...',
      enabled: false // Temporarily disabled
    })
  ]
});
```

### Shutdown Gracefully

```typescript
const posthog = new PostHogAdapter({ apiKey: 'phc_...' });
const segment = new SegmentAdapter({ writeKey: '...' });

// Before app shutdown
await posthog.shutdown();
await segment.shutdown();
```

---

## Tree-Shaking

Adapters are **fully tree-shakeable**:

```typescript
// Only PostHog code is bundled (not Mixpanel, Segment, etc.)
import { PostHogAdapter } from 'autolemetry-adapters/posthog';
```

Bundle sizes (gzipped):
- PostHog: ~8KB
- Mixpanel: ~6KB
- Segment: ~12KB
- Amplitude: ~10KB
- Webhook: ~2KB

---

## Performance

**Zero overhead when not used:**
- If `adapters: []` (empty), no adapter code runs
- Tree-shaken out in production builds

**Minimal overhead when used:**
- Adapters only fire if added to the array
- Non-blocking (fire-and-forget)
- No impact on primary OpenTelemetry metrics

---

## Middleware (Composition Patterns)

Add behaviors without modifying adapter code:

### Available Middleware

```typescript
import {
  applyMiddleware,
  retryMiddleware,          // Exponential backoff retry
  samplingMiddleware,       // Send only X% of events
  enrichmentMiddleware,     // Add fields to events
  loggingMiddleware,        // Debug events
  filterMiddleware,         // Only send matching events
  transformMiddleware,      // Transform events
  batchingMiddleware,       // Batch for efficiency
  rateLimitMiddleware,      // Throttle requests
  circuitBreakerMiddleware, // Prevent cascading failures
  timeoutMiddleware         // Add timeouts
} from 'autolemetry-adapters/middleware';
```

### Examples

**Retry with Circuit Breaker:**
```typescript
const adapter = applyMiddleware(
  new PostHogAdapter({ apiKey: '...' }),
  [
    retryMiddleware({ maxRetries: 3, delayMs: 1000 }),
    circuitBreakerMiddleware({ failureThreshold: 5, timeout: 60000 })
  ]
);
```

**Sample Events (Reduce Costs):**
```typescript
// Only send 10% of events
const adapter = applyMiddleware(
  new WebhookAdapter({ url: '...' }),
  [samplingMiddleware(0.1)]
);
```

**Enrich Events:**
```typescript
const adapter = applyMiddleware(
  adapter,
  [
    enrichmentMiddleware((event) => ({
      ...event,
      attributes: {
        ...event.attributes,
        environment: process.env.NODE_ENV,
        timestamp: Date.now()
      }
    }))
  ]
);
```

**Batch Events:**
```typescript
const adapter = applyMiddleware(
  adapter,
  [batchingMiddleware({ batchSize: 100, flushInterval: 5000 })]
);
```

---

## Testing Custom Adapters

### AdapterTestHarness

Validate your adapter works correctly:

```typescript
import { AdapterTestHarness } from 'autolemetry-adapters/testing';

const harness = new AdapterTestHarness(new MyAdapter());
const results = await harness.runAll();

if (results.passed) {
  console.log('All tests passed!');
} else {
  console.error('Tests failed:', results.failures);
}

// Or use the built-in printer
AdapterTestHarness.printResults(results);
```

Tests include:
- Basic event tracking
- Funnel tracking
- Outcome tracking
- Value tracking
- Concurrent requests (50 events)
- Error handling
- Graceful shutdown

### MockWebhookServer

Test webhook adapters without real HTTP calls:

```typescript
import { MockWebhookServer } from 'autolemetry-adapters/testing';

const server = new MockWebhookServer();
const url = await server.start();

const adapter = new WebhookAdapter({ url });
await adapter.trackEvent('test', { foo: 'bar' });

// Assert
const requests = server.getRequests();
expect(requests).toHaveLength(1);
expect(requests[0].body.event).toBe('test');

await server.stop();
```

---

## Package Exports

All exports available:

```typescript
// Import adapters from their specific entry points
import { PostHogAdapter } from 'autolemetry-adapters/posthog';
import { MixpanelAdapter } from 'autolemetry-adapters/mixpanel';
import { SegmentAdapter } from 'autolemetry-adapters/segment';
import { AmplitudeAdapter } from 'autolemetry-adapters/amplitude';
import { WebhookAdapter } from 'autolemetry-adapters/webhook';
import { SlackAdapter } from 'autolemetry-adapters/slack';

// Base classes for building custom adapters
import { AnalyticsAdapter, AdapterPayload } from 'autolemetry-adapters';
import { StreamingAnalyticsAdapter } from 'autolemetry-adapters';

// Middleware (composition)
import {
  applyMiddleware,
  retryMiddleware,
  samplingMiddleware,
  /* ... 8 more middleware functions */
} from 'autolemetry-adapters/middleware';

// Testing utilities
import {
  AdapterTestHarness,
  MockWebhookServer,
  MockAnalyticsAdapter
} from 'autolemetry-adapters/testing';

// For outbox pattern, see autolemetry-outbox package
```

---

## Resources

- [Your First Adapter Guide](./docs/your-first-adapter.md) - Create a custom adapter in 5 minutes
- [Quickstart Template](./examples/quickstart-custom-adapter.ts) - Copy-paste 20-line template
- [Testing Guide](./docs/your-first-adapter.md#test-your-adapter) - Validate your adapter works
- [Middleware Guide](./docs/your-first-adapter.md#add-superpowers-with-middleware) - Add retry, sampling, etc.
- [Outbox Pattern](/packages/autolemetry-outbox/) - For transactional outbox pattern

---

## Examples

See the [autolemetry-examples](https://github.com/jagreehal/autolemetry/tree/main/packages/autolemetry-examples) package for complete examples.

---

## License

MIT © [Jag Reehal](https://jagreehal.com)


