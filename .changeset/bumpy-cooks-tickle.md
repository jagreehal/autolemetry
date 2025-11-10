---
'autolemetry-edge': patch
'autolemetry': patch
---

Add immediate execution pattern support to `trace()` function

The `trace()` function now supports two patterns:
1. **Factory pattern** - Returns a traced function: `trace(ctx => (...args) => result)`
2. **Immediate execution** - Executes immediately with tracing: `trace(ctx => result)`

This enables use cases like wrapper functions that need to execute immediately rather than returning a wrapped function.
