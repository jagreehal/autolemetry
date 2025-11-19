---
'autolemetry': major
'autolemetry-subscribers': major
'autolemetry-edge': major
---

**BREAKING CHANGE**: Rename adapters → subscribers terminology across all packages

This is a major refactoring to improve naming clarity and align with pub/sub patterns:

## autolemetry

- **Class names**: `Analytics` → `Event`, `Metrics` → `Metric`
- **Export paths**: `autolemetry/analytics` → `autolemetry/event`, `autolemetry/metrics` → `autolemetry/metric`
- **Config property**: `adapters:` → `subscribers:` in `init()`
- **Types**: `AnalyticsAdapter` → `EventSubscriber`, `AnalyticsPayload` → `EventPayload`

## autolemetry-subscribers

- **Class names**: All adapter classes renamed (e.g., `PostHogAdapter` → `PostHogSubscriber`)
- **Base class**: `AnalyticsAdapter` → `EventSubscriber`
- **Streaming base**: `StreamingAnalyticsAdapter` → `StreamingEventSubscriber`
- **Export paths**: All imports from `autolemetry-subscribers/posthog` etc. remain the same, just class names changed

## autolemetry-edge

- **Types**: `EdgeAdaptersEvent` → `EdgeEvent`, `EdgeAdaptersAdapter` → `EdgeSubscriber`
- **Functions**: `createEdgeAdapters()` → `createEdgeSubscribers()`, `getEdgeAdapters()` → `getEdgeSubscribers()`
- **Config property**: `adapters:` → `subscribers:`

## Migration Guide

### Before
```typescript
import { init } from 'autolemetry';
import { PostHogAdapter } from 'autolemetry-subscribers/posthog';

init({
  service: 'my-app',
  adapters: [new PostHogAdapter({ apiKey: '...' })]
});
```

### After
```typescript
import { init } from 'autolemetry';
import { PostHogSubscriber } from 'autolemetry-subscribers/posthog';

init({
  service: 'my-app',
  subscribers: [new PostHogSubscriber({ apiKey: '...' })]
});
```

### Edge Runtime - Before
```typescript
import { createEdgeAdapters, type EdgeAdaptersEvent } from 'autolemetry-edge';

const adapters = createEdgeAdapters({
  transport: async (event: EdgeAdaptersEvent) => { /* ... */ }
});
```

### Edge Runtime - After
```typescript
import { createEdgeSubscribers, type EdgeEvent } from 'autolemetry-edge';

const subscribers = createEdgeSubscribers({
  transport: async (event: EdgeEvent) => { /* ... */ }
});
```
