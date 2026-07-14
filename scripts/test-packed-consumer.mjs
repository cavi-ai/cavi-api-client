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
import { createRuntimeControlClient } from "@cavi-ai/api-client";
import { CapabilityUnavailable } from "@cavi-ai/api-client/core/runtime";
import { createRuntimeProviderRegistry } from "@cavi-ai/api-client/core/runtime/providers";
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes";
import { withCaviRuntimeControlProviders } from "@cavi-ai/api-client/extensions/cavi";
const symbols = [createRuntimeControlClient, CapabilityUnavailable, createRuntimeProviderRegistry, HERMES_PROVIDER_MODULE, withCaviRuntimeControlProviders];
if (symbols.some((symbol) => symbol === undefined)) throw new Error("packed runtime-control export missing");
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
  writeFileSync(join(consumerDirectory, "consumer.ts"), imports);
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
