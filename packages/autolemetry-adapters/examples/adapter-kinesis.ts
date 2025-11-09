/**
 * AWS Kinesis Streaming Adapter Example
 *
 * Production-ready Kinesis adapter for AWS-native event streaming.
 *
 * Installation:
 * ```bash
 * pnpm add @aws-sdk/client-kinesis
 * ```
 *
 * Features:
 * - Shard-based partitioning for ordered delivery
 * - Automatic retries with exponential backoff
 * - Backpressure handling (ProvisionedThroughputExceeded)
 * - Batch sending (up to 500 records per PutRecords call)
 * - CloudWatch metrics integration ready
 * - Graceful shutdown
 *
 * Setup:
 * ```bash
 * # Create Kinesis stream
 * aws kinesis create-stream \
 *   --stream-name analytics-events \
 *   --shard-count 10
 *
 * # Wait for stream to become active
 * aws kinesis wait stream-exists \
 *   --stream-name analytics-events
 * ```
 *
 * Usage:
 * ```typescript
 * import { Analytics } from 'autolemetry/analytics';
 * import { KinesisAdapter } from './adapter-kinesis';
 *
 * const analytics = new Analytics('app', {
 *   adapters: [
 *     new KinesisAdapter({
 *       streamName: 'analytics-events',
 *       region: 'us-east-1',
 *       partitionStrategy: 'userId',
 *       maxBufferSize: 10000,
 *       maxBatchSize: 500, // Kinesis max per PutRecords
 *       bufferOverflowStrategy: 'block'
 *     })
 *   ]
 * });
 *
 * // Events partitioned by userId
 * await analytics.trackEvent('order.completed', {
 *   userId: 'user_123',
 *   amount: 99.99
 * });
 * ```
 */

import {
  StreamingAnalyticsAdapter,
  type BufferOverflowStrategy,
} from '../src/streaming-analytics-adapter';
import type { AdapterPayload } from '../src/analytics-adapter-base';
import {
  KinesisClient,
  PutRecordsCommand,
  type PutRecordsRequestEntry,
  type PutRecordsCommandOutput,
} from '@aws-sdk/client-kinesis';

type PartitionStrategy = 'userId' | 'tenantId' | 'eventType' | 'random';

export interface KinesisAdapterConfig {
  /** Kinesis stream name */
  streamName: string;

  /** AWS region (default: 'us-east-1') */
  region?: string;

  /** Partitioning strategy (default: 'userId') */
  partitionStrategy?: PartitionStrategy;

  /** Enable/disable adapter */
  enabled?: boolean;

  /** Maximum buffer size (default: 10000) */
  maxBufferSize?: number;

  /** Maximum batch size - Kinesis allows max 500 per PutRecords (default: 500) */
  maxBatchSize?: number;

  /** Buffer overflow strategy (default: 'block') */
  bufferOverflowStrategy?: BufferOverflowStrategy;

  /** Flush interval in ms (default: 1000) */
  flushIntervalMs?: number;

  /** AWS credentials (optional, uses default credential chain if not provided) */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };

  /** Max retries for throttling (default: 5) */
  maxRetries?: number;
}

export class KinesisAdapter extends StreamingAnalyticsAdapter {
  readonly name = 'KinesisAdapter';
  readonly version = '1.0.0';

  private client: KinesisClient;
  private adapterConfig: Required<Omit<KinesisAdapterConfig, 'credentials'>> & {
    credentials?: KinesisAdapterConfig['credentials'];
  };

  constructor(config: KinesisAdapterConfig) {
    super({
      maxBufferSize: config.maxBufferSize ?? 10_000,
      maxBatchSize: Math.min(config.maxBatchSize ?? 500, 500), // Kinesis max is 500
      bufferOverflowStrategy: config.bufferOverflowStrategy ?? 'block',
      flushIntervalMs: config.flushIntervalMs ?? 1000,
    });

    // Set config defaults
    this.adapterConfig = {
      streamName: config.streamName,
      region: config.region ?? 'us-east-1',
      partitionStrategy: config.partitionStrategy ?? 'userId',
      enabled: config.enabled ?? true,
      maxBufferSize: config.maxBufferSize ?? 10_000,
      maxBatchSize: Math.min(config.maxBatchSize ?? 500, 500),
      bufferOverflowStrategy: config.bufferOverflowStrategy ?? 'block',
      flushIntervalMs: config.flushIntervalMs ?? 1000,
      maxRetries: config.maxRetries ?? 5,
      credentials: config.credentials,
    };

    this.enabled = this.adapterConfig.enabled;

    if (this.enabled) {
      this.initializeKinesis();
    }
  }

