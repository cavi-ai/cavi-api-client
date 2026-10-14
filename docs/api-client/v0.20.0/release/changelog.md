---
documentedVersion: 0.20.0
---

# Release changes

These notes are selected from the canonical repository CHANGELOG.md for
`@cavi-ai/api-client@0.20.0`. Unreleased changes are excluded.

Read [upgrade instructions](migration-and-support.md) before changing imports
or error-handling assumptions.

## [0.20.0] - 2026-10-13

### Added

- Native Python lifecycle clients for Claude, Claude Managed Agents, Codex,
  AGY, Hermes, OpenClaw, and OpenCode. Install independently of Node/npm;
  HTTPX is required and WebSocket support is an optional OpenClaw extra.
- Python 3.11 and 3.14 CI jobs build and test the installed wheel without Node.
- Generated 0.20.0 API reference and native Python setup guide.
- Async Python runtime lifecycle client and `cavi-runtime-bridge` executable,
  reusing application-owned TypeScript adapters over bounded JSON Lines.
  Includes operation discovery, completion helpers, structured errors,
  request deadlines, and subprocess cleanup. Requires Python 3.11+ and Node 20+.
- `serveRuntimeBridge` and protocol constants from `core/transport/node` for
  embedding lifecycle access with explicit adapter and stream ownership.
