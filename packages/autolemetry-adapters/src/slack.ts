/**
 * Slack Adapter for autolemetry
 *
 * Send analytics events as notifications to Slack channels via webhooks.
 *
 * Perfect for:
 * - Critical business events (orders, payments, signups)
 * - Real-time alerts for failures
 * - Team notifications for important milestones
 * - Monitoring funnel completions
 *
 * @example Basic usage
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { SlackAdapter } from 'autolemetry-adapters/slack';
 *
 * const analytics = new Analytics('app', {
 *   adapters: [
 *     new SlackAdapter({
 *       webhookUrl: process.env.SLACK_WEBHOOK_URL!,
 *       channel: '#order-events'
 *     })
 *   ]
 * });
 *
 * // Sends to Slack
 * analytics.trackEvent('order.completed', {
 *   orderId: 'ord_123',
 *   userId: 'user_456',
 *   amount: 99.99
 * });
 * ```
 *
 * @example Filter critical events only
 * ```typescript
 * const analytics = new Analytics('app', {
 *   adapters: [
 *     new SlackAdapter({
 *       webhookUrl: process.env.SLACK_WEBHOOK_URL!,
 *       channel: '#alerts',
 *       filter: (payload) => {
 *         // Only send failures and high-value orders
 *         if (payload.type === 'outcome' && payload.outcome === 'failure') {
 *           return true;
 *         }
 *         if (payload.name === 'order.completed' && payload.attributes?.amount > 1000) {
 *           return true;
 *         }
 *         return false;
 *       }
 *     })
 *   ]
 * });
 * ```
 *
 * Setup:
 * 1. Create Slack App: https://api.slack.com/apps
 * 2. Enable Incoming Webhooks
 * 3. Add webhook to workspace
 * 4. Copy webhook URL (https://hooks.slack.com/services/...)
 */

import {
  AnalyticsAdapter,
  type AdapterPayload,
} from './analytics-adapter-base';

export interface SlackAdapterConfig {
  /** Slack webhook URL (https://hooks.slack.com/services/...) */
  webhookUrl: string;

  /** Default channel to post to (optional, overrides webhook default) */
  channel?: string;

  /** Custom username for bot (default: 'Analytics Bot') */
  username?: string;

  /** Custom emoji icon (default: ':chart_with_upwards_trend:') */
  iconEmoji?: string;

  /** Include timestamp in messages (default: true) */
  includeTimestamp?: boolean;

  /** Include event attributes as fields (default: true) */
  includeAttributes?: boolean;

  /** Maximum attributes to show (default: 10) */
  maxAttributeFields?: number;

  /** Filter function - return true to send, false to skip */
  filter?: (payload: AdapterPayload) => boolean;

  /** Enable/disable adapter */
  enabled?: boolean;
}

interface SlackMessage {
  channel?: string;
  username?: string;
  icon_emoji?: string;
  text?: string;
  attachments: SlackAttachment[];
}

interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: SlackField[];
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

export class SlackAdapter extends AnalyticsAdapter {
  readonly name = 'SlackAdapter';
  readonly version = '1.0.0';

  private config: Required<Omit<SlackAdapterConfig, 'channel' | 'filter'>> & {
    channel?: string;
    filter?: (payload: AdapterPayload) => boolean;
  };

  constructor(config: SlackAdapterConfig) {
    super();

    this.config = {
      webhookUrl: config.webhookUrl,
      channel: config.channel,
      username: config.username ?? 'Analytics Bot',
      iconEmoji: config.iconEmoji ?? ':chart_with_upwards_trend:',
      includeTimestamp: config.includeTimestamp ?? true,
      includeAttributes: config.includeAttributes ?? true,
      maxAttributeFields: config.maxAttributeFields ?? 10,
      filter: config.filter,
      enabled: config.enabled ?? true,
    };

    this.enabled = this.config.enabled;

    if (!this.config.webhookUrl) {
      console.error(
        '[SlackAdapter] No webhook URL provided - adapter disabled'
      );
      this.enabled = false;
    }
  }

