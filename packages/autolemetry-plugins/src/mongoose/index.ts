/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: `any` types are necessary for dynamic instrumentation patterns
// where we need to wrap arbitrary methods and preserve their signatures
import { SpanKind, trace, type Span } from '@opentelemetry/api';
import {
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_MONGODB_COLLECTION,
  SEMATTRS_DB_NAME,
  SEMATTRS_NET_PEER_NAME,
  SEMATTRS_NET_PEER_PORT,
} from '../common/constants';
import { runWithSpan, finalizeSpan } from 'autolemetry/trace-helpers';

const DEFAULT_TRACER_NAME = 'autolemetry-plugins/mongoose';
const DEFAULT_DB_SYSTEM = 'mongoose';
const INSTRUMENTED_FLAG = '__autolemetryMongooseInstrumented' as const;

/**
 * Configuration options for Mongoose instrumentation.
 */
export interface MongooseInstrumentationConfig {
  /**
   * Custom tracer name. Defaults to "autolemetry-plugins/mongoose".
   */
  tracerName?: string;

  /**
   * Database name to include in spans.
   */
  dbName?: string;

  /**
   * Whether to capture collection names in spans.
   * Defaults to true.
   */
  captureCollectionName?: boolean;

  /**
   * Remote hostname or IP address of the MongoDB server.
   * Example: "db.example.com" or "192.168.1.100"
   */
  peerName?: string;

  /**
   * Remote port number of the MongoDB server.
   * Example: 27017 (default MongoDB port)
   */
  peerPort?: number;
}

interface MongooseLike {
  Model?: any;
  Schema?: any;
  Query?: any;
  Document?: any;
  [INSTRUMENTED_FLAG]?: true;
}

/**
 * Creates a span for a Mongoose operation.
 */
function createMongooseSpan(
  tracer: any,
  operation: string,
  collectionName: string | undefined,
  config: Required<MongooseInstrumentationConfig>,
): Span {
  const spanName = collectionName
    ? `mongoose.${collectionName}.${operation}`
    : `mongoose.${operation}`;

  const span = tracer.startSpan(spanName, { kind: SpanKind.CLIENT });
  span.setAttribute(SEMATTRS_DB_SYSTEM, DEFAULT_DB_SYSTEM);
  span.setAttribute(SEMATTRS_DB_OPERATION, operation);

  if (collectionName && config.captureCollectionName) {
    span.setAttribute(SEMATTRS_DB_MONGODB_COLLECTION, collectionName);
  }

  if (config.dbName) {
    span.setAttribute(SEMATTRS_DB_NAME, config.dbName);
  }

  if (config.peerName) {
    span.setAttribute(SEMATTRS_NET_PEER_NAME, config.peerName);
  }

  if (config.peerPort) {
    span.setAttribute(SEMATTRS_NET_PEER_PORT, config.peerPort);
  }

  return span;
}

/**
 * Wraps a Mongoose method with OpenTelemetry tracing.
 */
function wrapMethod(
  target: any,
  methodName: string,
  operation: string,
  getCollectionName: (thisArg: any) => string | undefined,
  tracer: any,
  config: Required<MongooseInstrumentationConfig>,
): void {
  const original = target[methodName];
  if (typeof original !== 'function') {
    return;
  }

  target[methodName] = function instrumented(this: any, ...args: any[]) {
    const collectionName = getCollectionName(this);
    const span = createMongooseSpan(tracer, operation, collectionName, config);

    return runWithSpan(span, () => {
      try {
        const result = original.apply(this, args);

        // Handle promises
        if (result && typeof result.then === 'function') {
          return Promise.resolve(result)
            .then((value) => {
              finalizeSpan(span);
              return value;
            })
            .catch((error) => {
              finalizeSpan(span, error);
              throw error;
            });
        }

        // Synchronous result
        finalizeSpan(span);
        return result;
      } catch (error) {
        finalizeSpan(span, error);
        throw error;
      }
    });
  };
}