  private initializeKinesis(): void {
    try {
      this.client = new KinesisClient({
        region: this.adapterConfig.region,
        credentials: this.adapterConfig.credentials,
        maxAttempts: this.adapterConfig.maxRetries,
      });

      console.log('[KinesisAdapter] Initialized successfully');
    } catch (error) {
      console.error('[KinesisAdapter] Failed to initialize:', error);
      this.enabled = false;
    }
  }

  /**
   * Get partition key based on configured strategy
   *
   * Kinesis uses partition key for shard assignment and ordering.
   * Events with same partition key go to same shard (ordered).
   */
  protected getPartitionKey(payload: AdapterPayload): string {
    switch (this.adapterConfig.partitionStrategy) {
      case 'userId': {
        return payload.attributes?.userId?.toString() || 'default';
      }

      case 'tenantId': {
        return payload.attributes?.tenantId?.toString() || 'default';
      }

      case 'eventType': {
        return payload.type;
      } // 'event', 'funnel', 'outcome', 'value'

      case 'random': {
        // Random partition key for even distribution across shards
        return Math.random().toString(36).slice(7);
      }

      default: {
        return 'default';
      }
    }
  }

  /**
   * Send batch of events to Kinesis
   */
  protected async sendBatch(events: AdapterPayload[]): Promise<void> {
    // Build Kinesis records
    const records: PutRecordsRequestEntry[] = events.map((event) => ({
      Data: Buffer.from(JSON.stringify(event)),
      PartitionKey: this.getPartitionKey(event),
    }));

    // Send to Kinesis with retry logic
    await this.sendWithRetry(records);
  }

  /**
   * Send records to Kinesis with exponential backoff retry
   */
  private async sendWithRetry(
    records: PutRecordsRequestEntry[],
    attempt = 1
  ): Promise<void> {
    try {
      const command = new PutRecordsCommand({
        StreamName: this.adapterConfig.streamName,
        Records: records,
      });

      const result: PutRecordsCommandOutput = await this.client.send(command);

      // Check for failed records
      if (result.FailedRecordCount && result.FailedRecordCount > 0) {
        const failedRecords: PutRecordsRequestEntry[] = [];

        if (result.Records) for (const [index, record] of result.Records.entries()) {
          if (record.ErrorCode) {
            console.error(
              `[KinesisAdapter] Record ${index} failed: ${record.ErrorCode} - ${record.ErrorMessage}`
            );
            failedRecords.push(records[index]);
          }
        }

        // Retry failed records
        if (failedRecords.length > 0 && attempt < this.adapterConfig.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
          console.warn(
            `[KinesisAdapter] Retrying ${failedRecords.length} failed records (attempt ${attempt}) after ${backoffMs}ms`
          );

          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          await this.sendWithRetry(failedRecords, attempt + 1);
        } else if (failedRecords.length > 0) {
          throw new Error(
            `Failed to send ${failedRecords.length} records after ${this.adapterConfig.maxRetries} attempts`
          );
        }
      }

      // Success - log metrics
      if (process.env.DEBUG) {
        console.log(
          `[KinesisAdapter] Sent ${records.length} records successfully`
        );
      }
    } catch (error: any) {
      // Handle specific Kinesis errors
      if (error.name === 'ProvisionedThroughputExceededException') {
        console.error(
          '[KinesisAdapter] Provisioned throughput exceeded - consider increasing shard count or reducing rate'
        );

        // Backpressure: Wait before retry
        if (attempt < this.adapterConfig.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30_000);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          await this.sendWithRetry(records, attempt + 1);
          return;
        }
      }

      if (error.name === 'ResourceNotFoundException') {
        console.error(
          `[KinesisAdapter] Stream not found: ${this.adapterConfig.streamName}`
        );
      }

      throw error;
    }
  }

  /**
   * Handle errors (override from AnalyticsAdapter)
   */
  protected handleError(error: Error, payload: AdapterPayload): void {
    console.error(
      `[KinesisAdapter] Failed to process ${payload.type} event:`,
      error,
      {
        eventName: payload.name,
        partitionKey: this.getPartitionKey(payload),
        streamName: this.adapterConfig.streamName,
      }
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[KinesisAdapter] Starting graceful shutdown...');

    // Flush buffer and drain pending requests
    await super.shutdown();

    // Kinesis client doesn't need explicit disconnect
    console.log('[KinesisAdapter] Shutdown complete');
  }
}
