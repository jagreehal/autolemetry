/**
 * Autolemetry Plugins - OpenTelemetry instrumentation for ORMs/databases without official support
 *
 * This package provides instrumentation for databases and ORMs that don't have
 * official OpenTelemetry contrib packages. When official packages exist, users
 * should prefer those instead (e.g., @opentelemetry/instrumentation-mongodb).
 *
 * Currently supported:
 * - Drizzle ORM (no official instrumentation available)
 *
 * For other databases/ORMs with official instrumentation:
 * - MongoDB: Use @opentelemetry/instrumentation-mongodb
 * - Mongoose: Use @opentelemetry/instrumentation-mongoose
 * - PostgreSQL: Use @opentelemetry/instrumentation-pg
 * - MySQL: Use @opentelemetry/instrumentation-mysql2
 * - Redis: Use @opentelemetry/instrumentation-redis
 *
 * See: https://github.com/open-telemetry/opentelemetry-js-contrib
 *
 * @example
 * ```typescript
 * // Import Drizzle plugin
 * import { instrumentDrizzleClient } from 'autolemetry-plugins/drizzle';
 *
 * // For MongoDB, use official instrumentation:
 * import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
 * import { init } from 'autolemetry';
 *
 * init({
 *   service: 'my-app',
 *   instrumentations: [new MongoDBInstrumentation()]
 * });
 * ```
 *
 * @packageDocumentation
 */

// Re-export common semantic conventions
export {
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_STATEMENT,
  SEMATTRS_DB_NAME,
  SEMATTRS_NET_PEER_NAME,
  SEMATTRS_NET_PEER_PORT,
} from './common/constants.js';

// Re-export Drizzle plugin
export {
  instrumentDrizzle,
  instrumentDrizzleClient,
  type InstrumentDrizzleConfig,
} from './drizzle/index.js';
