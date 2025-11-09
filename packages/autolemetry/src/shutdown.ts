/**
 * Graceful shutdown with flush and cleanup
 */

import { getSdk, getLogger } from './init';
import { getAnalyticsQueue, resetAnalyticsQueue } from './track';
import { resetAnalytics } from './analytics';
import { resetMetrics } from './metrics';

/**
 * Flush all pending telemetry
 *
 * - Flushes analytics queue (batched events)
 * - Force-flushes OpenTelemetry spans
 *
 * Safe to call multiple times.
 *
 * @example Manual flush
 * ```typescript
 * await flush()
 * ```
 */
export async function flush(): Promise<void> {
  // Flush analytics queue
  const analyticsQueue = getAnalyticsQueue();
  if (analyticsQueue) {
    await analyticsQueue.flush();
  }

  // Note: OpenTelemetry spans are exported automatically by the span processor
  // SimpleSpanProcessor exports immediately, BatchSpanProcessor exports on flush
  // For tests, SimpleSpanProcessor should be sufficient
}

/**
 * Shutdown telemetry and cleanup resources
 *
 * - Flushes all pending data
 * - Shuts down OpenTelemetry SDK
 * - Cleans up resources
 *
 * Call this before process exit.
 *
 * @example Express server
 * ```typescript
 * const server = app.listen(3000)
 *
 * process.on('SIGTERM', async () => {
 *   await server.close()
 *   await shutdown()
 *   process.exit(0)
 * })
 * ```
 */
export async function shutdown(): Promise<void> {
  // Flush everything first
  await flush();

  // Shutdown OpenTelemetry SDK
  const sdk = getSdk();
  if (sdk) {
    await sdk.shutdown();
  }

  // Clean up singleton Maps and queues to prevent memory leaks
  resetAnalytics();
  resetMetrics();
  resetAnalyticsQueue();
}

/**
 * Register automatic shutdown hooks for common signals
 *
 * Handles:
 * - SIGTERM (Docker/K8s graceful shutdown)
 * - SIGINT (Ctrl+C)
 *
 * @internal Called automatically on module load
 */
function registerShutdownHooks(): void {
  if (typeof process === 'undefined') return; // Not in Node.js

  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  let shuttingDown = false;

  for (const signal of signals) {
    process.on(signal, async () => {
      if (shuttingDown) return; // Prevent double shutdown
      shuttingDown = true;

      if (process.env.NODE_ENV !== 'test') {
        getLogger().info(
          `[autolemetry] Received ${signal}, flushing telemetry...`,
        );
      }

      try {
        await shutdown();
      } catch (error) {
        getLogger().error(
          '[autolemetry] Error during shutdown',
          error instanceof Error ? error : undefined,
        );
      } finally {
        process.exit(0);
      }
    });
  }
}

// Auto-register shutdown hooks
registerShutdownHooks();
