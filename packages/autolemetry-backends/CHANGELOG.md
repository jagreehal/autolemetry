# autolemetry-backends

## 2.0.1

### Patch Changes

- Updated dependencies [53bcbaa]
  - autolemetry@2.1.0

## 2.0.0

### Major Changes

- 955ac09: **BREAKING CHANGES**: Move vendor backends to separate package and align with OpenTelemetry SDK array APIs

  ## Breaking Changes

  ### 1. Move vendor backend configurations to autolemetry-backends package
  - Remove `autolemetry/presets/honeycomb` and `autolemetry/presets/datadog` exports from autolemetry package
  - Vendor backend configurations are now in the new `autolemetry-backends` package

  ### 2. Align with OpenTelemetry SDK's native multi-item support

  Changed `AutolemetryConfig` to use array-based APIs for processors, exporters, and readers, matching OpenTelemetry SDK's recommended patterns:
  - `spanProcessor` → `spanProcessors: SpanProcessor[]`
  - `spanExporter` → `spanExporters: SpanExporter[]`
  - `metricReader` → `metricReaders: MetricReader[]`

  **What changed:**
  - Removed custom `CompositeSpanProcessor` class (~70 lines) - SDK handles this natively
  - Updated `init()` to accept arrays and pass them directly to `NodeSDKConfiguration`
  - Tests and documentation updated to reflect new API

  ## Migration Guide

  ### Backend Package Migration

  Install the new package:

  ```bash
  npm install autolemetry-backends
  ```

  Update imports:

  ```typescript
  // Before
  import { createHoneycombConfig } from 'autolemetry/presets/honeycomb';
  import { createDatadogConfig } from 'autolemetry/presets/datadog';

  // After
  import { createHoneycombConfig } from 'autolemetry-backends/honeycomb';
  import { createDatadogConfig } from 'autolemetry-backends/datadog';
  ```

  The configuration options remain identical - only the import path has changed.

  ### Array API Migration

  ```typescript
  // Before
  init({
    service: 'my-app',
    spanProcessor: new BatchSpanProcessor(new JaegerExporter()),
    spanExporter: new ZipkinExporter(),
    metricReader: new PrometheusExporter(),
  });

  // After
  init({
    service: 'my-app',
    spanProcessors: [new BatchSpanProcessor(new JaegerExporter())],
    spanExporters: [new ZipkinExporter()],
    metricReaders: [new PrometheusExporter()],
  });
  ```

  ## Why These Changes?

  ### Backend Package Separation
  - Keeps autolemetry core vendor-agnostic
  - Follows "Write once, observe everywhere" philosophy
  - Backend configs are optional conveniences, not core functionality
  - Aligns with package naming: `autolemetry-plugins` (inputs) vs `autolemetry-backends` (outputs)

  ### Array API Alignment
  - `spanProcessor` (singular) is deprecated in OpenTelemetry SDK
  - Native SDK support for arrays is more efficient and standard
  - Enables users to easily send data to multiple backends simultaneously
  - Consistent with `logRecordProcessors` which was already an array

  ## Benefits
  - Send spans to multiple backends: `spanProcessors: [jaegerProcessor, datadogProcessor]`
  - Send metrics to OTLP + Prometheus: `metricReaders: [otlpReader, prometheusReader]`
  - Cleaner code - no custom composite processor needed

### Patch Changes

- Updated dependencies [955ac09]
  - autolemetry@2.0.0
