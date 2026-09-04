import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "cavi-packed-consumer-"));
const packDirectory = join(temporaryRoot, "pack");
const extractedDirectory = join(temporaryRoot, "extracted");
const consumerDirectory = join(temporaryRoot, "consumer");
const installedPackage = join(consumerDirectory, "node_modules/@cavi-ai/api-client");
const command = (executable, args, cwd = packageRoot, env = process.env) => execFileSync(executable, args, {
  cwd,
  env,
  encoding: "utf8",
  stdio: "pipe",
});

const imports = `
import { GATEWAY_RAW_EXTENSION, createRuntimeControlClient } from "@cavi-ai/api-client";
import { CapabilityUnavailable, GATEWAY_RAW_EXTENSION as SUBPATH_GATEWAY_RAW_EXTENSION } from "@cavi-ai/api-client/core/runtime";
import { createRuntimeProviderRegistry } from "@cavi-ai/api-client/core/runtime/providers";
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes";
import { AGY_PROVIDER_MODULE, AgyApiClient, createAgyProviderModule } from "@cavi-ai/api-client/providers/agy";
import { OpenCodeApiClient, OPENCODE_RUNTIME_SUPPORT, createOpenCodeProviderModule } from "@cavi-ai/api-client/providers/opencode";
import { LIBRARY_API_BASE_PATH, resolvePluginApiPath, withCaviRuntimeControlProviders } from "@cavi-ai/api-client/extensions/cavi";
import { RUNTIME_CONTROL_SCENARIOS, runRawGatewayConformance, runRuntimeControlScenarios } from "@cavi-ai/api-client/testing";
const symbols = [GATEWAY_RAW_EXTENSION, SUBPATH_GATEWAY_RAW_EXTENSION, createRuntimeControlClient, CapabilityUnavailable, createRuntimeProviderRegistry, HERMES_PROVIDER_MODULE, AGY_PROVIDER_MODULE, AgyApiClient, createAgyProviderModule, OpenCodeApiClient, createOpenCodeProviderModule, OPENCODE_RUNTIME_SUPPORT, withCaviRuntimeControlProviders, RUNTIME_CONTROL_SCENARIOS, runRawGatewayConformance, runRuntimeControlScenarios];
if (symbols.some((symbol) => symbol === undefined)) throw new Error("packed runtime-control export missing");
if (GATEWAY_RAW_EXTENSION !== SUBPATH_GATEWAY_RAW_EXTENSION || GATEWAY_RAW_EXTENSION.id !== "gateway.raw") throw new Error("packed raw-gateway descriptor mismatch");
const packedAgyModule = createAgyProviderModule({ apiKey: "packed-test-key" });
const packedAgyClient = packedAgyModule.createClient?.({ baseUrl: "https://agy.example" });
if (AGY_PROVIDER_MODULE.kind !== "agy") throw new Error("packed AGY provider module kind mismatch");
if (packedAgyModule.kind !== "agy") throw new Error("created AGY provider module kind mismatch");
if (!(packedAgyClient instanceof AgyApiClient)) throw new Error("created AGY client type mismatch");
const openCodeRequests = [{ method: "", url: "" }];
const packedOpenCodeFetch = async function () {
  const input = arguments[0];
  const init = arguments[1];
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  openCodeRequests.push({ method: init?.method ?? (input instanceof Request ? input.method : "GET"), url });
  if (url === "https://opencode.example/global/health") {
    return new Response(JSON.stringify({ healthy: true, version: "1.18.27" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("unexpected packed OpenCode request: " + url);
};
const packedOpenCodeModule = createOpenCodeProviderModule({ baseUrl: "https://opencode.example", scope: { directory: "/repo" }, fetchImpl: packedOpenCodeFetch });
const packedOpenCodeClient = packedOpenCodeModule.createClient();
if (packedOpenCodeModule.kind !== "opencode") throw new Error("created OpenCode provider module kind mismatch");
if (!(packedOpenCodeClient instanceof OpenCodeApiClient)) throw new Error("created OpenCode client type mismatch");
if (OPENCODE_RUNTIME_SUPPORT.runs !== true || OPENCODE_RUNTIME_SUPPORT.streaming !== true) throw new Error("packed OpenCode capability mismatch");
openCodeRequests.length = 0;
await packedOpenCodeClient.probeHealth();
if (openCodeRequests.length !== 1 || openCodeRequests[0].method !== "GET" || openCodeRequests[0].url !== "https://opencode.example/global/health") throw new Error("packed OpenCode captured baseUrl or health request mismatch");
if (LIBRARY_API_BASE_PATH !== "/api/plugins/library") throw new Error("packed library base path export missing");
if (resolvePluginApiPath("machine", "media") !== "/api/plugins/machine/media") throw new Error("packed plugin path resolver missing");
`;

