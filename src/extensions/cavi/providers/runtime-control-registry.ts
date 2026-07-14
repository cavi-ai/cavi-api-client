import { createProviderRegistry } from "../../../core/runtime/providers/registry.js";
import { normalizeRuntimeProviderToken } from "../../../core/runtime/providers/normalize.js";
import type {
  RuntimeControlClientFactory,
  RuntimeProviderModule,
  RuntimeProviderRegistry,
} from "../../../core/runtime/providers/types.js";
import {
  createHermesRuntimeControlClient,
  type HermesCaviRuntimeControlOptions,
} from "./hermes/runtime-control-client.js";

export interface CaviRuntimeControlProviderOptions {
  hermes?: HermesCaviRuntimeControlOptions;
}

const HERMES_REGISTRY_CARDINALITY_ERROR =
  "Invalid CAVI runtime-control registry: expected exactly one canonical Hermes module";
const HERMES_REGISTRY_SHADOW_ERROR =
  "Invalid CAVI runtime-control registry: Hermes resolution is shadowed";

function normalizedAliases(module: RuntimeProviderModule): readonly string[] {
  return [...new Set((module.aliases ?? [])
    .map((alias) => normalizeRuntimeProviderToken(alias))
    .filter((alias): alias is string => alias !== null))]
    .sort();
}

function isSameProviderDeclaration(
  left: RuntimeProviderModule,
  right: RuntimeProviderModule,
): boolean {
  if (normalizeRuntimeProviderToken(left.kind) !== normalizeRuntimeProviderToken(right.kind)) {
    return false;
  }
  const leftAliases = normalizedAliases(left);
  const rightAliases = normalizedAliases(right);
  return leftAliases.length === rightAliases.length &&
    leftAliases.every((alias, index) => alias === rightAliases[index]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function cloneExtensionConfig<T>(value: T, retained: ReadonlySet<unknown>): T {
  if (retained.has(value)) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => cloneExtensionConfig(entry, retained)) as T;
  }
  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      key,
      cloneExtensionConfig(entry, retained),
    ])) as T;
  }
  return value;
}

function snapshotHermesOptions(
  options: HermesCaviRuntimeControlOptions | undefined,
): HermesCaviRuntimeControlOptions {
  if (!options) return {};
  const retained = new Set<unknown>([
    options.channel,
    options.signal,
    options.fetch,
    options.cavi?.client,
  ].filter((value) => value !== undefined));
  return cloneExtensionConfig(options, retained);
}

export function withCaviRuntimeControlProviders<M extends RuntimeProviderModule>(
  base: RuntimeProviderRegistry<M>,
  options: CaviRuntimeControlProviderOptions = {},
): RuntimeProviderRegistry<M> {
  const baseModules = [...base.listProviders()];
  const canonicalHermes = baseModules.filter(
    (module) => normalizeRuntimeProviderToken(module.kind) === "hermes",
  );
  if (canonicalHermes.length !== 1) throw new Error(HERMES_REGISTRY_CARDINALITY_ERROR);

  const resolvedHermes = base.resolveProvider("hermes");
  if (
    !resolvedHermes ||
    normalizeRuntimeProviderToken(resolvedHermes.kind) !== "hermes" ||
    !isSameProviderDeclaration(canonicalHermes[0]!, resolvedHermes)
  ) {
    throw new Error(HERMES_REGISTRY_SHADOW_ERROR);
  }

  const hermesOptions = snapshotHermesOptions(options.hermes);
  const createRuntimeControlClient: RuntimeControlClientFactory = (coreOptions) =>
    createHermesRuntimeControlClient({
      ...hermesOptions,
      ...coreOptions,
    });
  const modules = baseModules.map((module) =>
    isSameProviderDeclaration(module, canonicalHermes[0]!)
      ? { ...module, createRuntimeControlClient } as M
      : module
  );

  return createProviderRegistry<M>({ modules, allowOverrides: true });
}