/**
 * Patches Mongoose Schema hooks (pre/post) to automatically trace them.
 */
function patchSchemaHooks(
  Schema: any,
  tracer: any,
  config: Required<MongooseInstrumentationConfig>,
): void {
  if (!Schema || !Schema.prototype) {
    return;
  }

  const HOOK_INSTRUMENTED_FLAG = '__autolemetryHookInstrumented' as const;

  // Check if already instrumented
  if ((Schema.prototype as any)[HOOK_INSTRUMENTED_FLAG]) {
    return;
  }

  // Patch pre() hook registration
  const originalPre = Schema.prototype.pre;
  if (typeof originalPre === 'function') {
    Schema.prototype.pre = function (
      this: any,
      hookName: string,
      ...args: any[]
    ) {
      // Extract the hook handler (can be at different positions depending on options)
      let handler: any;

      if (typeof args[0] === 'function') {
        handler = args[0];
        args[0] = wrapHookHandler(handler, hookName, 'pre', tracer, config);
      } else if (typeof args[1] === 'function') {
        handler = args[1];
        args[1] = wrapHookHandler(handler, hookName, 'pre', tracer, config);
      }

      return Reflect.apply(originalPre, this, [hookName, ...args]);
    };
  }

  // Patch post() hook registration
  const originalPost = Schema.prototype.post;
  if (typeof originalPost === 'function') {
    Schema.prototype.post = function (
      this: any,
      hookName: string,
      ...args: any[]
    ) {
      // Extract the hook handler
      let handler: any;

      if (typeof args[0] === 'function') {
        handler = args[0];
        args[0] = wrapHookHandler(handler, hookName, 'post', tracer, config);
      } else if (typeof args[1] === 'function') {
        handler = args[1];
        args[1] = wrapHookHandler(handler, hookName, 'post', tracer, config);
      }

      return Reflect.apply(originalPost, this, [hookName, ...args]);
    };
  }

  (Schema.prototype as any)[HOOK_INSTRUMENTED_FLAG] = true;
}

/**
 * Wraps a hook handler function with OpenTelemetry tracing.
 */
function wrapHookHandler(
  handler: any,
  hookName: string,
  hookType: 'pre' | 'post',
  tracer: any,
  config: Required<MongooseInstrumentationConfig>,
): any {
  if (typeof handler !== 'function') {
    return handler;
  }

  // Return a wrapper function that creates a span
  return function wrappedHook(this: any, ...args: any[]) {
    // Extract model/collection name from context
    let modelName: string | undefined;
    let collectionName: string | undefined;

    try {
      // For document hooks, 'this' is the document
      if (this.constructor && this.constructor.modelName) {
        modelName = this.constructor.modelName;
        collectionName =
          this.constructor.collection?.collectionName || modelName;
      }
      // For query hooks, 'this' is the query
      else if (this.model && this.model.modelName) {
        modelName = this.model.modelName;
        collectionName = this.model.collection?.collectionName || modelName;
      }
      // For model hooks, try to get from schema
      else if (
        this.schema &&
        this.schema.options &&
        this.schema.options.collection
      ) {
        collectionName = this.schema.options.collection;
      }
    } catch {
      // Ignore errors in extracting context
    }

    const spanName = collectionName
      ? `mongoose.${collectionName}.${hookType}.${hookName}`
      : `mongoose.hook.${hookType}.${hookName}`;

    const span = tracer.startSpan(spanName, { kind: SpanKind.INTERNAL });
    span.setAttribute('hook.type', hookType);
    span.setAttribute('hook.operation', hookName);

    if (modelName) {
      span.setAttribute('hook.model', modelName);
    }

    if (collectionName && config.captureCollectionName) {
      span.setAttribute(SEMATTRS_DB_MONGODB_COLLECTION, collectionName);
    }

    span.setAttribute(SEMATTRS_DB_SYSTEM, DEFAULT_DB_SYSTEM);

    if (config.dbName) {
      span.setAttribute(SEMATTRS_DB_NAME, config.dbName);
    }

    return runWithSpan(span, () => {
      try {
        const result = handler.apply(this, args);

        // Handle async hooks (promises)
        if (result && typeof result.then === 'function') {
          return Promise.resolve(result)
            .then((value) => {
              finalizeSpan(span);
              return value;
            })
            .catch((error) => {
              finalizeSpan(span, error);
              throw error;
            });
        }

        // Synchronous hook
        finalizeSpan(span);
        return result;
      } catch (error) {
        finalizeSpan(span, error);
        throw error;
      }
    });
  };
}

