/**
 * PostHog Adapter - Complete Feature Showcase
 *
 * This example demonstrates all PostHog adapter capabilities:
 * - Basic event tracking
 * - Feature flags and A/B testing
 * - Person and group analytics (B2B SaaS)
 * - Serverless configuration
 * - Custom client injection
 * - Error handling
 *
 * Install dependencies:
 * ```bash
 * pnpm add autolemetry autolemetry-adapters posthog-node
 * ```
 */

import { Analytics } from 'autolemetry/analytics';
import { PostHogAdapter } from 'autolemetry-adapters/posthog';
import { PostHog } from 'posthog-node';

// ============================================================================
// Example 1: Basic Event Tracking
// ============================================================================

async function basicEventTracking() {
  const analytics = new Analytics('my-app', {
    adapters: [
      new PostHogAdapter({
        apiKey: process.env.POSTHOG_API_KEY!,
        host: 'https://us.i.posthog.com', // or 'https://eu.i.posthog.com' for EU cloud
      }),
    ],
  });

  // Track events
  analytics.trackEvent('user.signed_up', {
    userId: 'user-123',
    plan: 'premium',
    source: 'landing_page',
  });

  // Track funnel steps
  analytics.trackFunnelStep('checkout', 'started', {
    userId: 'user-123',
    cartValue: 99.99,
  });

  analytics.trackFunnelStep('checkout', 'completed', {
    userId: 'user-123',
    orderId: 'order-456',
  });

  // Track outcomes
  analytics.trackOutcome('payment.processing', 'success', {
    userId: 'user-123',
    amount: 99.99,
  });

  // Track values/metrics
  analytics.trackValue('revenue', 99.99, {
    userId: 'user-123',
    currency: 'USD',
  });

  await analytics.shutdown();
}

// ============================================================================
// Example 2: Feature Flags and A/B Testing
// ============================================================================

async function featureFlagsExample() {
  const adapter = new PostHogAdapter({
    apiKey: process.env.POSTHOG_API_KEY!,
  });

  const userId = 'user-123';

  // Check if a feature is enabled (boolean)
  const hasNewCheckout = await adapter.isFeatureEnabled('new-checkout', userId);

  if (hasNewCheckout) {
    console.log('Show new checkout UI');
  } else {
    console.log('Show old checkout UI');
  }

  // Get feature flag value (for multivariate tests)
  const experimentVariant = await adapter.getFeatureFlag('pricing-experiment', userId);

  switch (experimentVariant) {
    case 'control': {
      console.log('Show $99/month price');
      break;
    }
    case 'test-1': {
      console.log('Show $89/month price');
      break;
    }
    case 'test-2': {
      console.log('Show $79/month price');
      break;
    }
    default: {
      console.log('User not in experiment');
    }
  }

  // Get all flags for a user (useful for client-side rendering)
  const allFlags = await adapter.getAllFlags(userId);
  console.log('All feature flags:', allFlags);
  // { 'new-checkout': true, 'pricing-experiment': 'test-1', ... }

  // Feature flags with person properties
  const isPremiumFeatureEnabled = await adapter.getFeatureFlag('premium-analytics', userId, {
    personProperties: {
      plan: 'premium',
      signupDate: '2025-01-01',
    },
  });
  console.log('Premium analytics enabled:', isPremiumFeatureEnabled);

  // Feature flags with group context (for B2B features)
  const isBetaEnabled = await adapter.isFeatureEnabled('beta-features', userId, {
    groups: { company: 'acme-corp' },
    groupProperties: {
      company: {
        plan: 'enterprise',
        employees: 500,
      },
    },
  });
  console.log('Beta features enabled:', isBetaEnabled);

  // Reload feature flags from server (without restarting)
  await adapter.reloadFeatureFlags();

  await adapter.shutdown();
}

// ============================================================================
// Example 3: Person and Group Analytics (B2B SaaS)
// ============================================================================

async function personAndGroupAnalytics() {
  const adapter = new PostHogAdapter({
    apiKey: process.env.POSTHOG_API_KEY!,
  });

  // Identify a user and set their properties
  await adapter.identify('user-123', {
    $set: {
      email: 'user@acme-corp.com',
      name: 'John Doe',
      plan: 'premium',
      company: 'Acme Corporation',
    },
  });

  // Set properties only once (won't update if already exists)
  await adapter.identify('user-123', {
    $set_once: {
      signup_date: '2025-01-17',
      first_utm_source: 'google',
    },
  });

  // Identify a group (e.g., company/organization)
  await adapter.groupIdentify('company', 'acme-corp', {
    $set: {
      name: 'Acme Corporation',
      industry: 'SaaS',
      employees: 500,
      plan: 'enterprise',
      mrr: 50_000,
    },
  });

  // Track events with group context
  await adapter.trackEventWithGroups(
    'feature.used',
    {
      userId: 'user-123',
      feature: 'advanced-analytics',
    },
    {
      company: 'acme-corp',
      team: 'engineering',
    },
  );

  // This allows you to:
  // 1. Analyze usage by company/team in PostHog
  // 2. Enable features for specific companies
  // 3. Track company-level metrics

  await adapter.shutdown();
}

