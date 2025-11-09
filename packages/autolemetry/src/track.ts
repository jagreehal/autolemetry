/**
 * Global track() function for business analytics
 *
 * Simple, no instantiation needed, auto-attaches trace context
 */

import { trace } from '@opentelemetry/api';
import { AnalyticsQueue } from './analytics-queue';
import {
  getConfig,
  warnIfNotInitialized,
  isInitialized,
  getValidationConfig,
} from './init';
import { validateEvent } from './validation';

// Global analytics queue (initialized on first track call)
let analyticsQueue: AnalyticsQueue | null = null;

/**
 * Initialize analytics queue lazily
 */
function getOrCreateQueue(): AnalyticsQueue | null {
  if (!isInitialized()) {
    warnIfNotInitialized('track()');
    return null;
  }

  if (!analyticsQueue) {
    const config = getConfig();
    if (!config?.adapters || config.adapters.length === 0) {
      // No adapters configured - no-op
      return null;
    }

    analyticsQueue = new AnalyticsQueue(config.adapters);
  }

  return analyticsQueue;
}

/**
 * Track a business analytics event
 *
 * Features:
 * - Auto-attaches traceId and spanId if in active span
 * - Batched sending with retry
 * - Type-safe with optional generic
 * - No-op if init() not called or no adapters configured
 *
 * @example Basic usage
 * ```typescript
 * track('user.signup', { userId: '123', plan: 'pro' })
 * ```
 *
 * @example With type safety
 * ```typescript
 * interface AnalyticsEvents {
 *   'user.signup': { userId: string; plan: string }
 *   'plan.upgraded': { userId: string; revenue: number }
 * }
 *
 * track<AnalyticsEvents>('user.signup', { userId: '123', plan: 'pro' })
 * ```
 *
 * @example Trace correlation (automatic)
 * ```typescript
 * @Instrumented()
 * class UserService {
 *   async createUser(data: CreateUserData) {
 *     // This track call automatically includes traceId + spanId
 *     track('user.signup', { userId: data.id })
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function track<Events extends Record<string, any> = Record<string, any>>(
  event: keyof Events & string,
  data?: Events[typeof event],
): void {
  const queue = getOrCreateQueue();
  if (!queue) return; // No-op if not initialized or no adapters

  // Validate and sanitize input (with custom config if provided)
  const validationConfig = getValidationConfig();
  const validated = validateEvent(event, data, validationConfig || undefined);

  // Auto-attach trace context if available (free win!)
  const span = trace.getActiveSpan();
  const enrichedData = span
    ? {
        ...validated.attributes,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      }
    : validated.attributes;

  queue.enqueue({
    name: validated.eventName,
    attributes: enrichedData,
    timestamp: Date.now(),
  });
}

/**
 * Get analytics queue (for flush/shutdown)
 * @internal
 */
export function getAnalyticsQueue(): AnalyticsQueue | null {
  return analyticsQueue;
}

/**
 * Reset analytics queue (for shutdown/cleanup)
 * @internal
 */
export function resetAnalyticsQueue(): void {
  analyticsQueue = null;
}
