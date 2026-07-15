# Durable consumer verification snapshots

This procedure is for release maintainers validating consuming applications. It
is not required for normal package installation or provider setup.

Capture a dirty consumer migration without committing it or retaining a
temporary worktree:

```sh
pnpm run build:runtime-control-consumer-snapshot -- \
  --source /path/to/consumer \
  --label consumer-name \
  --expected-origin https://github.com/owner/consumer.git \
  --expected-base <expected-head-commit> \
  --allow-absolute-path /absolute/path/to/final-runtime-control-rc.tgz \
  --out .artifacts/runtime-control/consumer-snapshots
```

Always supply the expected origin and base. The producer rejects synthetic or
stale sources, private agent artifacts, and newly introduced absolute
workstation paths. The one exact release-candidate artifact may be explicitly
allowed; metadata records only its digest.

Use the generated metadata as verifier input:

```sh
pnpm run verify:runtime-control-consumers -- \
  --web .artifacts/runtime-control/consumer-snapshots/web.json \
  --mobile .artifacts/runtime-control/consumer-snapshots/mobile.json
```

The verifier checks the bundle digest, commit, tree, path and mode inventory,
content hashes, dependency declaration, and lockfile without rewriting the
captured consumer.

Bundles and metadata are ignored local evidence. Do not commit or publish them,
and do not imply that paths on one maintainer's machine are available to another
checkout.