const typeAssertions = `
import type { RuntimeControlScenarioEnvironment, RuntimeControlScenarioResult } from "@cavi-ai/api-client/testing";
import type { RawGatewayConformanceFactory, RawGatewayConformanceFixture, RawGatewayConformanceReport } from "@cavi-ai/api-client/testing";
import type { RawGatewayChannel, RawGatewayConnectionState, RawGatewayEvent, RawGatewayRequestOptions } from "@cavi-ai/api-client";
import type { RuntimeControlClientOptions } from "@cavi-ai/api-client";
import type { CreateApiClientOptions, RuntimeClientOptions } from "@cavi-ai/api-client";
import type { RuntimeClientOptions as SubpathRuntimeClientOptions } from "@cavi-ai/api-client/core/runtime/providers";
import type { RuntimeProviderModule } from "@cavi-ai/api-client/core/runtime/providers";
import type { AgyApiClientOptions } from "@cavi-ai/api-client/providers/agy";
import type { OpenCodeApiClientOptions } from "@cavi-ai/api-client/providers/opencode";
import type { GatewayRpcClientOptions } from "@cavi-ai/api-client/core/gateway";
import type { RawGatewayChannel as SubpathRawGatewayChannel } from "@cavi-ai/api-client/core/runtime";
const scenarioEnvironment = null as RuntimeControlScenarioEnvironment | null;
const scenarioResult = null as RuntimeControlScenarioResult | null;
const rawChannel = null as (RawGatewayChannel & SubpathRawGatewayChannel) | null;
const rawState = null as RawGatewayConnectionState | null;
const rawEvent = null as RawGatewayEvent | null;
const rawOptions = null as RawGatewayRequestOptions | null;
const rawConformanceFactory = null as RawGatewayConformanceFactory | null;
const rawConformanceFixture = null as RawGatewayConformanceFixture | null;
const rawConformanceReport = null as RawGatewayConformanceReport | null;
const gatewayConnection = null as GatewayRpcClientOptions | null;
const runtimeOptions: RuntimeControlClientOptions = gatewayConnection === null ? {} : { gatewayConnection };
const runtimeHttpOptions: RuntimeClientOptions = {
  baseUrl: "https://runtime.example",
  defaultTimeoutMs: 0,
  cache: "reload",
  credentials: "include",
  onTrace: (trace) => void trace,
};
const subpathRuntimeHttpOptions: SubpathRuntimeClientOptions = runtimeHttpOptions;
const facadeHttpOptions: CreateApiClientOptions = {
  defaultTimeoutMs: 0,
  cache: "reload",
  credentials: "include",
  onTrace: (trace) => void trace,
};
const agyOptions: AgyApiClientOptions = {
  baseUrl: "https://agy.example",
  apiKey: "packed-test-key",
  defaultTimeoutMs: 0,
  cache: "reload",
  credentials: "include",
};
const typedAgyModule: RuntimeProviderModule = packedAgyModule;
const opencodeOptions: OpenCodeApiClientOptions = { baseUrl: "https://opencode.example", scope: { directory: "/repo" } };
const typedOpenCodeModule: RuntimeProviderModule = packedOpenCodeModule;
// @ts-expect-error provider authentication stays provider-owned
const invalidRuntimeAuth: RuntimeClientOptions = { auth: { bearerToken: "secret" } };
// @ts-expect-error generic headers stay provider-owned
const invalidRuntimeHeaders: RuntimeClientOptions = { defaultHeaders: { authorization: "secret" } };
void scenarioEnvironment;
void scenarioResult;
void rawChannel;
void rawState;
void rawEvent;
void rawOptions;
void rawConformanceFactory;
void rawConformanceFixture;
void rawConformanceReport;
void runtimeOptions;
void runtimeHttpOptions;
void subpathRuntimeHttpOptions;
void facadeHttpOptions;
void agyOptions;
void typedAgyModule;
void opencodeOptions;
void typedOpenCodeModule;
void invalidRuntimeAuth;
void invalidRuntimeHeaders;
`;

try {
  mkdirSync(packDirectory, { recursive: true });
  mkdirSync(extractedDirectory, { recursive: true });
  mkdirSync(consumerDirectory, { recursive: true });
  command("pnpm", ["run", "clean"]);
  command(join(packageRoot, "node_modules/.bin/tsc"), []);
  const packOutput = command("npm", [
    "pack", "--ignore-scripts", "--pack-destination", packDirectory,
  ], packageRoot, { ...process.env, npm_config_cache: join(temporaryRoot, "npm-cache") });
  const packedName = packOutput.trim().split("\n").at(-1);
  const tarball = packedName ? join(packDirectory, packedName) : undefined;
  if (!tarball) throw new Error("pnpm pack did not report a tarball");
  command("tar", ["-xzf", tarball, "-C", extractedDirectory]);
  mkdirSync(dirname(installedPackage), { recursive: true });
  cpSync(join(extractedDirectory, "package"), installedPackage, { recursive: true });
  writeFileSync(join(consumerDirectory, "package.json"), '{"type":"module"}\n');
  writeFileSync(join(consumerDirectory, "consumer.mjs"), imports);
  writeFileSync(join(consumerDirectory, "consumer.ts"), imports + typeAssertions);
  writeFileSync(join(consumerDirectory, "tsconfig.json"), `{
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "noEmit": true,
      "skipLibCheck": true
    },
    "include": ["consumer.ts"]
  }\n`);
  command(process.execPath, [join(consumerDirectory, "consumer.mjs")], consumerDirectory);
  command(join(packageRoot, "node_modules/.bin/tsc"), ["-p", join(consumerDirectory, "tsconfig.json")]);
  const installedManifest = JSON.parse(readFileSync(join(installedPackage, "package.json"), "utf8"));
  process.stdout.write(`packed ESM and NodeNext consumer passed for ${installedManifest.name}@${installedManifest.version}\n`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
