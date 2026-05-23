# Extensions

Extensions live outside `core/**` and `contracts/**` because they are
product-specific composition layers. They may depend on shared core primitives
and global contracts, but core must not depend on them.

## Folder Map

- `cavi/` owns CAVI/HQ extension contracts, adapters, domain DTOs, fallback
  snapshots, Project Board, operator-control, discourse, portal, library, and
  registry behavior.
