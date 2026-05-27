# Security Policy

## Supported versions

`@cavi-ai/api-client` follows semantic versioning. While the package is pre-1.0,
security fixes are released against the latest published `0.x` line.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report through GitHub's
[private vulnerability reporting](https://github.com/cavi-ai/cavi-api-client/security/advisories/new).

Please include:

- a description of the issue and its impact,
- steps to reproduce (a minimal example or PoC if possible),
- affected version(s),
- any suggested remediation.

You can expect an initial acknowledgement within a few business days. Once the
issue is confirmed and a fix is prepared, a patched release will be published and
the reporter credited (unless anonymity is requested).

## Scope notes

This package is a client library with **no runtime dependencies**. A few areas are
particularly relevant to security reports:

- **Credential handling.** Bearer tokens and client IDs are passed through to
  request headers. Trace output is redacted (`redactSensitiveValue`,
  `redactPreviewText`); report any path where a token, secret, or sensitive value
  could leak into logs, traces, or errors.
- **Transport.** The HTTP client and WebSocket RPC client are the only
  network-touching code. Report TLS/origin/auth-handshake concerns here.
- **Untrusted gateway responses.** The client parses gateway/HTTP payloads; report
  parsing paths that could be abused by a malicious or compromised gateway.

Thank you for helping keep the project and its users safe.
