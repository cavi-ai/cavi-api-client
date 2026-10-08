---
documentedVersion: {{documentedVersion}}
---

# Test the behavior your application consumes

Use `@cavi-ai/api-client/testing` for runner-neutral conformance helpers when
writing provider adapters. Its [reference](../reference/testing.md) describes
the public inspectors and reports.

For an application, test the selected contract:

- Facade callers: live results, unsupported/unavailable gaps, and exceptions.
- Raw callers: capability and method guards, raw statuses, and thrown errors.
- Run lifecycle: active, completed, failed, cancelled, and unknown states.
- Streams: deltas, failed-run events, transport errors, caller abort, and
  missing terminal outcomes.
- Ownership: bounded waits and disposal when the client owner shuts down.

Fixtures establish how your code handles responses; they do not prove the
target backend currently has a plugin or endpoint. Include integration checks
against the backend/version your deployment actually uses.

Test from the installed package's public entry points. A relative import into
package source can conceal missing exports or Node-only dependencies entering
your browser build. Keep package versions pinned in reproducible consumer tests.

[Compatibility](../concepts/compatibility.md) · [Failure handling](errors.md)
