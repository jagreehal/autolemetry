/**
 * Testing utilities for Analytics
 *
 * Provides in-memory collection of analytics for testing purposes.
 */

import type {
  EventAttributes,
  FunnelStatus,
  OutcomeStatus,
} from './analytics-adapter';

export interface AnalyticsEvent {
  event: string;
  attributes?: EventAttributes;
  service: string;
  timestamp: number;
}

export interface AnalyticsFunnelStep {
  funnel: string;
  status: FunnelStatus;
  attributes?: EventAttributes;
  service: string;
  timestamp: number;
}

export interface AnalyticsOutcome {
  operation: string;
  status: OutcomeStatus;
  attributes?: EventAttributes;
  service: string;
  timestamp: number;
}

export interface AnalyticsValue {
  metric: string;
  value: number;
  attributes?: EventAttributes;
  service: string;
  timestamp: number;
}

/**
 * In-memory analytics collector for testing
 */
export interface AnalyticsCollector {
  /** Get all collected events */
  getEvents(): AnalyticsEvent[];
  /** Get all collected funnel steps */
  getFunnelSteps(): AnalyticsFunnelStep[];
  /** Get all collected outcomes */
  getOutcomes(): AnalyticsOutcome[];
  /** Get all collected values */
  getValues(): AnalyticsValue[];
  /** Clear all collected analytics */
  clear(): void;
  /** Record an event (internal use) */
  recordEvent(event: AnalyticsEvent): void;
  /** Record a funnel step (internal use) */
  recordFunnelStep(step: AnalyticsFunnelStep): void;
  /** Record an outcome (internal use) */
  recordOutcome(outcome: AnalyticsOutcome): void;
  /** Record a value (internal use) */
  recordValue(value: AnalyticsValue): void;
}

/**
 * Create an in-memory analytics collector for testing
 *
 * @example
 * ```typescript
 * const collector = createAnalyticsCollector()
 *
 * const analytics = new Analytics('test-service', { collector })
 * analytics.trackEvent('application.submitted', { jobId: '123' })
 *
 * const events = collector.getEvents()
 * expect(events).toHaveLength(1)
 * expect(events[0].event).toBe('application.submitted')
 * ```
 */
export function createAnalyticsCollector(): AnalyticsCollector {
  const events: AnalyticsEvent[] = [];
  const funnelSteps: AnalyticsFunnelStep[] = [];
  const outcomes: AnalyticsOutcome[] = [];
  const values: AnalyticsValue[] = [];

  return {
    getEvents(): AnalyticsEvent[] {
      return [...events];
    },

    getFunnelSteps(): AnalyticsFunnelStep[] {
      return [...funnelSteps];
    },

    getOutcomes(): AnalyticsOutcome[] {
      return [...outcomes];
    },

    getValues(): AnalyticsValue[] {
      return [...values];
    },

    clear(): void {
      events.length = 0;
      funnelSteps.length = 0;
      outcomes.length = 0;
      values.length = 0;
    },

    recordEvent(event: AnalyticsEvent): void {
      events.push(event);
    },

    recordFunnelStep(step: AnalyticsFunnelStep): void {
      funnelSteps.push(step);
    },

    recordOutcome(outcome: AnalyticsOutcome): void {
      outcomes.push(outcome);
    },

    recordValue(value: AnalyticsValue): void {
      values.push(value);
    },
  };
}

/**
 * Assert that an analytics event was tracked
 *
 * @example
 * ```typescript
 * assertEventTracked({
 *   collector,
 *   eventName: 'application.submitted',
 *   attributes: { jobId: '123' }
 * })
 * ```
 */
export function assertEventTracked(options: {
  collector: AnalyticsCollector;
  eventName: string;
  attributes?: Record<string, unknown>;
}): void {
  const events = options.collector.getEvents();
  const matching = events.filter((e) => e.event === options.eventName);

  if (matching.length === 0) {
    throw new Error(`No events found with name: ${options.eventName}`);
  }

  if (options.attributes) {
    const matchingWithAttrs = matching.filter((e) =>
      Object.entries(options.attributes!).every(
        ([key, value]) => e.attributes && e.attributes[key] === value,
      ),
    );

    if (matchingWithAttrs.length === 0) {
      throw new Error(
        `Event ${options.eventName} found but attributes don't match: ${JSON.stringify(options.attributes)}`,
      );
    }
  }
}

/**
 * Assert that an outcome was tracked
 *
 * @example
 * ```typescript
 * assertOutcomeTracked({
 *   collector,
 *   operation: 'email.delivery',
 *   status: 'success'
 * })
 * ```
 */
export function assertOutcomeTracked(options: {
  collector: AnalyticsCollector;
  operation: string;
  status: 'success' | 'failure' | 'partial';
}): void {
  const outcomes = options.collector.getOutcomes();
  const matching = outcomes.filter(
    (o) => o.operation === options.operation && o.status === options.status,
  );

  if (matching.length === 0) {
    throw new Error(
      `No outcomes found with operation: ${options.operation} and status: ${options.status}`,
    );
  }
}
