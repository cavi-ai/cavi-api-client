import { createProviderRegistry } from "../../../core/runtime/providers/registry.js";
import { withRuntimeControlExtensions } from "../../../core/runtime/control-plane/extensions.js";
import { normalizeRuntimeProviderToken } from "../../../core/runtime/providers/normalize.js";
import type {
  RuntimeControlClientFactory,
  RuntimeProviderModule,
  RuntimeProviderRegistry,
} from "../../../core/runtime/providers/types.js";
import {
  createHermesRuntimeControlClient,
  type HermesCaviRuntimeControlOptions,
} from "./hermes/runtime-control.js";
import {
  createCaviControlAdapters,
  type CaviControlAdapterOptions,
} from "../adapters/create-cavi-control-adapters.js";
import { CAVI_CONTROL_EXTENSION } from "../adapters/runtime-control-extension.js";

export interface CaviRuntimeControlProviderOptions {
  openclaw?: Readonly<{ cavi?: CaviControlAdapterOptions }>;
  hermes?: HermesCaviRuntimeControlOptions;
}

const HERMES_REGISTRY_CARDINALITY_ERROR =
  "Invalid CAVI runtime-control registry: expected exactly one canonical Hermes module";
const HERMES_REGISTRY_SHADOW_ERROR =
  "Invalid CAVI runtime-control registry: Hermes resolution is shadowed";
const OPENCLAW_REGISTRY_CARDINALITY_ERROR =
  "Invalid CAVI runtime-control registry: expected exactly one canonical OpenClaw module";
const OPENCLAW_REGISTRY_SHADOW_ERROR =
  "Invalid CAVI runtime-control registry: OpenClaw resolution is shadowed";
const OPENCLAW_REGISTRY_FACTORY_ERROR =
  "Invalid CAVI runtime-control registry: canonical OpenClaw module has no runtime-control factory";

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

function assertCanonicalProvider(
  base: RuntimeProviderRegistry<RuntimeProviderModule>,
  baseModules: readonly RuntimeProviderModule[],
  kind: string,
  cardinalityError: string,
  shadowError: string,
): RuntimeProviderModule {
  const canonical = baseModules.filter(
    (module) => normalizeRuntimeProviderToken(module.kind) === kind,
  );
  if (canonical.length !== 1) throw new Error(cardinalityError);
  const resolved = base.resolveProvider(kind);
  if (
    !resolved ||
    normalizeRuntimeProviderToken(resolved.kind) !== kind ||
    !isSameProviderDeclaration(canonical[0]!, resolved)
  ) {
    throw new Error(shadowError);
  }
  return canonical[0]!;
}

export function withCaviRuntimeControlProviders<M extends RuntimeProviderModule>(
  base: RuntimeProviderRegistry<M>,
  options: CaviRuntimeControlProviderOptions = {},
): RuntimeProviderRegistry<M> {
  const baseModules = [...base.listProviders()];
  const canonicalHermes = assertCanonicalProvider(
    base, baseModules, "hermes", HERMES_REGISTRY_CARDINALITY_ERROR, HERMES_REGISTRY_SHADOW_ERROR,
  );
  const canonicalOpenclaw = options.openclaw?.cavi === undefined
    ? undefined
    : assertCanonicalProvider(
      base, baseModules, "openclaw", OPENCLAW_REGISTRY_CARDINALITY_ERROR, OPENCLAW_REGISTRY_SHADOW_ERROR,
    );
  if (canonicalOpenclaw && canonicalOpenclaw.createRuntimeControlClient === undefined) {
    throw new Error(OPENCLAW_REGISTRY_FACTORY_ERROR);
  }

  const hermesOptions = snapshotHermesOptions(options.hermes);
  const hermesCaviOptions = hermesOptions.cavi;
  const createHermesClient: RuntimeControlClientFactory = async (coreOptions) => {
    const client = await createHermesRuntimeControlClient({
      ...hermesOptions,
      ...coreOptions,
    });
    return hermesCaviOptions === undefined
      ? client
      : withRuntimeControlExtensions(client, [[
        CAVI_CONTROL_EXTENSION,
        createCaviControlAdapters(hermesCaviOptions),
      ]]);
  };
  const openclawCaviOptions = options.openclaw?.cavi === undefined
    ? undefined
    : cloneExtensionConfig(options.openclaw.cavi, new Set([
      options.openclaw.cavi.client,
    ].filter((value) => value !== undefined)));
  const createOpenclawClient: RuntimeControlClientFactory | undefined =
    canonicalOpenclaw === undefined || openclawCaviOptions === undefined
      ? undefined
      : async (coreOptions) => withRuntimeControlExtensions(
        await canonicalOpenclaw.createRuntimeControlClient!(coreOptions),
        [[CAVI_CONTROL_EXTENSION, createCaviControlAdapters(openclawCaviOptions)]],
      );
  const modules = baseModules.map((module) =>
    isSameProviderDeclaration(module, canonicalHermes)
      ? { ...module, createRuntimeControlClient: createHermesClient } as M
      : canonicalOpenclaw && isSameProviderDeclaration(module, canonicalOpenclaw)
        ? { ...module, createRuntimeControlClient: createOpenclawClient } as M
        : module
  );

  return createProviderRegistry<M>({ modules, allowOverrides: true });
}
