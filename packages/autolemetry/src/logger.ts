/**
 * Logger module - re-exports from split files for tree-shaking
 *
 * Structure:
 * - logger-types.ts: Shared interfaces (Logger, LoggerConfig)
 * - logger-pino.ts: Pino implementation (createLogger)
 * - logger-winston.ts: Winston implementation (createWinstonLogger)
 * - logger.ts: Re-exports + LoggedOperation decorator
 *
 * This ensures Winston users don't import Pino code and vice versa.
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { getConfig } from './config';

// Tree-shakeable: types have no runtime cost
export type {
  Logger,
  LoggerConfig,
  ILogger,
  PinoLogger,
  LogLevel,
} from './logger-types';
export { LOG_LEVEL } from './logger-types';

// Tree-shakeable: unused implementations are eliminated from bundles
export { createLogger } from './logger-pino';
export { createWinstonLogger } from './logger-winston';

// Decorator imports only the Logger interface (no pino or winston code)

export interface LoggedOperationOptions {
  /** Operation name for tracing (e.g., 'user.createUser') */
  operationName: string;
}

/**
 * TS5+ Standard Decorator for logging and tracing operations
 * Uses TC39 Stage 3 decorator syntax
 *
 * This is the traditional per-method decorator approach.
 * For zero-boilerplate solution, see @Instrumented class decorator.
 *
 * @example
 * // Simple usage
 * class OrderService {
 *   constructor(private readonly deps: { log: Logger }) {}
 *
 *   @LoggedOperation('order.create')
 *   async createOrder(data: CreateOrderData) {
 *     this.deps.logger.info('Creating order', data)
 *   }
 * }
 *
 * // Advanced usage (future-proof for options)
 * @LoggedOperation({ operationName: 'order.create' })
 * async createOrder(data: CreateOrderData) { }
 */
export function LoggedOperation(
  operationNameOrOptions: string | LoggedOperationOptions,
) {
  const operationName =
    typeof operationNameOrOptions === 'string'
      ? operationNameOrOptions
      : operationNameOrOptions.operationName;

  return function <This, Args extends unknown[], Return>(
    originalMethod: (this: This, ...args: Args) => Promise<Return>,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Promise<Return>
    >,
  ) {
    const methodName = String(context.name);

    return async function (this: This, ...args: Args): Promise<Return> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (this as any).deps?.log;
      const startTime = performance.now();

      const config = getConfig();
      const tracer = config.tracer;

      return tracer.startActiveSpan(operationName, async (span) => {
        try {
          log?.info('Operation started', {
            operation: operationName,
            method: methodName,
            args,
          });

          const result = await originalMethod.apply(this, args);

          const duration = performance.now() - startTime;
          log?.info('Operation completed', {
            operation: operationName,
            method: methodName,
            duration,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          span.setAttributes({
            'operation.name': operationName,
            'operation.method': methodName,
            'operation.duration': duration,
            'operation.success': true,
          });

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;
          log?.error(
            'Operation failed',
            error instanceof Error ? error : undefined,
            { operation: operationName, method: methodName, duration },
          );

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          span.setAttributes({
            'operation.name': operationName,
            'operation.method': methodName,
            'operation.duration': duration,
            'operation.success': false,
            'error.type':
              error instanceof Error ? error.constructor.name : 'Unknown',
          });

          throw error;
        } finally {
          span.end();
        }
      });
    };
  };
}
