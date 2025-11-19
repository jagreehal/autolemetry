# autolemetry-plugins

## 0.3.1

### Patch Changes

- Updated dependencies [b5bd9ab]
  - autolemetry@1.0.0

## 0.3.0

### Minor Changes

- feb78b4: - Updated dependencies: vitest to v4.0.10, typescript-eslint to v8.47.0, and other dev dependencies
  - Enhanced compatibility with autolemetry core package updates including gRPC protocol support and Honeycomb preset
  - Improved type safety and build tooling across all packages

## 0.2.1

### Patch Changes

- Updated dependencies [856a69e]
  - autolemetry@0.1.3

## 0.2.0

### Minor Changes

- 3a2b9d7: Add autolemetry-plugins package with Drizzle ORM instrumentation

  This new package provides OpenTelemetry instrumentation for databases and ORMs **without official support**. Following the principle of using official contrib packages when available, this package currently only includes Drizzle ORM instrumentation.

  **Philosophy:**
  - Use official `@opentelemetry/instrumentation-*` packages when available
  - Only provide instrumentation for libraries lacking official support
  - Deprecate and migrate when official instrumentation becomes available

  **Features:**
  - Drizzle ORM instrumentation (PostgreSQL, MySQL, SQLite, LibSQL/Turso)
  - Tree-shakeable imports (e.g., `autolemetry-plugins/drizzle`)
  - Full TypeScript support with generics
  - Idempotent instrumentation (safe to call multiple times)
  - Configurable span attributes and query capture
  - Uses shared utilities from autolemetry core (`runWithSpan`, `finalizeSpan`)

  **For MongoDB and Mongoose:**
  Users should use official packages instead:
  - MongoDB: `@opentelemetry/instrumentation-mongodb`
  - Mongoose: `@opentelemetry/instrumentation-mongoose`

  **Usage:**

  ```typescript
  import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle';
  import { drizzle } from 'drizzle-orm/postgres-js';
  import postgres from 'postgres';

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle({ client });

  // Instrument Drizzle (no official instrumentation exists)
  instrumentDrizzleClient(db, {
    dbSystem: 'postgresql',
    captureQueryText: true,
  });

  // For MongoDB, use official instrumentation:
  import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
  import { init } from 'autolemetry';

  init({
    service: 'my-app',
    instrumentations: [new MongoDBInstrumentation()],
  });
  ```
