/**
 * Zero-dependency logger for edge runtimes with dynamic log level control
 * Entry point: autolemetry-edge/logger
 */

export {
  createEdgeLogger,
  getEdgeTraceContext,
  runWithLogLevel,
  getActiveLogLevel,
  type EdgeLogger,
  type LogLevel,
} from './api/logger';
