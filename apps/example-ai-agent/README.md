# AI/LLM Workflow Examples

Demonstrates instrumentation patterns for AI/LLM applications using Autolemetry.

## Examples Included

### 1. Multi-Agent Workflow (`src/multi-agent-workflow.ts`)

Demonstrates a three-agent escalation system:
- **Triage Agent**: Analyzes requests and creates plans
- **Specialist Agent**: Executes detailed analysis
- **QA Agent**: Reviews and validates output

**Key Patterns:**
- Multi-step workflow orchestration
- Correlation ID propagation across agents
- Agent handoff tracking
- Business event instrumentation
- Conditional workflow paths

**Run:**
```bash
pnpm start:multi-agent
```

### 2. RAG Pipeline (`src/rag-pipeline.ts`)

Demonstrates a complete Retrieval-Augmented Generation pipeline:
- **Embeddings**: Query vectorization
- **Search**: Vector database retrieval
- **Context Assembly**: Combining retrieved chunks
- **Generation**: LLM response with context

**Key Patterns:**
- Pipeline stage tracking
- Vector search observability
- Context assembly metrics
- Token usage tracking
- Source attribution

**Run:**
```bash
pnpm start:rag
```

## Getting Started

### Prerequisites

From the monorepo root:

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Running Examples

```bash
# Navigate to this example
cd apps/example-ai-agent

# Run all examples info
pnpm start

# Run specific examples
pnpm start:multi-agent
pnpm start:rag
```

### Configuration

Set these environment variables (optional):

```bash
# OTLP endpoint (defaults to http://localhost:4318)
export OTLP_ENDPOINT=http://localhost:4318

# Node environment
export NODE_ENV=development
```

## Understanding the Output

Each example shows:
1. **Console output**: Human-readable workflow progress
2. **Telemetry**: Sent to OTLP endpoint (view in your observability backend)
3. **Correlation IDs**: Track requests across all operations

### Correlation IDs

Every workflow generates a correlation ID automatically:
```
Correlation ID: 1a2b3c4d5e6f7g8h
```

Use this ID to:
- Filter traces in your observability backend
- Track workflows across multiple services
- Debug issues in production

## Integration with OpenLLMetry

These examples use simulated LLM calls. In production:

1. **Install OpenLLMetry**:
   ```bash
   pnpm add @traceloop/node-server-sdk
   ```

2. **Enable in initialization**:
   ```typescript
   init({
     service: 'my-ai-app',
     openllmetry: {
       enabled: true,
       options: {
         disableBatch: process.env.NODE_ENV !== 'production',
       },
     },
   });
   ```

3. **Replace simulated calls** with actual LLM SDKs:
   ```typescript
   // Before (simulated)
   const response = await simulateLLMCall(prompt, 'gpt-4o');

   // After (real OpenAI SDK)
   const response = await openai.chat.completions.create({
     model: 'gpt-4o',
     messages: [{ role: 'user', content: prompt }],
   });
   // OpenLLMetry automatically instruments this! ✨
   ```

## Observability Backends

View telemetry in any OTLP-compatible backend:

### Local Development (Grafana Stack)

```bash
# Start Grafana + Tempo + Prometheus (from root)
docker-compose up -d

# Set endpoint
export OTLP_ENDPOINT=http://localhost:4318
```

View traces at: http://localhost:3000

### Cloud Providers

```bash
# Grafana Cloud
export OTLP_ENDPOINT=https://otlp-gateway-prod.grafana.net/otlp

# Datadog
export OTLP_ENDPOINT=https://otlp.datadoghq.com

# Honeycomb
export OTLP_ENDPOINT=https://api.honeycomb.io/v1/traces
```

## Key Instrumentation Patterns

### 1. Nested Spans (Parent-Child Hierarchies)

```typescript
export const workflow = trace('workflow', ctx => async () => {
  // This creates a parent span
  const step1 = await trace('step1', async () => {
    // Child span
    return result;
  });
});
```

### 2. Correlation IDs

```typescript
export const workflow = trace('workflow', ctx => async () => {
  // Auto-available!
  console.log(ctx.correlationId);

  // Automatically propagates to nested operations
  await childOperation(); // Inherits correlation context
});
```

### 3. Business Events

```typescript
ctx.addEvent('agent_handoff', {
  from: 'triage',
  to: 'specialist',
});

track('workflow_completed', {
  duration_ms: 1234,
  success: true,
});
```

### 4. Domain Attributes

```typescript
ctx.setAttributes({
  'agent.role': 'specialist',
  'agent.model': 'gpt-4o',
  'workflow.type': 'multi_agent',
});
```

## Learn More

- **Documentation**: See [docs/AI_WORKFLOWS.md](../../docs/AI_WORKFLOWS.md) for comprehensive patterns
- **Autolemetry Core**: See [packages/autolemetry/README.md](../../packages/autolemetry/README.md)
- **OpenLLMetry**: https://github.com/traceloop/openllmetry

## Next Steps

1. ✅ Run the examples to see instrumentation in action
2. ✅ View traces in your observability backend
3. ✅ Adapt patterns for your AI workflows
4. ✅ Enable OpenLLMetry for automatic LLM instrumentation
5. ✅ Add custom business events and attributes
