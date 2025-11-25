---
'autolemetry-cloudflare': minor
---

Add Cloudflare Agents SDK integration example to cloudflare-example app

- Added `src/agent.ts` with TaskAgent example demonstrating OpenTelemetry observability
- Added `src/agent-worker.ts` worker entrypoint with RPC method examples
- Updated `alchemy.run.ts` to include TaskAgent Durable Object namespace configuration
- Updated README with comprehensive Agent example documentation
- Demonstrates tracing of RPC calls, scheduled tasks, MCP operations, and lifecycle events
