/**
 * PostHog Adapter for autolemetry
 *
 * Send analytics to PostHog for product analytics, feature flags, and A/B testing.
 *
 * @example Basic usage
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { PostHogAdapter } from 'autolemetry-adapters/posthog';
 *
 * const analytics = new Analytics('checkout', {
 *   adapters: [
 *     new PostHogAdapter({
 *       apiKey: process.env.POSTHOG_API_KEY!,
 *       host: 'https://us.i.posthog.com' // optional, defaults to US cloud
 *     })
 *   ]
 * });
 *
 * // Analytics go to both OpenTelemetry AND PostHog
 * analytics.trackEvent('order.completed', { userId: '123', amount: 99.99 });
 * ```
 *
 * @example Feature flags
 * ```typescript
 * const adapter = new PostHogAdapter({ apiKey: 'phc_...' });
 *
 * // Check if feature is enabled
 * const isEnabled = await adapter.isFeatureEnabled('new-checkout', 'user-123');
 *
 * // Get feature flag value (string, boolean, number)
 * const variant = await adapter.getFeatureFlag('experiment-variant', 'user-123');
 *
 * // Get all flags for a user
 * const allFlags = await adapter.getAllFlags('user-123');
 * ```
 *
 * @example Person and group analytics
 * ```typescript
 * // Identify user and set properties
 * await adapter.identify('user-123', {
 *   email: 'user@example.com',
 *   plan: 'premium'
 * });
 *
 * // Identify a group (e.g., organization)
 * await adapter.groupIdentify('company', 'acme-corp', {
 *   industry: 'saas',
 *   employees: 500
 * });
 * ```
 *
 * @example Serverless configuration
 * ```typescript
 * // Optimized for AWS Lambda / Vercel Functions
 * const adapter = new PostHogAdapter({
 *   apiKey: 'phc_...',
 *   flushAt: 1,        // Send immediately (don't batch)
 *   flushInterval: 0,  // Disable interval-based flushing
 * });
 * ```
 *
 * @example Custom PostHog client
 * ```typescript
 * import { PostHog } from 'posthog-node';
 *
 * const customClient = new PostHog('phc_...', {
 *   host: 'https://eu.i.posthog.com',
 *   // ... other PostHog options
 * });
 *
 * const adapter = new PostHogAdapter({
 *   client: customClient
 * });
 * ```
 *
 * @example Error handling
 * ```typescript
 * const adapter = new PostHogAdapter({
 *   apiKey: 'phc_...',
 *   onError: (error) => {
 *     console.error('PostHog error:', error);
 *     // Send to error tracking service
 *   }
 * });
 * ```
 */

import type { EventAttributes } from 'autolemetry/analytics-adapter';
import { AnalyticsAdapter, type AdapterPayload } from './analytics-adapter-base';

// Type-only import to avoid runtime dependency
import type { PostHog } from 'posthog-node';

export interface PostHogConfig {
  /** PostHog API key (starts with phc_) - required if not providing custom client */
  apiKey?: string;

  /** PostHog host (defaults to US cloud) */
  host?: string;

  /** Enable/disable the adapter */
  enabled?: boolean;

  /** Custom PostHog client instance (bypasses apiKey/host) */
  client?: PostHog;

  // Serverless optimizations
  /** Flush batch when it reaches this size (default: 20, set to 1 for immediate send) */
  flushAt?: number;

  /** Flush interval in milliseconds (default: 10000, set to 0 to disable) */
  flushInterval?: number;

  // Performance tuning
  /** Disable geoip lookup to reduce request size (default: false) */
  disableGeoip?: boolean;

  /** Request timeout in milliseconds (default: 10000) */
  requestTimeout?: number;

  /** Send feature flag evaluation events (default: true) */
  sendFeatureFlags?: boolean;

  // Error handling
  /** Error callback for debugging and monitoring */
  onError?: (error: Error) => void;

  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * PostHog feature flag options
 */
export interface FeatureFlagOptions {
  /** Group context for group-based feature flags */
  groups?: Record<string, string | number>;

  /** Group properties for feature flag evaluation */
  groupProperties?: Record<string, Record<string, any>>;

  /** Person properties for feature flag evaluation */
  personProperties?: Record<string, any>;

  /** Only evaluate locally, don't send $feature_flag_called event */
  onlyEvaluateLocally?: boolean;

  /** Send feature flag events even if disabled globally */
  sendFeatureFlagEvents?: boolean;
}

/**
 * Person properties for identify calls
 */
export interface PersonProperties {
  /** Set properties (will update existing values) */
  $set?: Record<string, any>;

