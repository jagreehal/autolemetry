import { defineWorkspace } from 'vitest/config';

// Vitest workspace configuration for the monorepo
// This allows the VS Code extension to discover all test configs in one place
export default defineWorkspace([
  // Core package - unit tests
  'packages/autolemetry/vitest.unit.config.ts',
  // Core package - integration tests
  'packages/autolemetry/vitest.integration.config.ts',
  
  // Plugins package - unit tests
  'packages/autolemetry-plugins/vitest.unit.config.ts',
  // Plugins package - integration tests
  'packages/autolemetry-plugins/vitest.integration.config.ts',
  
  // Cloudflare package - unit tests
  'packages/autolemetry-cloudflare/vitest.config.ts',
  // Cloudflare package - integration tests
  'packages/autolemetry-cloudflare/vitest.integration.config.ts',
  
  // Edge package
  'packages/autolemetry-edge/vitest.config.ts',
  
  // Subscribers package
  'packages/autolemetry-subscribers/vitest.config.ts',
  
  // MCP package - unit tests
  'packages/autolemetry-mcp/vitest.config.ts',
  // MCP package - integration tests
  'packages/autolemetry-mcp/vitest.integration.config.ts',
  
  // Web package
  'packages/autolemetry-web/vitest.config.ts',
]);



