import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json for build-time injection
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'sampling/index': 'src/sampling/index.ts',
    'instrumentation/index': 'src/instrumentation/index.ts',
    'testing/index': 'src/testing/index.ts',
    'api/compose': 'src/api/compose.ts',
  },
  format: ['esm'], // ESM-only for edge runtimes
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  clean: true,
  treeshake: true,
  splitting: true, // Code splitting for better tree-shaking
  minify: false, // Let bundlers handle minification
  target: 'es2022', // Modern target for edge runtimes
  external: [
    'node:async_hooks',
    'node:events',
    'node:buffer',
    'cloudflare:workers',
  ],
  define: {
    'process.env.AUTOLEMETRY_EDGE_VERSION': JSON.stringify(pkg.version),
  },
});