// ============================================================================
// Example 4: Serverless Configuration (AWS Lambda, Vercel, Cloudflare)
// ============================================================================

async function serverlessConfiguration() {
  // For serverless environments, optimize for immediate sending
  const adapter = new PostHogAdapter({
    apiKey: process.env.POSTHOG_API_KEY!,

    // Send events immediately (don't batch)
    flushAt: 1,

    // Disable interval-based flushing
    flushInterval: 0,

    // Reduce request timeout for faster function execution
    requestTimeout: 3000,

    // Disable geoip lookup to reduce request size
    disableGeoip: true,
  });

  // In a Lambda handler:
  // exports.handler = async (event) => {
  //   const analytics = new Analytics('my-lambda', {
  //     adapters: [adapter]
  //   });
  //
  //   analytics.trackEvent('lambda.invoked', { userId: event.userId });
  //
  //   // IMPORTANT: Always call shutdown in serverless!
  //   // This ensures events are flushed before function terminates
  //   await analytics.shutdown();
  //
  //   return { statusCode: 200 };
  // }

  await adapter.shutdown();
}

// ============================================================================
// Example 5: Custom PostHog Client
// ============================================================================

async function customClientExample() {
  // Create your own PostHog client with custom configuration
  const customClient = new PostHog(process.env.POSTHOG_API_KEY!, {
    host: 'https://eu.i.posthog.com',
    flushAt: 10,
    flushInterval: 5000,
    requestTimeout: 10_000,
    // Any other PostHog client options...
  });

  // Pass the custom client to the adapter
  const adapter = new PostHogAdapter({
    client: customClient,
  });

  // Now you can use the adapter with your custom client configuration
  const analytics = new Analytics('my-app', {
    adapters: [adapter],
  });

  analytics.trackEvent('custom.event', { userId: 'user-123' });

  await analytics.shutdown();
}

// ============================================================================
// Example 6: Error Handling and Debugging
// ============================================================================

async function errorHandlingExample() {
  const adapter = new PostHogAdapter({
    apiKey: process.env.POSTHOG_API_KEY!,

    // Enable debug logging
    debug: true,

    // Custom error handler
    onError: (error) => {
      console.error('PostHog error:', error);

      // Send to your error tracking service
      // Sentry.captureException(error);
      // or
      // logger.error('PostHog error', { error });
    },
  });

  const analytics = new Analytics('my-app', {
    adapters: [adapter],
  });

  // If PostHog API is down, errors will be caught and logged
  // but won't crash your application
  analytics.trackEvent('test.event', { userId: 'user-123' });

  await analytics.shutdown();
}

// ============================================================================
// Example 7: Complete B2B SaaS Example
// ============================================================================

async function completeSaaSExample() {
  const adapter = new PostHogAdapter({
    apiKey: process.env.POSTHOG_API_KEY!,
    onError: (error) => console.error('PostHog error:', error),
  });

  const analytics = new Analytics('my-saas-app', {
    adapters: [adapter],
  });

  const userId = 'user-123';
  const companyId = 'acme-corp';

  // 1. User signs up
  await adapter.identify(userId, {
    $set: {
      email: 'john@acme-corp.com',
      name: 'John Doe',
      role: 'Admin',
    },
    $set_once: {
      signup_date: new Date().toISOString(),
    },
  });

  analytics.trackEvent('user.signed_up', {
    userId,
    plan: 'trial',
  });

  // 2. Identify the company
  await adapter.groupIdentify('company', companyId, {
    $set: {
      name: 'Acme Corporation',
      plan: 'trial',
      employees: 50,
    },
  });

  // 3. Check if company has access to beta features
  const hasBetaAccess = await adapter.isFeatureEnabled('beta-features', userId, {
    groups: { company: companyId },
  });

  if (hasBetaAccess) {
    // 4. Track feature usage with company context
    await adapter.trackEventWithGroups(
      'beta_feature.used',
      {
        userId,
        feature: 'advanced-analytics',
      },
      { company: companyId },
    );
  }

  // 5. User upgrades to premium
  await adapter.identify(userId, {
    $set: { plan: 'premium' },
  });

  await adapter.groupIdentify('company', companyId, {
    $set: {
      plan: 'premium',
      upgraded_at: new Date().toISOString(),
    },
  });

  analytics.trackOutcome('upgrade.flow', 'success', {
    userId,
    plan: 'premium',
    amount: 99.99,
  });

  analytics.trackValue('revenue', 99.99, {
    userId,
    plan: 'premium',
  });

  await analytics.shutdown();
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('PostHog Adapter Examples\n');

  // Uncomment the examples you want to run:
  // await basicEventTracking();
  // await featureFlagsExample();
  // await personAndGroupAnalytics();
  // await serverlessConfiguration();
  // await customClientExample();
  // await errorHandlingExample();
  // await completeSaaSExample();

  console.log('\nExamples completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicEventTracking,
  featureFlagsExample,
  personAndGroupAnalytics,
  serverlessConfiguration,
  customClientExample,
  errorHandlingExample,
  completeSaaSExample,
};
