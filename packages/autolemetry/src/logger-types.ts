/**
 * Shared logger types and interfaces
 */

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  pretty?: boolean;
  /**
   * Paths to redact in logs
   * @default ['*.password', '*.token', '*.secret', '*.key', '*.apikey', '*.api_key']
   */
  redact?: string[] | false;
}

/**
 * Simple logger interface - minimal contract for dependency injection
 *
 * This is the interface used throughout autolemetry. Users can:
 * - Use our createLogger() (returns this interface wrapping Pino)
 * - Use createWinstonLogger() (returns this interface wrapping Winston)
 * - Inject their own implementation (any logger with these 4 methods)
 * - Inject native Pino/Winston directly (they have these methods)
 *
 * Inspired by OpenTelemetry's approach: simple abstraction + user choice
 */
export interface Logger {
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, error?: Error, extra?: Record<string, unknown>): void;
  debug(message: string, extra?: Record<string, unknown>): void;
}

/**
 * Full Pino logger type - for power users who want the complete API
 *
 * If you need child loggers, bindings, level control, etc., you can:
 * 1. Import pino directly: `import pino from 'pino'`
 * 2. Create your own instance
 * 3. Pass it to init() - Pino already implements our Logger interface
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 * import { init } from 'autolemetry'
 *
 * const logger = pino({ ... }) // Full Pino config
 * init({ service: 'my-app', logger })
 * ```
 */

/**
 * Alias for Logger interface (backwards compatibility)
 * @deprecated Use Logger instead
 */
export type ILogger = Logger;

/**
 * Pino logger type - re-exported for convenience
 *
 * Note: This is a type-only export. To use Pino, install it as a peer dependency
 * and import it directly: `import pino from 'pino'`
 *
 * @example
 * ```typescript
 * import pino from 'pino'
 * import type { PinoLogger } from 'autolemetry/logger'
 *
 * const logger: PinoLogger = pino({ ... })
 * ```
 */
// Type-only import - no runtime dependency on pino
export type { Logger as PinoLogger } from 'pino';

export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];
