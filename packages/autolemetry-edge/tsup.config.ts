import { defineConfig } from 'tsup';

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
});
