/**
 * Minimal browser SDK initialization
 *
 * Patches fetch() and XMLHttpRequest to automatically inject W3C traceparent headers.
 * NO OpenTelemetry dependencies - just native browser APIs.
 *
 * Bundle size: ~2-5KB gzipped
 */

import { createTraceparent } from './traceparent';

export interface AutolemetryWebConfig {
  /**
   * Service name for the browser application
   * Used only for logging/debugging - not sent in headers
   */
  service: string;

  /**
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;

  /**
   * Enable automatic traceparent injection on fetch calls
   * @default true
   */
  instrumentFetch?: boolean;

  /**
   * Enable automatic traceparent injection on XMLHttpRequest
   * @default true
   */
  instrumentXHR?: boolean;
}

let isInitialized = false;
let config: AutolemetryWebConfig | undefined;

/**
 * Initialize autolemetry-web
 *
 * Patches fetch() and XMLHttpRequest to auto-inject traceparent headers.
 *
 * **SSR-safe:** Safe to call in SSR environments (checks for window).
 * **Call once:** Subsequent calls are ignored.
 *
 * @example
 * ```typescript
 * import { init } from 'autolemetry-web'
 *
 * init({ service: 'my-frontend-app' })
 *
 * // Now all fetch/XHR calls include traceparent headers!
 * fetch('/api/users')  // <-- traceparent header automatically injected
 * ```
 *
 * @example With React (client-only)
 * ```typescript
 * import { useEffect } from 'react'
 * import { init } from 'autolemetry-web'
 *
 * function App() {
 *   useEffect(() => {
 *     init({ service: 'my-spa' })
 *   }, [])
 *
 *   return <div>...</div>
 * }
 * ```
 */
export function init(userConfig: AutolemetryWebConfig): void {
  // SSR-safe: do nothing on the server
  if (typeof window === 'undefined') {
    return;
  }

  if (isInitialized) {
    if (userConfig.debug) {
      console.warn('[autolemetry-web] Already initialized. Skipping.');
    }
    return;
  }

  config = userConfig;

  // Patch fetch
  if (config.instrumentFetch !== false) {
    patchFetch();
  }

  // Patch XHR
  if (config.instrumentXHR !== false) {
    patchXMLHttpRequest();
  }

  isInitialized = true;

  if (config.debug) {
    console.log('[autolemetry-web] Initialized successfully', {
      service: config.service,
      instrumentFetch: config.instrumentFetch !== false,
      instrumentXHR: config.instrumentXHR !== false,
    });
  }
}

/**
 * Patch fetch() to auto-inject traceparent headers
 */
function patchFetch(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Create headers object
    const headers = new Headers(init?.headers);

    // Only inject if traceparent doesn't already exist
    if (!headers.has('traceparent')) {
      headers.set('traceparent', createTraceparent());

      if (config?.debug) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        console.log('[autolemetry-web] Injected traceparent on fetch:', url, headers.get('traceparent'));
      }
    }

    // Call original fetch with updated headers
    return originalFetch(input, { ...init, headers });
  };
}

/**
 * Patch XMLHttpRequest to auto-inject traceparent headers
 */
function patchXMLHttpRequest(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  // Track which XHR instances have traceparent set
  const xhrHasTraceparent = new WeakSet<XMLHttpRequest>();

  // Patch setRequestHeader to track manual traceparent headers
  XMLHttpRequest.prototype.setRequestHeader = function (
    name: string,
    value: string
  ): void {
    if (name.toLowerCase() === 'traceparent') {
      xhrHasTraceparent.add(this);
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  // Patch open to inject traceparent after headers are ready
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    // Call original open
    const result = originalOpen.call(this, method, url, async, username, password);

    // Listen for readyState change to inject header at the right time
    const xhr = this;
    const originalOnReadyStateChange = xhr.onreadystatechange;

    xhr.onreadystatechange = function (event: Event) {
      // OPENED state (1) - headers can now be set
      if (xhr.readyState === XMLHttpRequest.OPENED) {
        // Only inject if not already set
        if (!xhrHasTraceparent.has(xhr)) {
          try {
            const traceparent = createTraceparent();
            originalSetRequestHeader.call(xhr, 'traceparent', traceparent);

            if (config?.debug) {
              console.log('[autolemetry-web] Injected traceparent on XHR:', url, traceparent);
            }
          } catch (error) {
            // Silently ignore if setRequestHeader fails
            if (config?.debug) {
              console.warn('[autolemetry-web] Failed to inject traceparent on XHR:', error);
            }
          }
        }
      }

      // Call original handler if it exists
      if (originalOnReadyStateChange) {
        return originalOnReadyStateChange.call(xhr, event);
      }
    };

    return result;
  };
}

/**
 * Reset initialization state (for testing)
 * @internal
 */
export function resetForTesting(): void {
  isInitialized = false;
  config = undefined;
}

/**
 * Get current configuration
 * @internal
 */
export function getConfig(): AutolemetryWebConfig | undefined {
  return config;
}
