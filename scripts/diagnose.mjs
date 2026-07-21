#!/usr/bin/env node
// @cavi-ai/api-client — API surface diagnosis prober.
//
// Reads the package's OWN declared path tables and RPC method lists (from
// dist/), so the prober can never drift from what the package ships: add a route
// or method, and it is probed automatically. Two modes:
//
//   static  — offline. Contract self-consistency + drift vs native OpenClaw
//             source (when OPENCLAW_SOURCE_DIR is set). No network. CI-safe.
//   live    — probe a running gateway. HTTP routes (GET only, never mutating)
//             and a curated set of READ-ONLY WS RPC methods. Needs GATEWAY_URL.
//
// Usage:
//   node scripts/diagnose.mjs [--mode=static|live|all] [--json] [--strict]
//
// Env:
//   GATEWAY_URL         http(s):// base of the gateway (live mode)
//   AUTH_TOKEN          bearer token (optional; live mode)
//   OPENCLAW_SOURCE_DIR path to a native OpenClaw checkout (static drift check)
//
// Exit codes: static drift / self-consistency failures exit 1 (gateable).
// Live results are informational (a 404 is data, not a tool failure) unless
// --strict is passed, which also fails on live "missing"/"error" classes.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = path.join(ROOT, "dist");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};

const MODE = opt("mode", "all");
const JSON_OUT = flag("json");
const STRICT = flag("strict");
const GATEWAY_URL = (process.env.GATEWAY_URL ?? "").trim();
const AUTH_TOKEN = (process.env.AUTH_TOKEN ?? "").trim() || null;
const OPENCLAW_SOURCE_DIR = (process.env.OPENCLAW_SOURCE_DIR ?? "").trim();

const wantStatic = MODE === "static" || MODE === "all";
const wantLive = MODE === "live" || MODE === "all";

if (!existsSync(path.join(DIST, "index.js"))) {
  console.error("diagnose: dist/ not found — run `pnpm run build` first.");
  process.exit(2);
}

const corePaths = await import(path.join(DIST, "contracts/paths.js"));
const caviPaths = await import(path.join(DIST, "extensions/cavi/contracts/paths.js"));
const workboard = await import(path.join(DIST, "providers/openclaw/workboard.js"));

const report = { static: {}, live: {} };
let failures = 0;

// ── Collect HTTP targets from the package's path tables ──────────────────────
// String values are concrete routes; functions are dynamic (need ids) — recorded
// for inventory but not network-probed. Nested objects are walked one level.
const httpTargets = [];
const dynamicRoutes = [];

function collect(surface, table) {
  for (const [key, value] of Object.entries(table)) {
    if (typeof value === "string" && value.startsWith("/")) {
      httpTargets.push({ surface, key, path: value });
    } else if (typeof value === "function") {
      dynamicRoutes.push({ surface, key });
    } else if (value && typeof value === "object") {
      for (const [k2, v2] of Object.entries(value)) {
        if (typeof v2 === "string" && v2.startsWith("/")) {
          httpTargets.push({ surface, key: `${key}.${k2}`, path: v2 });
        } else if (typeof v2 === "function") {
          dynamicRoutes.push({ surface, key: `${key}.${k2}` });
        }
      }
    }
  }
}

collect("gateway.probe", corePaths.GATEWAY_PROBE_ENDPOINTS);
collect("gateway.wiki", corePaths.GATEWAY_WIKI_API_ENDPOINTS);
collect("gateway.session", corePaths.GATEWAY_SESSION_API_PATHS);
collect("gateway.agentConfig", corePaths.GATEWAY_AGENT_CONFIG_API_ENDPOINTS);
collect("gateway.media", corePaths.GATEWAY_MEDIA_API_ENDPOINTS);
collect("cavi.control", caviPaths.CAVI_CONTROL_API_ENDPOINTS);
collect("cavi.operator", caviPaths.CAVI_CONTROL_OPERATOR_API);
collect("cavi.operatorAlias", caviPaths.CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS);
collect("cavi.library", caviPaths.LIBRARY_API_ENDPOINTS);

