---
documentedVersion: {{documentedVersion}}
---

# Install and choose your environment

```sh
npm install @cavi-ai/api-client@{{documentedVersion}}
# Or: pnpm add @cavi-ai/api-client@{{documentedVersion}}
```

The package is ESM and includes TypeScript declarations. Use Node.js 20 or later,
or a compatible environment with the web APIs required by your selected
transport. CommonJS `require()` is not the package entry point.

## Server applications

Keep provider API keys in server-side configuration. Import the application
facade from the root and the provider module from its documented subpath.
See the [answer service](quickstart.md) for reusable application code and
[server requests](../guides/server.md) for the HTTP boundary.

## Browser and React applications

Connect to infrastructure that enforces authentication and permissions for your
application. Do not ship a provider's privileged API key in a browser bundle.
React is an optional peer dependency; install React 18 or later only if you use
`@cavi-ai/api-client/frameworks/react`.

Use [React gateway bindings](../guides/react.md) for connection state. Node-only
stdio and Unix-socket transports live in `core/transport/node`; do not import
them into a browser bundle.

## Version and import selection

These pages document the pinned package version above. Use
[import paths](../guides/imports.md) to select public entries and
[upgrade guidance](../release/migration-and-support.md) before changing versions.
Installing the client does not install an upstream runtime or grant model access.
