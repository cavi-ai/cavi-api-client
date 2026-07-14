---
documentedVersion: 0.11.0
---

# Provider guides

Provider modules adapt upstream-owned APIs to the package's universal runtime
and gateway contracts. Choose a provider only at the application boundary; keep
workflow code expressed in terms of `RuntimeClient`, `GatewayClient`, and
capability checks.

- [Hermes](hermes.md)
- [OpenClaw](openclaw.md)
- [Claude](claude.md)
- [Codex](codex.md)
- [Gemini](gemini.md)

Each guide owns its provider's entry points, authentication requirements, and
support boundaries. The package mirrors these implementations; their upstream
runtimes remain the canonical protocol owners.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
