/**
 * Auto-instrumentation for edge runtimes
 *
 * Global instrumentations for Cloudflare Workers APIs:
 * - fetch() - HTTP client requests
 * - caches - Cache API operations
 */

export { instrumentGlobalFetch } from './fetch';
export { instrumentGlobalCache } from './cache';