/**
 * Patches Mongoose Model static methods.
 */
function patchModel(
  Model: any,
  tracer: any,
  config: Required<MongooseInstrumentationConfig>,
): void {
  if (!Model || !Model.prototype) {
    return;
  }

  // Get collection name from model
  const getCollectionName = (model: any) => {
    try {
      return model.collection?.collectionName || model.modelName;
    } catch {
      return;
    }
  };

  // Patch static methods (called on Model class)
  const staticMethods = [
    { method: 'create', operation: 'create' },
    { method: 'insertMany', operation: 'insertMany' },
    { method: 'find', operation: 'find' },
    { method: 'findOne', operation: 'findOne' },
    { method: 'findById', operation: 'findById' },
    { method: 'findOneAndUpdate', operation: 'findOneAndUpdate' },
    { method: 'findOneAndReplace', operation: 'findOneAndReplace' },
    { method: 'findOneAndDelete', operation: 'findOneAndDelete' },
    { method: 'findByIdAndUpdate', operation: 'findByIdAndUpdate' },
    { method: 'findByIdAndDelete', operation: 'findByIdAndDelete' },
    { method: 'updateOne', operation: 'updateOne' },
    { method: 'updateMany', operation: 'updateMany' },
    { method: 'deleteOne', operation: 'deleteOne' },
    { method: 'deleteMany', operation: 'deleteMany' },
    { method: 'countDocuments', operation: 'countDocuments' },
    { method: 'estimatedDocumentCount', operation: 'estimatedDocumentCount' },
    { method: 'aggregate', operation: 'aggregate' },
  ];

  for (const { method, operation } of staticMethods) {
    wrapMethod(Model, method, operation, getCollectionName, tracer, config);
  }

  // Patch instance methods (called on document instances)
  const getInstanceCollectionName = (doc: any) => {
    try {
      return (
        doc.constructor?.collection?.collectionName ||
        doc.constructor?.modelName
      );
    } catch {
      return;
    }
  };

  const instanceMethods = [
    { method: 'save', operation: 'save' },
    { method: 'remove', operation: 'remove' },
    { method: 'deleteOne', operation: 'deleteOne' },
  ];

  for (const { method, operation } of instanceMethods) {
    wrapMethod(
      Model.prototype,
      method,
      operation,
      getInstanceCollectionName,
      tracer,
      config,
    );
  }
}

