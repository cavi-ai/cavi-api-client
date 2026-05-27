export const REPO_ROOT_ENV_KEY = "REPO_ROOT" as const;
export const GLOBAL_REPO_ROOT_KEY = "__CAVI_REPO_ROOT__" as const;

export type RepoRootEnv = Record<string, string | undefined>;

export type ResolveRepoRootOptions = {
  repoRoot?: string | null;
  env?: RepoRootEnv;
  globalRepoRoot?: string | null;
};

declare const process:
  | {
      env?: RepoRootEnv;
    }
  | undefined;

type RepoRootGlobal = typeof globalThis & {
  [GLOBAL_REPO_ROOT_KEY]?: string | null;
};

function cleanRepoRoot(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function readProcessEnv(): RepoRootEnv {
  try {
    return typeof process !== "undefined" && process.env ? process.env : {};
  } catch {
    return {};
  }
}

function readGlobalRepoRoot(): string | null {
  try {
    return cleanRepoRoot((globalThis as RepoRootGlobal)[GLOBAL_REPO_ROOT_KEY]);
  } catch {
    return null;
  }
}

export function resolveRepoRoot(options: ResolveRepoRootOptions = {}): string | null {
  return (
    cleanRepoRoot(options.repoRoot) ??
    cleanRepoRoot(options.env?.[REPO_ROOT_ENV_KEY]) ??
    cleanRepoRoot(options.globalRepoRoot) ??
    readGlobalRepoRoot() ??
    cleanRepoRoot(readProcessEnv()[REPO_ROOT_ENV_KEY])
  );
}

export function requireRepoRoot(options: ResolveRepoRootOptions = {}): string {
  const repoRoot = resolveRepoRoot(options);
  if (!repoRoot) {
    throw new Error("Missing REPO_ROOT for @cavi-ai/api-client filesystem integration");
  }
  return repoRoot;
}
