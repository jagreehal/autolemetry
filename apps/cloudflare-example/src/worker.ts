import type { worker } from '../alchemy.run.ts';
import {
  instrument,
  trace,
  createEdgeLogger,
  getEdgeAdapters,
} from 'autolemetry-edge';

const log = createEdgeLogger('cloudflare-example');

// Example traced function
const processRequest = trace(async function processRequest(request: Request) {
  const url = new URL(request.url);
  log.info('Processing request', { path: url.pathname });

  return {
    message: 'Hello from Alchemy!',
    timestamp: new Date().toISOString(),
    path: url.pathname,
  };
});

// Example function that uses KV (automatically instrumented)
const getCachedValue = trace(async function getCachedValue(
  key: string,
  kv: KVNamespace,
) {
  const value = await kv.get(key); // Creates span: "KV {namespace}: get"
  return value;
});

// Example function that uses R2 (automatically instrumented)
const getObject = trace(async function getObject(
  key: string,
  r2: R2Bucket,
) {
  const object = await r2.get(key); // Creates span: "R2 {bucket}: get"
  return object;
});

// Example function that uses D1 (automatically instrumented)
const queryUsers = trace(async function queryUsers(db: D1Database) {
  const result = await db
    .prepare('SELECT * FROM users LIMIT 10')
    .all(); // Creates span: "D1 {database}: all"
  return result;
});

// Handler with automatic HTTP instrumentation and all features
const handler: ExportedHandler<typeof worker.Env> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Demonstrate auto-instrumented bindings
    if (url.pathname === '/kv' && env.MY_KV) {
      const value = await getCachedValue('test-key', env.MY_KV);
      return Response.json({ value });
    }

    if (url.pathname === '/r2' && env.MY_R2) {
      const object = await getObject('test-object', env.MY_R2);
      return Response.json({ exists: !!object });
    }

    if (url.pathname === '/d1' && env.MY_D1) {
      const users = await queryUsers(env.MY_D1);
      return Response.json({ users });
    }

    if (url.pathname === '/service' && env.MY_SERVICE) {
      // Service binding is automatically instrumented
      const response = await env.MY_SERVICE.fetch(request); // Creates span: "Service MY_SERVICE: GET"
      return response;
    }

    // Use edge adapters if available
    const adapters = getEdgeAdapters(ctx);
    if (adapters) {
      adapters.trackEvent('request.processed', { path: url.pathname });
    }

    const result = await processRequest(request);
    return Response.json(result);
  },

  // Scheduled handler example (works in dev mode)
  async scheduled(event, env, ctx) {
    log.info('Scheduled task executed', { cron: event.cron });
    // Your scheduled task logic here
  },

  // Queue handler example (requires paid account, but code compiles)
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        await processMessage(message);
        message.ack(); // Creates event: "messageAck" with message details
      } catch (error) {
        // Retry with delay
        message.retry({ delaySeconds: 60 });
        // Creates event: "messageRetry" with delay attribute
      }
    }
  },

  // Email handler example (requires Email Routing setup, but code compiles)
  async email(message, env, ctx) {
    log.info('Email received', {
      from: message.from,
      to: message.to,
    });
    // Email handler automatically creates spans with all headers
  },
};

async function processMessage(message: Message) {
  // Process message logic
  log.info('Processing message', { id: message.id });
}

// Export instrumented handler with all features enabled
export default instrument(handler, (env: typeof worker.Env) => ({
  exporter: {
    url: env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: env.OTLP_HEADERS ? JSON.parse(env.OTLP_HEADERS) : {},
  },
  service: {
    name: 'cloudflare-example',
    version: '1.0.1',
  },
  instrumentation: {
    instrumentGlobalFetch: true,
    instrumentGlobalCache: true,
    // Set to true to disable all instrumentation for local dev
    disabled: env.DISABLE_INSTRUMENTATION === 'true',
  },
  handlers: {
    fetch: {
      // Customize fetch spans with postProcess callback
      postProcess: (span, { request, response, readable }) => {
        const url = new URL(request.url);
        // Add custom attributes based on request/response
        if (url.pathname.startsWith('/api/')) {
          span.setAttribute('api.endpoint', url.pathname);
        }
        if (response.status >= 500) {
          span.setAttribute('error.severity', 'high');
        }
        // Access readable span for advanced use cases
        const duration =
          (readable.endTime[0] - readable.startTime[0]) / 1_000_000; // Convert to ms
        if (duration > 1000) {
          span.setAttribute('performance.slow', true);
        }
      },
    },
  },
}));
