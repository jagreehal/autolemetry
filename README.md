# 🔭 autolemetry

[![npm version](https://img.shields.io/npm/v/autolemetry.svg?label=autolemetry)](https://www.npmjs.com/package/autolemetry)
[![npm adapters](https://img.shields.io/npm/v/autolemetry-adapters.svg?label=adapters)](https://www.npmjs.com/package/autolemetry-adapters)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Write once, observe everywhere.** Instrument your Node.js code a single time, keep the DX you love, and stream traces, metrics, logs, and product analytics to **any** observability stack without vendor lock-in.

## Packages

This monorepo contains the following packages:

### [autolemetry](./packages/autolemetry)

[![npm](https://img.shields.io/npm/v/autolemetry.svg)](https://www.npmjs.com/package/autolemetry)

Core library providing ergonomic OpenTelemetry instrumentation with:

- Drop-in DX with `trace()`, `span()`, and decorators
- Adaptive sampling (10% baseline, 100% errors/slow paths)
- Production hardening (rate limiting, circuit breakers, redaction)
- Auto trace context enrichment
- LLM observability via OpenLLMetry integration

**[→ View full documentation](./packages/autolemetry/README.md)**

### [autolemetry-adapters](./packages/autolemetry-adapters)

[![npm](https://img.shields.io/npm/v/autolemetry-adapters.svg)](https://www.npmjs.com/package/autolemetry-adapters)

Product analytics adapters for:

- PostHog
- Mixpanel
- Amplitude
- Slack webhooks
- Custom webhooks

**[→ View adapters documentation](./packages/autolemetry-adapters/README.md)**

### [autolemetry-edge](./packages/autolemetry-edge)

[![npm](https://img.shields.io/npm/v/autolemetry-edge.svg)](https://www.npmjs.com/package/autolemetry-edge)

Edge runtime support for:

- Cloudflare Workers
- Vercel Edge Functions
- Other edge environments

**[→ View edge documentation](./packages/autolemetry-edge/README.md)**

## Quick Start

```bash
npm install autolemetry
# or
pnpm add autolemetry
```

```typescript
import { init, trace } from 'autolemetry';

init({
  service: 'my-app',
  environment: process.env.NODE_ENV,
});

export const createUser = trace(async function createUser(data: UserData) {
  return await db.users.create(data);
});
```

**[→ View complete usage guide](./packages/autolemetry/README.md#quick-start)**

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone and install dependencies
git clone https://github.com/yourusername/autolemetry.git
cd autolemetry
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run example apps
pnpm --filter @jagreehal/example-basic start
pnpm --filter @jagreehal/example-http start
```

### Project Structure

```text
autolemetry/
├── packages/
│   ├── autolemetry/          # Core library
│   ├── autolemetry-adapters/ # Analytics adapters
│   └── autolemetry-edge/     # Edge runtime support
├── apps/
│   ├── example-basic/        # Basic usage example
│   ├── example-http/         # Express server example
│   └── cloudflare-example/   # Cloudflare Workers example
└── turbo.json                # Turborepo configuration
```

### Available Scripts

```bash
# Development
pnpm dev              # Watch mode for all packages
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm test:integration # Run integration tests

# Code quality
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier
pnpm type-check       # TypeScript type checking

# Releases
pnpm changeset        # Create a changeset
pnpm version-packages # Version packages
pnpm release          # Publish to npm
```

### Running Examples

#### Basic Example

```bash
pnpm --filter @jagreehal/example-basic start
```

#### HTTP Server Example

```bash
pnpm --filter @jagreehal/example-http start
```

#### Cloudflare Workers Example

```bash
pnpm --filter cloudflare-example dev
```

## Contributing

We welcome contributions! Please see our [contributing guidelines](./CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork and clone** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** and add tests
4. **Run tests**: `pnpm test`
5. **Create a changeset**: `pnpm changeset`
6. **Commit your changes**: `git commit -am "Add new feature"`
7. **Push to your fork**: `git push origin feature/my-feature`
8. **Open a pull request**

### Adding a Changeset

We use [changesets](https://github.com/changesets/changesets) for version management:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select which packages changed
2. Choose semver bump (major/minor/patch)
3. Write a summary of your changes

## Architecture

Autolemetry is built on top of OpenTelemetry and provides:

- **Ergonomic API layer** - Wraps verbose OpenTelemetry APIs
- **Smart defaults** - Production-ready configuration out of the box
- **Platform agnostic** - Works with any OTLP-compatible backend
- **Type-safe** - Full TypeScript support with strict types
- **Modular design** - Use only what you need

## Why Autolemetry?

| Challenge | With autolemetry |
| --- | --- |
| Raw OpenTelemetry is verbose | One-line `trace()` wrapper with automatic lifecycle |
| Vendor SDKs create lock-in | OTLP-native, works with any backend |
| Need both observability & analytics | Unified API for traces, metrics, logs, and events |
| Production safety concerns | Built-in sampling, rate limiting, redaction |

## Roadmap

- [x] Core tracing API
- [x] Metrics support
- [x] Log correlation
- [x] Product analytics adapters
- [x] Edge runtime support
- [x] LLM observability (OpenLLMetry)
- [ ] React instrumentation
- [ ] Browser SDK
- [ ] Mobile SDKs

## Community & Support

- [Report bugs](https://github.com/yourusername/autolemetry/issues)
- [Request features](https://github.com/yourusername/autolemetry/discussions)
- [Join discussions](https://github.com/yourusername/autolemetry/discussions)

## License

MIT - See [LICENSE](./LICENSE) for details.

---

Built by the Autolemetry team