// ── READ-ONLY RPC allowlist (never call mutating methods at a live gateway) ───
const safeReadRpc = [
  workboard.OPENCLAW_WORKBOARD_RPC_METHODS.cardsList,
  workboard.OPENCLAW_WORKBOARD_RPC_METHODS.boardsList,
  workboard.OPENCLAW_WORKBOARD_RPC_METHODS.cardsStats,
  workboard.OPENCLAW_WORKBOARD_RPC_METHODS.cardsDiagnostics,
  workboard.OPENCLAW_WORKBOARD_RPC_METHODS.notificationsList,
  caviPaths.CAVI_CONTROL_OPERATOR_RPC_METHODS.status,
  caviPaths.CAVI_CONTROL_OPERATOR_RPC_METHODS.registry,
  caviPaths.CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot,
  caviPaths.CAVI_CONTROL_OPERATOR_RPC_METHODS.tasksList,
  caviPaths.CAVI_CONTROL_OPERATOR_RPC_METHODS.memoryList,
  corePaths.GATEWAY_SYSTEM_RPC_METHODS.health,
];
const allWorkboardRpc = Object.values(workboard.OPENCLAW_WORKBOARD_RPC_METHODS);
const mutatingRpcCount = allWorkboardRpc.filter((m) => !safeReadRpc.includes(m)).length;

// ── STATIC ───────────────────────────────────────────────────────────────────
function runStatic() {
  const out = { nativeDrift: null, divergentRest: [], counts: {} };

  out.counts = {
    httpRoutes: httpTargets.length,
    dynamicRoutes: dynamicRoutes.length,
    workboardRpc: allWorkboardRpc.length,
  };

  // CAVI REST surfaces that have no native OpenClaw owner — server-dependent and
  // the usual source of "declared but nobody serves it → 404 → mock".
  out.divergentRest = httpTargets
    .filter((t) => /cavi-control\/kanban|plugins\/kanban/.test(t.path))
    .map((t) => `${t.surface}:${t.key} ${t.path}`);

  // Drift vs native OpenClaw workboard source (optional — needs a checkout).
  if (OPENCLAW_SOURCE_DIR) {
    const gw = path.join(OPENCLAW_SOURCE_DIR, "extensions/workboard/src/gateway.ts");
    if (existsSync(gw)) {
      const src = readFileSync(gw, "utf8");
      // Match dotted method names without swallowing a trailing dot from prose.
      const native = new Set(src.match(/workboard\.[a-zA-Z]+(?:\.[a-zA-Z]+)*/g) ?? []);
      const declaredButNotNative = allWorkboardRpc.filter((m) => !native.has(m));
      const nativeButNotDeclared = [...native].filter(
        (m) => !allWorkboardRpc.includes(m),
      );
      out.nativeDrift = { declaredButNotNative, nativeButNotDeclared };
      if (declaredButNotNative.length || nativeButNotDeclared.length) failures += 1;
    } else {
      out.nativeDrift = { error: `native workboard gateway.ts not found at ${gw}` };
    }
  }

  report.static = out;
}

// ── LIVE: HTTP (GET only) ─────────────────────────────────────────────────────
function classifyHttp(status, contentType = "") {
  if (status >= 200 && status < 300) {
    // A 2xx that returns the control-UI HTML page is the SPA catch-all
    // swallowing an unknown path — NOT a served API route. Classifying it
    // "live" produced false positives (any GET looked served).
    if (/text\/html/iu.test(contentType)) return "spa-fallback";
    return "live";
  }
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "missing";
  if (status === 405) return "served(other-method)";
  if (status >= 500) return "error";
  return `http-${status}`;
}

async function probeHttp() {
  const base = GATEWAY_URL.replace(/\/+$/, "");
  const headers = AUTH_TOKEN ? { authorization: `Bearer ${AUTH_TOKEN}` } : {};
  const results = [];
  for (const t of httpTargets) {
    const url = `${base}${t.path}`;
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(url, { method: "GET", headers, signal: ac.signal });
      clearTimeout(timer);
      const klass = classifyHttp(res.status, res.headers.get("content-type") ?? "");
      results.push({ surface: t.surface, key: t.key, path: t.path, status: res.status, class: klass });
      if (STRICT && (klass === "missing" || klass === "error")) failures += 1;
    } catch (err) {
      results.push({
        surface: t.surface,
        key: t.key,
        path: t.path,
        status: 0,
        class: "unreachable",
        detail: err instanceof Error ? err.message : String(err),
      });
      if (STRICT) failures += 1;
    }
  }
  return results;
}

// ── LIVE: WS RPC (read-only methods only) ─────────────────────────────────────
function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http/i, "ws").replace(/\/+$/, "");
}

