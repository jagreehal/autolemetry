/**
 * Vitest setup file
 * Polyfills for Cloudflare Workers APIs in test environment
 */

import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

// Set up proper context manager for OpenTelemetry tests
const contextManager = new AsyncLocalStorageContextManager();
contextManager.enable();
context.setGlobalContextManager(contextManager);

// Polyfill scheduler.wait() for tests
if (typeof globalThis.scheduler === 'undefined') {
  (globalThis as any).scheduler = {
    wait: async (ms: number) => {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  };
}

// Polyfill Response.json() if not available
if (typeof Response !== 'undefined' && !Response.json) {
  (Response as any).json = (data: any, init?: ResponseInit) => {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  };
}