/**
 * Instruments Mongoose with OpenTelemetry tracing using runtime patching.
 *
 * This function patches Mongoose's Model methods and Schema hooks to create spans for each database
 * operation and hook execution. Unlike the official @opentelemetry/instrumentation-mongoose package
 * which uses module loading hooks (broken in ESM+tsx), this implementation uses runtime patching
 * which works reliably in all environments (CommonJS, ESM, tsx).
 *
 * **What gets instrumented:**
 * - Model operations: create, find, update, delete, aggregate, etc.
 * - Instance methods: save, remove, deleteOne
 * - Schema hooks: pre/post hooks are automatically traced without manual instrumentation
 *
 * **Why we maintain a custom implementation:**
 * - The official package (@opentelemetry/instrumentation-mongoose) is fundamentally broken in ESM+tsx
 * - Module loading hooks (`import-in-the-middle`) have timing issues with ESM import hoisting
 * - Mongoose package lacks proper dual-mode exports (CJS only)
 * - ESM support won't be production-ready for 1-2 years (see OpenTelemetry GitHub issues)
 * - Our runtime patching approach works everywhere
 *
 * The instrumentation is idempotent - calling it multiple times will only instrument once.
 *
 * **IMPORTANT:** Call `instrumentMongoose()` BEFORE defining schemas/models to ensure hooks are
 * automatically instrumented. If called after, only model methods will be traced.
 *
 * @param mongoose - The Mongoose instance to instrument
 * @param config - Optional configuration for instrumentation behavior
 * @returns The instrumented Mongoose instance (same instance, modified in place)
 *
 * @example
 * ```typescript
 * import mongoose from 'mongoose';
 * import { init } from 'autolemetry';
 * import { instrumentMongoose } from 'autolemetry-plugins/mongoose';
 *
 * // Initialize OpenTelemetry
 * init({ service: 'my-app' });
 *
 * // Instrument Mongoose BEFORE defining schemas
 * instrumentMongoose(mongoose, {
 *   dbName: 'myapp',
 *   peerName: 'localhost',
 *   peerPort: 27017,
 * });
 *
 * // Define schemas - hooks are now automatically traced!
 * const userSchema = new mongoose.Schema({ name: String, email: String });
 * userSchema.pre('save', async function() {
 *   // This hook is automatically traced - no manual trace() needed!
 *   this.email = this.email.toLowerCase();
 * });
 *
 * const User = mongoose.model('User', userSchema);
 *
 * // All operations and hooks are automatically traced
 * await User.create({ name: 'Alice', email: 'ALICE@EXAMPLE.COM' });
 * // Creates spans: mongoose.users.create + mongoose.users.pre.save
 * ```
 *
 * @example
 * ```typescript
 * // With custom tracer name
 * import mongoose from 'mongoose';
 * import { instrumentMongoose } from 'autolemetry-plugins/mongoose';
 *
 * instrumentMongoose(mongoose, {
 *   tracerName: 'my-custom-tracer',
 *   dbName: 'production-db',
 *   captureCollectionName: true,
 * });
 * ```
 */
export function instrumentMongoose(
  mongoose: MongooseLike,
  config?: MongooseInstrumentationConfig,
): typeof mongoose {
  if (!mongoose || !mongoose.Model) {
    return mongoose;
  }

  // Check if already instrumented
  if (mongoose[INSTRUMENTED_FLAG]) {
    return mongoose;
  }

  const finalConfig: Required<MongooseInstrumentationConfig> = {
    tracerName: config?.tracerName || DEFAULT_TRACER_NAME,
    dbName: config?.dbName || '',
    captureCollectionName: config?.captureCollectionName ?? true,
    peerName: config?.peerName || '',
    peerPort: config?.peerPort || 0,
  };

  const tracer = trace.getTracer(finalConfig.tracerName);

  // Patch Schema hooks (pre/post) to automatically trace them
  if (mongoose.Schema) {
    patchSchemaHooks(mongoose.Schema, tracer, finalConfig);
  }

  // Patch the Model constructor
  patchModel(mongoose.Model, tracer, finalConfig);

  // Mark as instrumented
  mongoose[INSTRUMENTED_FLAG] = true;

  return mongoose;
}

/**
 * Legacy export for backwards compatibility.
 * @deprecated Use `instrumentMongoose` instead.
 */
export class MongooseInstrumentation {
  private config: MongooseInstrumentationConfig;

  constructor(config?: MongooseInstrumentationConfig) {
    this.config = config || {};
  }

  /**
   * Enables the instrumentation by patching the provided Mongoose instance.
   * @param mongoose - The Mongoose instance to instrument
   */
  enable(mongoose: MongooseLike): void {
    instrumentMongoose(mongoose, this.config);
  }
}
