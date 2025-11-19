# Autolemetry Plugins

OpenTelemetry instrumentation for ORMs and databases **without official support**. This package fills gaps where the OpenTelemetry community hasn't yet provided official instrumentation.

> **Philosophy**: Use official [@opentelemetry/instrumentation-\*](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node) packages when available. This package only provides instrumentation for libraries that lack official support.

## When to Use This Package

✅ **Use `autolemetry-plugins`** when:

- You're using **Drizzle ORM** (no official instrumentation exists)
- You need instrumentation for ORMs/databases without official OpenTelemetry support

❌ **Use official packages** for:

- MongoDB → [`@opentelemetry/instrumentation-mongodb`](https://www.npmjs.com/package/@opentelemetry/instrumentation-mongodb)
- Mongoose → [`@opentelemetry/instrumentation-mongoose`](https://www.npmjs.com/package/@opentelemetry/instrumentation-mongoose)
- PostgreSQL → [`@opentelemetry/instrumentation-pg`](https://www.npmjs.com/package/@opentelemetry/instrumentation-pg)
- MySQL → [`@opentelemetry/instrumentation-mysql2`](https://www.npmjs.com/package/@opentelemetry/instrumentation-mysql2)
- Redis → [`@opentelemetry/instrumentation-redis`](https://www.npmjs.com/package/@opentelemetry/instrumentation-redis)

[Browse all official instrumentations →](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node)

## Features

- **Tree-shakeable**: Import only what you need
- **Zero overhead**: Instrumentation only adds spans when operations occur
- **Type-safe**: Full TypeScript support with generics
- **Idempotent**: Safe to call instrument functions multiple times
- **Configurable**: Control what data is captured in spans

## Installation

```bash
npm install autolemetry-plugins
```

## Currently Supported

### Drizzle ORM

Instrument Drizzle database operations with OpenTelemetry tracing.

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle';

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client: queryClient });

// Instrument the database instance
instrumentDrizzleClient(db, {
  dbSystem: 'postgresql',
  dbName: 'myapp',
  peerName: 'db.example.com',
  peerPort: 5432,
  captureQueryText: true,
});

// All queries are now traced
await db.select().from(users).where(eq(users.id, 123));
```

**Supported databases:**

- PostgreSQL (node-postgres, postgres.js)
- MySQL (mysql2)
- SQLite (better-sqlite3, LibSQL/Turso)

**Functions:**

- `instrumentDrizzle(client, config)` - Instrument a database client/pool
- `instrumentDrizzleClient(db, config)` - Instrument a Drizzle database instance

**Configuration:**

```typescript
{
  dbSystem?: string           // Database type (postgresql, mysql, sqlite)
  dbName?: string            // Database name
  captureQueryText?: boolean // Capture SQL in spans (default: true)
  maxQueryTextLength?: number // Max SQL length (default: 1000)
  peerName?: string          // Database host
  peerPort?: number          // Database port
}
```

## Using Official Instrumentation Packages

For databases with official OpenTelemetry support, use the contrib packages directly with autolemetry:

### MongoDB Example

```typescript
import { init } from 'autolemetry';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { MongoClient } from 'mongodb';

// Initialize autolemetry with MongoDB instrumentation
init({
  service: 'my-service',
  instrumentations: [
    new MongoDBInstrumentation({
      enhancedDatabaseReporting: true,
    }),
  ],
});

// MongoDB operations are automatically traced
const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const db = client.db('myapp');
await db.collection('users').findOne({ email: 'user@example.com' });
```

### Mongoose Example

```typescript
import { init } from 'autolemetry';
import { MongooseInstrumentation } from '@opentelemetry/instrumentation-mongoose';
import mongoose from 'mongoose';

// Initialize autolemetry with Mongoose instrumentation
init({
  service: 'my-service',
  instrumentations: [new MongooseInstrumentation()],
});

// Mongoose operations are automatically traced
await mongoose.connect('mongodb://localhost:27017/myapp');
const User = mongoose.model('User', new mongoose.Schema({ email: String }));
await User.findOne({ email: 'user@example.com' });
```

### Multiple Instrumentations

Combine multiple official instrumentations:

```typescript
import { init } from 'autolemetry';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';

init({
  service: 'my-service',
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new MongoDBInstrumentation(),
    new RedisInstrumentation(),
  ],
});
```

## Usage with Autolemetry

Drizzle instrumentation works seamlessly with [Autolemetry](../autolemetry):

```typescript
import { init } from 'autolemetry';
import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Initialize Autolemetry
init({
  service: 'my-service',
  otlp: {
    endpoint: 'http://localhost:4318',
  },
});

// Instrument your database
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle({ client });
instrumentDrizzleClient(db, { dbSystem: 'postgresql' });

// Traces will be sent to your OTLP endpoint
await db.select().from(users);
```

## Span Attributes

All plugins follow OpenTelemetry semantic conventions:

### Common Attributes

- `db.system` - Database system (postgresql, mysql, sqlite)
- `db.operation` - Operation name (SELECT, INSERT, UPDATE, DELETE)
- `db.name` - Database name
- `net.peer.name` - Remote host
- `net.peer.port` - Remote port

### Drizzle-Specific

- `db.statement` - SQL query text (if enabled)

## Security Considerations

### Query Text Capture

Drizzle plugin captures SQL query text by default. This may contain sensitive data:

```typescript
instrumentDrizzleClient(db, {
  captureQueryText: false, // Disable to prevent PII leakage
});
```

## Examples

### Multi-Database Application

```typescript
import { init } from 'autolemetry'
import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle'
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { MongoClient } from 'mongodb'

init({
  service: 'multi-db-app',
  instrumentations: [
    new MongoDBInstrumentation({
      enhancedDatabaseReporting: true,
    }),
  ],
})

// PostgreSQL for transactional data (use autolemetry-plugins)
const pgClient = postgres(process.env.PG_URL!)
const pg = drizzle({ client: pgClient })
instrumentDrizzleClient(pg, { dbSystem: 'postgresql', dbName: 'orders' })

// MongoDB for events (automatically instrumented)
const mongoClient = new MongoClient(process.env.MONGO_URL!)
await mongoClient.connect()

// Both databases are now traced
await pg.select().from(orders)
await mongoClient.db('events').collection('events').insertOne({ ... })
```

### Conditional Instrumentation

```typescript
import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle';

// Only instrument in development
if (process.env.NODE_ENV === 'development') {
  instrumentDrizzleClient(db, {
    captureQueryText: true,
    maxQueryTextLength: 2000,
  });
}
```

## TypeScript

Full type safety with TypeScript:

```typescript
import type { InstrumentDrizzleConfig } from 'autolemetry-plugins';

const drizzleConfig: InstrumentDrizzleConfig = {
  dbSystem: 'postgresql',
  captureQueryText: true,
};
```

## Future Plans

When official OpenTelemetry instrumentation becomes available for Drizzle ORM, we will:

1. Announce deprecation with migration guide
2. Recommend users switch to the official package
3. Eventually remove Drizzle instrumentation from this package

This ensures users always get the best, most maintained instrumentation possible.

## Creating Your Own Instrumentation

Don't see your library here? Autolemetry makes it easy to create custom instrumentation for any library using simple, well-tested utilities.

### Quick Example

```typescript
import { trace, SpanKind } from '@opentelemetry/api';
import { runWithSpan, finalizeSpan } from 'autolemetry/trace-helpers';

const INSTRUMENTED_FLAG = Symbol('instrumented');

export function instrumentMyLibrary(client) {
  if (client[INSTRUMENTED_FLAG]) return client;

  const tracer = trace.getTracer('my-library');
  const originalMethod = client.someMethod.bind(client);

  client.someMethod = async function (...args) {
    const span = tracer.startSpan('operation', { kind: SpanKind.CLIENT });
    span.setAttribute('operation.param', args[0]);

    try {
      const result = await runWithSpan(span, () => originalMethod(...args));
      finalizeSpan(span);
      return result;
    } catch (error) {
      finalizeSpan(span, error);
      throw error;
    }
  };

  client[INSTRUMENTED_FLAG] = true;
  return client;
}
```

### Full Guide

For a comprehensive guide including:

- Step-by-step tutorial with real examples
- Best practices for security and idempotency
- Complete utilities reference
- Ready-to-use template code

**See: [Creating Custom Instrumentation](../autolemetry/README.md#creating-custom-instrumentation)** in the main autolemetry docs.

You can also check [`INSTRUMENTATION_TEMPLATE.ts`](../autolemetry/INSTRUMENTATION_TEMPLATE.ts) for a fully commented, copy-paste-ready template.

## Contributing

Found a database/ORM without official OpenTelemetry instrumentation? Please [open an issue](https://github.com/jagreehal/autolemetry/issues) to discuss adding it.

## License

MIT
