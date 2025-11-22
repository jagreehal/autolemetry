# autolemetry-mcp

## 0.2.0

### Minor Changes

- 2cbcb8b: Add autolemetry-mcp package for Model Context Protocol (MCP) instrumentation and privacy controls for autolemetry-web

  ## autolemetry-mcp

  Add autolemetry-mcp package for Model Context Protocol (MCP) instrumentation
  - Automatic OpenTelemetry instrumentation for MCP servers and clients
  - W3C Trace Context propagation via `_meta` field for distributed tracing
  - Transport-agnostic (works with stdio, HTTP, SSE, or any MCP transport)
  - Proxy-based instrumentation pattern (no MCP SDK modifications needed)
  - Support for both Node.js (autolemetry) and Edge (autolemetry-edge) runtimes
  - Tree-shakeable exports: server (~5KB), client (~4KB), context (~2KB)
  - Automatic span creation for tools, resources, and prompts
  - Configurable argument and result capture with PII considerations

  ## autolemetry-web

  Add privacy controls for GDPR/CCPA compliance and user privacy preferences

  **New Features:**
  1. **Privacy Configuration** (`PrivacyConfig`)
     - `allowedOrigins` - Whitelist of origins that receive traceparent headers
     - `blockedOrigins` - Blacklist of origins that never receive traceparent headers
     - `respectDoNotTrack` - Respect browser's Do Not Track (DNT) setting
     - `respectGPC` - Respect Global Privacy Control (GPC) signal
     - Case-insensitive substring matching for flexible origin filtering
     - Decision priority: DNT > GPC > Blocklist > Allowlist > Default
  2. **Privacy Manager** (`PrivacyManager`)
     - Automatic privacy checks at header injection time
     - Real-time privacy signal detection (DNT, GPC)
     - Origin-based filtering with efficient substring matching
     - Debug logging shows privacy decision reasons
  3. **Configuration Validation**
     - Validates service name at initialization
     - Warns about empty privacy configs
     - Warns about overlapping allowed/blocked origins
     - Warns about protocol in origin strings (common mistake)
  4. **Enhanced Debug Logging**
     - Logs privacy config summary on initialization
     - Logs when headers are skipped due to privacy rules
     - Logs denial reasons for troubleshooting
     - Shows privacy decision details in debug mode

  **New Exports:**
  - `autolemetry-web` - Now exports `PrivacyConfig` type
  - `autolemetry-web/privacy` - New module for advanced privacy control
    - `PrivacyManager` class
    - `getDenialReason()` helper for debugging
    - Direct import: `import { PrivacyManager } from 'autolemetry-web/privacy'`

  **API Changes:**
  - `AutolemetryWebConfig` - Added optional `privacy?: PrivacyConfig` field
  - `init()` - Now accepts privacy configuration
  - `getPrivacyManager()` - New internal API for testing

  **Bundle Size Impact:**
  - Privacy features add ~1KB to bundle size
  - New bundle size: **2.6KB gzipped** (was 1.6KB)
  - Still 20x smaller than full OpenTelemetry browser SDK

  **Documentation:**
  - Added comprehensive "Privacy Controls" section to README
  - GDPR/CCPA compliance guidance
  - Examples for common use cases:
    - Restrict to first-party APIs only
    - Block third-party analytics domains
    - Respect user privacy signals
    - Combined privacy rules
  - Troubleshooting guide for privacy issues
  - Advanced usage examples with PrivacyManager

  **Compatibility:**
  - No breaking changes - privacy controls are optional
  - Backward compatible: if no privacy config provided, behaves exactly as before
  - Default behavior: inject traceparent on all requests (unchanged)

  **Use Cases:**
  - GDPR compliance for EU users
  - CCPA compliance for California users
  - Respect user privacy preferences (DNT, GPC)
  - Prevent trace leakage to third-party domains
  - Restrict tracing to first-party APIs only
  - Block analytics/tracking domains
