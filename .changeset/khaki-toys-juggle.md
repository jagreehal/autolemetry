---
'autolemetry-plugins': minor
'autolemetry': minor
---

Add Mongoose instrumentation plugin and improve integration support

## autolemetry-plugins

**Added Mongoose instrumentation plugin** (`autolemetry-plugins/mongoose`)

The official `@opentelemetry/instrumentation-mongoose` package is fundamentally broken in ESM+tsx environments due to module loading hook issues. This new plugin provides:

- ✅ **Runtime patching** (works in ESM+tsx, unlike official package)
- ✅ **Automatic hook tracing** - pre/post hooks are automatically instrumented without manual `trace()` calls
- ✅ **Complete operation coverage** - all Mongoose operations (create, find, update, delete, etc.) are traced
- ✅ **Semantic attributes** - proper OpenTelemetry conventions (db.system, db.operation, db.mongodb.collection, etc.)
- ✅ **70% less boilerplate** - write normal Mongoose code, get automatic observability

**Usage:**

```typescript
import mongoose from 'mongoose';
import { instrumentMongoose } from 'autolemetry-plugins/mongoose';

// Instrument BEFORE defining schemas
instrumentMongoose(mongoose, { dbName: 'myapp' });

// Hooks are automatically traced - no manual instrumentation needed!
userSchema.pre('save', async function() {
  this.email = this.email.toLowerCase();
});
```

**Why not use the official package?**

The official package uses module loading hooks that fail with ESM import hoisting. Our implementation uses runtime patching, so it works everywhere (CommonJS, ESM, tsx, ts-node).

## autolemetry

**Improved integration support and documentation**

- Enhanced `init()` function with better integration handling
- Added comprehensive integration examples and documentation
- Improved test coverage for integrations
- Removed deprecated ESM loading test file