  /** Set properties only if they don't exist */
  $set_once?: Record<string, any>;

  /** Any custom properties */
  [key: string]: any;
}

export class PostHogAdapter extends AnalyticsAdapter {
  readonly name = 'PostHogAdapter';
  readonly version = '2.0.0';

  private posthog: PostHog | null = null;
  private config: PostHogConfig;
  private initPromise: Promise<void> | null = null;

  constructor(config: PostHogConfig) {
    super();

    if (!config.apiKey && !config.client) {
      throw new Error('PostHogAdapter requires either apiKey or client to be provided');
    }

    this.enabled = config.enabled ?? true;
    this.config = config;

    if (this.enabled) {
      // Start initialization immediately but don't block constructor
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {
      // Use custom client if provided
      if (this.config.client) {
        this.posthog = this.config.client;
        this.setupErrorHandling();
        return;
      }

      // Dynamic import to avoid adding posthog-node as a hard dependency
      const { PostHog } = await import('posthog-node');

      this.posthog = new PostHog(this.config.apiKey!, {
        host: this.config.host || 'https://us.i.posthog.com',
        flushAt: this.config.flushAt,
        flushInterval: this.config.flushInterval,
        requestTimeout: this.config.requestTimeout,
        disableGeoip: this.config.disableGeoip,
        sendFeatureFlagEvent: this.config.sendFeatureFlags,
      });

      this.setupErrorHandling();
    } catch (error) {
      console.error(
        'PostHog adapter failed to initialize. Install posthog-node: pnpm add posthog-node',
        error,
      );
      this.enabled = false;
      this.config.onError?.(error as Error);
    }
  }

  private setupErrorHandling(): void {
    if (this.config.debug) {
      this.posthog?.debug();
    }

    if (this.config.onError && this.posthog?.on) {
      this.posthog.on('error', this.config.onError);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  private extractDistinctId(attributes?: EventAttributes): string {
    return (attributes?.userId || attributes?.user_id || 'anonymous') as string;
  }

  /**
   * Send payload to PostHog
   */
  protected async sendToDestination(payload: AdapterPayload): Promise<void> {
    await this.ensureInitialized();

    // Build properties object, including value if present
    let properties: any = payload.attributes;
    if (payload.value !== undefined) {
      properties = { ...payload.attributes, value: payload.value };
    }

    // Build PostHog capture payload
    const capturePayload: any = {
      distinctId: this.extractDistinctId(payload.attributes),
      event: payload.name,
      properties,
    };

    // Add groups if present in attributes
    if (payload.attributes?.groups) {
      capturePayload.groups = payload.attributes.groups;
    }

    this.posthog?.capture(capturePayload);
  }

  // Feature Flag Methods

  /**
   * Check if a feature flag is enabled for a user
   *
   * @param flagKey - Feature flag key
   * @param distinctId - User ID or anonymous ID
   * @param options - Feature flag evaluation options
   * @returns true if enabled, false otherwise
   *
   * @example
   * ```typescript
   * const isEnabled = await adapter.isFeatureEnabled('new-checkout', 'user-123');
   *
   * // With groups
   * const isEnabled = await adapter.isFeatureEnabled('beta-features', 'user-123', {
   *   groups: { company: 'acme-corp' }
   * });
   * ```
   */
  async isFeatureEnabled(
    flagKey: string,
    distinctId: string,
    options?: FeatureFlagOptions,
  ): Promise<boolean> {
    if (!this.enabled) return false;
    await this.ensureInitialized();

    try {
      return await this.posthog?.isFeatureEnabled(flagKey, distinctId, options as any) ?? false;
    } catch (error) {
      this.config.onError?.(error as Error);
      return false;
    }
  }

  /**
   * Get feature flag value for a user
   *
   * @param flagKey - Feature flag key
   * @param distinctId - User ID or anonymous ID
   * @param options - Feature flag evaluation options
   * @returns Flag value (string, boolean, or undefined)
   *
   * @example
   * ```typescript
   * const variant = await adapter.getFeatureFlag('experiment-variant', 'user-123');
   * // Returns: 'control' | 'test' | 'test-2' | undefined
   *
   * // With person properties
   * const variant = await adapter.getFeatureFlag('premium-feature', 'user-123', {
   *   personProperties: { plan: 'premium' }
   * });
   * ```
   */
  async getFeatureFlag(
    flagKey: string,
    distinctId: string,
    options?: FeatureFlagOptions,
  ): Promise<string | boolean | undefined> {
    if (!this.enabled) return undefined;
    await this.ensureInitialized();

    try {
      return await this.posthog?.getFeatureFlag(flagKey, distinctId, options as any);
    } catch (error) {
      this.config.onError?.(error as Error);
      return undefined;
    }
  }

  /**
   * Get all feature flags for a user
   *
   * @param distinctId - User ID or anonymous ID
   * @param options - Feature flag evaluation options
   * @returns Object mapping flag keys to their values
   *
   * @example
   * ```typescript
   * const flags = await adapter.getAllFlags('user-123');
   * // Returns: { 'new-checkout': true, 'experiment-variant': 'test', ... }
   * ```
   */
  async getAllFlags(
    distinctId: string,
    options?: FeatureFlagOptions,
  ): Promise<Record<string, string | number | boolean>> {
    if (!this.enabled) return {};
    await this.ensureInitialized();

    try {
      const flags = await this.posthog?.getAllFlags(distinctId, options as any);
      return flags ?? {};
    } catch (error) {
      this.config.onError?.(error as Error);
      return {};
    }
  }

  /**
   * Reload feature flags from PostHog server
   *
   * Call this to refresh feature flag definitions without restarting.
   *
   * @example
   * ```typescript
   * await adapter.reloadFeatureFlags();
   * ```
   */
  async reloadFeatureFlags(): Promise<void> {
    if (!this.enabled) return;
    await this.ensureInitialized();

    try {
      await this.posthog?.reloadFeatureFlags();
    } catch (error) {
      this.config.onError?.(error as Error);
    }
  }

  // Person and Group Analytics

  /**
   * Identify a user and set their properties
   *
   * @param distinctId - User ID
   * @param properties - Person properties ($set, $set_once, or custom properties)
   *
   * @example
   * ```typescript
   * // Set properties (will update existing values)
   * await adapter.identify('user-123', {
   *   $set: {
   *     email: 'user@example.com',
   *     plan: 'premium'
   *   }
   * });
   *
   * // Set properties only once (won't update if already exists)
   * await adapter.identify('user-123', {
   *   $set_once: {
   *     signup_date: '2025-01-17'
   *   }
   * });
   * ```
   */
  async identify(distinctId: string, properties?: PersonProperties): Promise<void> {
    if (!this.enabled) return;
    await this.ensureInitialized();

    try {
      this.posthog?.identify({
        distinctId,
        properties,
      });
    } catch (error) {
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Identify a group and set its properties
   *
   * Groups are useful for B2B SaaS to track organizations, teams, or accounts.
   *
   * @param groupType - Type of group (e.g., 'company', 'organization', 'team')
   * @param groupKey - Unique identifier for the group
   * @param properties - Group properties
   *
   * @example
   * ```typescript
   * await adapter.groupIdentify('company', 'acme-corp', {
   *   $set: {
   *     name: 'Acme Corporation',
   *     industry: 'saas',
   *     employees: 500,
   *     plan: 'enterprise'
   *   }
   * });
   * ```
   */
  async groupIdentify(
    groupType: string,
    groupKey: string | number,
    properties?: Record<string, any>,
  ): Promise<void> {
    if (!this.enabled) return;
    await this.ensureInitialized();

    try {
      this.posthog?.groupIdentify({
        groupType,
        groupKey: String(groupKey), // Convert to string for PostHog SDK
        properties,
      });
    } catch (error) {
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Track an event with group context
   *
   * Use this to associate events with groups (e.g., organizations).
   *
   * @param name - Event name
   * @param attributes - Event attributes
   * @param groups - Group context (e.g., { company: 'acme-corp' })
   *
   * @example
   * ```typescript
   * await adapter.trackEventWithGroups('feature.used', {
   *   userId: 'user-123',
   *   feature: 'advanced-analytics'
   * }, {
   *   company: 'acme-corp'
   * });
   * ```
   */
  async trackEventWithGroups(
    name: string,
    attributes?: EventAttributes,
    groups?: Record<string, string | number>,
  ): Promise<void> {
    if (!this.enabled) return;
    await this.ensureInitialized();

    const eventAttributes: EventAttributes = { ...attributes } as EventAttributes;
    if (groups) {
      (eventAttributes as any).groups = groups;
    }

    await this.trackEvent(name, eventAttributes);
  }

  /**
   * Flush pending events and clean up resources
   */
  async shutdown(): Promise<void> {
    await super.shutdown(); // Drain pending requests first
    await this.ensureInitialized();

    if (this.posthog) {
      try {
        await this.posthog.shutdown();
      } catch (error) {
        this.config.onError?.(error as Error);
      }
    }
  }

  /**
   * Handle errors with custom error handler
   */
  protected handleError(error: Error, payload: AdapterPayload): void {
    this.config.onError?.(error);
    super.handleError(error, payload);
  }
}