async function probeRpc() {
  if (typeof WebSocket === "undefined") {
    return { skipped: "global WebSocket unavailable (needs Node >= 22)" };
  }
  let client;
  try {
    const factory = await import(path.join(DIST, "core/gateway/index.js"));
    client = factory.createGatewayWebSocketClient(toWsUrl(GATEWAY_URL), AUTH_TOKEN, {
      enableDeviceIdentity: false,
    });
  } catch (err) {
    return { error: `could not build RPC client: ${err instanceof Error ? err.message : err}` };
  }

  const results = [];
  try {
    const ac = new Promise((_, rej) => setTimeout(() => rej(new Error("connect timeout")), 10000));
    await Promise.race([client.connect(), ac]);
  } catch (err) {
    try { await client.close(); } catch { /* ignore */ }
    return { error: `connect failed: ${err instanceof Error ? err.message : err}` };
  }

  for (const method of safeReadRpc) {
    try {
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error("rpc timeout")), 8000));
      await Promise.race([client.request(method, {}), timer]);
      results.push({ method, class: "served" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const klass = /unknown|not found|no such method|unsupported/i.test(msg)
        ? "missing"
        : "error";
      results.push({ method, class: klass, detail: msg });
      if (STRICT && klass === "missing") failures += 1;
    }
  }
  try { await client.close(); } catch { /* ignore */ }
  return {
    probedReadOnly: results,
    notProbed: `${mutatingRpcCount} mutating/unsafe workboard RPC methods declared but not called`,
  };
}

// ── Run ────────────────────────────────────────────────────────────────────--
if (wantStatic) runStatic();

if (wantLive) {
  if (!GATEWAY_URL) {
    report.live = { skipped: "GATEWAY_URL not set" };
  } else {
    report.live.http = await probeHttp();
    report.live.rpc = await probeRpc();
  }
}

// ── Output ─────────────────────────────────────────────────────────────────--
if (JSON_OUT) {
  console.log(JSON.stringify({ ...report, ok: failures === 0 }, null, 2));
} else {
  printHuman();
}
process.exit(failures === 0 ? 0 : 1);

function tallyBy(list, field) {
  const t = {};
  for (const r of list) t[r[field]] = (t[r[field]] ?? 0) + 1;
  return Object.entries(t).map(([k, v]) => `${k}=${v}`).join("  ");
}

function printHuman() {
  console.log(`\n@cavi-ai/api-client — API diagnosis (mode=${MODE})\n`);

  if (wantStatic) {
    const s = report.static;
    console.log("STATIC");
    console.log(`  inventory: ${s.counts.httpRoutes} http routes, ${s.counts.dynamicRoutes} dynamic, ${s.counts.workboardRpc} workboard RPC`);
    if (s.divergentRest.length) {
      console.log(`  CAVI-compat REST (server-dependent, native OpenClaw has no REST owner):`);
      for (const d of s.divergentRest) console.log(`    - ${d}`);
    }
    if (s.nativeDrift) {
      if (s.nativeDrift.error) {
        console.log(`  native drift: ${s.nativeDrift.error}`);
      } else {
        const { declaredButNotNative, nativeButNotDeclared } = s.nativeDrift;
        console.log(`  native workboard drift: declared-not-native=${declaredButNotNative.length}, native-not-declared=${nativeButNotDeclared.length}`);
        for (const m of declaredButNotNative) console.log(`    ! declared but native source lacks: ${m}`);
        for (const m of nativeButNotDeclared) console.log(`    + native source has but we don't mirror: ${m}`);
      }
    } else {
      console.log(`  native drift: skipped (set OPENCLAW_SOURCE_DIR to enable)`);
    }
    console.log("");
  }

  if (wantLive) {
    console.log("LIVE");
    if (report.live.skipped) {
      console.log(`  skipped: ${report.live.skipped}\n`);
    } else {
      const http = report.live.http ?? [];
      console.log(`  HTTP (GET, ${GATEWAY_URL}): ${tallyBy(http, "class")}`);
      for (const r of http.filter((x) => x.class !== "live" && x.class !== "served(other-method)")) {
        console.log(`    [${r.class}] ${r.status} ${r.path}  (${r.surface}:${r.key})`);
      }
      const rpc = report.live.rpc ?? {};
      if (rpc.skipped) console.log(`  RPC: skipped — ${rpc.skipped}`);
      else if (rpc.error) console.log(`  RPC: ${rpc.error}`);
      else {
        console.log(`  RPC (read-only): ${tallyBy(rpc.probedReadOnly, "class")}`);
        for (const r of rpc.probedReadOnly.filter((x) => x.class !== "served")) {
          console.log(`    [${r.class}] ${r.method}`);
        }
        console.log(`  RPC: ${rpc.notProbed}`);
      }
      console.log("");
    }
  }

  console.log(failures === 0 ? "RESULT: ok\n" : `RESULT: ${failures} failure(s)\n`);
}
