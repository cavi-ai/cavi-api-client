import { normalizeTeamManifest, type TeamManifest } from "./team-manifest.js";

/** The seam through which a host supplies its manifest to the package. */
export interface TeamManifestSource {
  getManifest(): Promise<TeamManifest>;
}

export type TeamManifestInput = Partial<TeamManifest> | null | undefined;
export type TeamManifestLoader = () =>
  | TeamManifestInput
  | Promise<TeamManifestInput>;

/** A fixed, host-provided manifest. Normalized once. */
export function createStaticManifestSource(
  manifest: TeamManifestInput,
): TeamManifestSource {
  const normalized = normalizeTeamManifest(manifest);
  return { getManifest: async () => normalized };
}

export interface CachedTeamManifestSource extends TeamManifestSource {
  /** Re-run the loader and replace the cached manifest. */
  refresh(): Promise<TeamManifest>;
}

/**
 * A manifest fetched via a loader (e.g. from a gateway). Cached after first
 * load; call refresh() to revalidate.
 */
export function createCachedManifestSource(
  loader: TeamManifestLoader,
): CachedTeamManifestSource {
  let cached: Promise<TeamManifest> | null = null;
  const load = async () => normalizeTeamManifest(await loader());
  return {
    getManifest() {
      if (!cached) cached = load();
      return cached;
    },
    refresh() {
      cached = load();
      return cached;
    },
  };
}
