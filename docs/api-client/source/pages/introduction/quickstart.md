---
documentedVersion: 0.11.0
---

# Quickstart

Install `@cavi-ai/api-client@0.11.0`, set `OPENAI_API_KEY` in the trusted server environment, and run the compile-checked [complete request example](../../../../examples/runtime-node.ts). The example configures a Codex client with the API key and default model, sends one text request, and returns a normalized `RuntimeRunStatus`. On success its `status` describes the run and its output fields contain the provider result.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