  protected async sendToDestination(payload: AdapterPayload): Promise<void> {
    // Apply filter if provided
    if (this.config.filter) {
      const filterFn = this.config.filter;
      const shouldInclude = filterFn(payload);
      if (!shouldInclude) {
        return; // Skip this event
      }
    }

    const message = this.formatSlackMessage(payload);

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Slack webhook failed (${response.status}): ${errorText}`
      );
    }
  }

  /**
   * Format analytics payload as Slack message
   */
  private formatSlackMessage(payload: AdapterPayload): SlackMessage {
    const emoji = this.getEventEmoji(payload);
    const color = this.getEventColor(payload);
    const title = `${emoji} ${payload.name}`;

    // Add event type
    const fields: SlackField[] = [
      {
        title: 'Event Type',
        value: this.formatEventType(payload),
        short: true,
      },
    ];

    // Add timestamp if enabled
    if (this.config.includeTimestamp) {
      fields.push({
        title: 'Timestamp',
        value: new Date(payload.timestamp).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        short: true,
      });
    }

    // Add attributes as fields
    if (this.config.includeAttributes && payload.attributes) {
      const attributeFields = this.formatAttributes(payload.attributes);
      fields.push(...attributeFields);
    }

    const attachment: SlackAttachment = {
      color,
      title,
      fields,
      footer: 'Analytics Events',
      footer_icon: 'https://i.imgur.com/QpCKbNL.png',
    };

    // Add Unix timestamp for Slack
    if (this.config.includeTimestamp) {
      attachment.ts = Math.floor(
        new Date(payload.timestamp).getTime() / 1000
      );
    }

    return {
      channel: this.config.channel,
      username: this.config.username,
      icon_emoji: this.config.iconEmoji,
      attachments: [attachment],
    };
  }

  /**
   * Get emoji for event type
   */
  private getEventEmoji(payload: AdapterPayload): string {
    switch (payload.type) {
      case 'outcome': {
        return payload.outcome === 'success' ? '✅' : '❌';
      }
      case 'funnel': {
        return '🔄';
      }
      case 'value': {
        return '📊';
      }
      default: {
        // Use custom emoji for common event patterns
        if (payload.name.includes('order') || payload.name.includes('payment'))
          return '💰';
        if (payload.name.includes('signup') || payload.name.includes('user'))
          return '👤';
        if (payload.name.includes('error') || payload.name.includes('fail'))
          return '⚠️';
        return '📌';
      }
    }
  }

  /**
   * Get Slack attachment color for event type
   */
  private getEventColor(payload: AdapterPayload): string {
    switch (payload.type) {
      case 'outcome': {
        return payload.outcome === 'success' ? 'good' : 'danger';
      } // Green or red
      case 'funnel': {
        return '#3AA3E3';
      } // Blue
      case 'value': {
        return '#764FA5';
      } // Purple
      default: {
        // Custom colors for patterns
        if (payload.name.includes('error') || payload.name.includes('fail'))
          return 'danger';
        if (payload.name.includes('warning')) return 'warning';
        return 'good';
      } // Default green
    }
  }

  /**
   * Format event type for display
   */
  private formatEventType(payload: AdapterPayload): string {
    switch (payload.type) {
      case 'event': {
        return 'Event';
      }
      case 'funnel': {
        return `Funnel: ${payload.step || 'unknown'}`;
      }
      case 'outcome': {
        return `Outcome: ${payload.outcome || 'unknown'}`;
      }
      case 'value': {
        return `Value: ${payload.value ?? 'N/A'}`;
      }
      default: {
        return payload.type;
      }
    }
  }

  /**
   * Format attributes as Slack fields
   */
  private formatAttributes(attributes: Record<string, any>): SlackField[] {
    const fields: SlackField[] = [];
    const entries = Object.entries(attributes);

    // Limit number of fields
    const limit = Math.min(entries.length, this.config.maxAttributeFields);

    for (let i = 0; i < limit; i++) {
      const [key, value] = entries[i];

      // Skip internal/system fields
      if (key.startsWith('_') || key === 'timestamp') continue;

      fields.push({
        title: this.formatFieldName(key),
        value: this.formatFieldValue(value),
        short: true,
      });
    }

    // Add truncation notice if needed
    if (entries.length > this.config.maxAttributeFields) {
      fields.push({
        title: 'Note',
        value: `... and ${entries.length - this.config.maxAttributeFields} more fields`,
        short: false,
      });
    }

    return fields;
  }

  /**
   * Format field name (convert camelCase to Title Case)
   */
  private formatFieldName(name: string): string {
    return name
      .replaceAll(/([A-Z])/g, ' $1') // Add space before capitals
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  }

  /**
   * Format field value
   */
  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number' && !Number.isInteger(value)) {
      return value.toFixed(2);
    }
    return String(value);
  }

  /**
   * Handle errors (override from AnalyticsAdapter)
   */
  protected handleError(error: Error, payload: AdapterPayload): void {
    console.error(
      `[SlackAdapter] Failed to send ${payload.type} event "${payload.name}":`,
      error
    );
  }
}
