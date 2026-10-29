#!/usr/bin/env node
/**
 * Self-contained load test for Kadsamis — no external tooling (k6/artillery)
 * needed, just Node's built-in fetch. Ramps concurrent virtual users through
 * a few stages against a running instance of the app and reports RPS,
 * error rate, and latency percentiles per stage.
 *
 * Reads (never logs their values):
 *   - .env.local for NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *     — both already required to run the app at all, not secret.
 *   - K6_TEST_EMAIL / K6_TEST_PASSWORD from the process environment, to log
 *     in a disposable test account and exercise authenticated endpoints.
 *     If unset, the run falls back to public-endpoints-only.
 *
 * Usage:
 *   node scripts/load-test.mjs [--base-url=http://localhost:3000]
 *
 * Scope, deliberately: GET-only, read-only endpoints. Never touches
 * anything that mutates data (no create-organization, send-notification,
 * bulk import, delete, etc.) — this measures read capacity, not a stress
 * test that leaves garbage data behind.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const fileEnv = loadEnvFile(join(__dirname, "..", ".env.local"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const baseUrlArg = process.argv.find((a) => a.startsWith("--base-url="));
const BASE_URL = (baseUrlArg ? baseUrlArg.split("=")[1] : null) || process.env.LOAD_TEST_BASE_URL || "http://localhost:3000";

const TEST_EMAIL = process.env.K6_TEST_EMAIL;
const TEST_PASSWORD = process.env.K6_TEST_PASSWORD;

async function login() {
  if (!TEST_EMAIL || !TEST_PASSWORD) return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("Supabase URL/anon key not found in .env.local — skipping authenticated endpoints.");
    return null;
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) {
    console.warn(`Test-account login failed (HTTP ${res.status}) — continuing with public endpoints only.`);
    return null;
  }
  const json = await res.json();
  return json.access_token || null;
}

function buildScenarios(token) {
  const scenarios = [
    { name: "GET /", path: "/", weight: 3 },
    { name: "GET /api/public/stats", path: "/api/public/stats", weight: 3 },
    { name: "GET /auth/login", path: "/auth/login", weight: 2 },
    { name: "GET /offline", path: "/offline", weight: 1 },
  ];

  if (token) {
    scenarios.push(
      { name: "GET /api/dashboard/summary", path: "/api/dashboard/summary", weight: 3, auth: true },
      { name: "GET /api/admin/assets", path: "/api/admin/assets", weight: 3, auth: true },
      { name: "GET /api/notifications", path: "/api/notifications", weight: 2, auth: true }
    );
  }

  // Expand into a flat weighted pool rather than weighted random-selection
  // math — simpler and just as correct for this sample size.
  const weighted = [];
  for (const s of scenarios) for (let i = 0; i < s.weight; i++) weighted.push(s);
  return weighted;
}

function percentile(sortedLatencies, p) {
  if (sortedLatencies.length === 0) return 0;
  const idx = Math.min(sortedLatencies.length - 1, Math.floor((p / 100) * sortedLatencies.length));
  return sortedLatencies[idx];
}

// Fabricates a distinct-looking private IP per (stage, VU) pair. The app's
// rate limiter keys on getClientIdentifier(), which reads x-forwarded-for /
// x-real-ip and falls back to a single shared "unknown" bucket when
// neither is set — exactly what a bare Node fetch client hits by default,
// collapsing every VU into one 120-req/min budget regardless of how many
// VUs are running. Spoofing a unique header per VU (salted per stage, so
// stage N+1 doesn't inherit stage N's already-partially-consumed window)
// mimics many distinct real clients instead, which is what's needed to see
// the endpoint's actual throughput ceiling rather than the rate limiter's.
function fakeIpFor(stageSeed, vuIndex) {
  return `10.${stageSeed}.${Math.floor(vuIndex / 256)}.${vuIndex % 256}`;
}

async function runVU(scenarios, token, endTime, results, clientIp) {
  while (performance.now() < endTime) {
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const start = performance.now();
    let status = 0;
    let ok = false;
    try {
      const res = await fetch(`${BASE_URL}${scenario.path}`, {
        headers: {
          "x-forwarded-for": clientIp,
          ...(scenario.auth ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      status = res.status;
      ok = res.status < 500; // 4xx counts as "handled", 5xx/network failure counts as an error
      await res.arrayBuffer(); // drain the body so the connection returns to the pool
    } catch {
      status = 0;
      ok = false;
    }
    results.push({ scenario: scenario.name, latency: performance.now() - start, status, ok });
  }
}

async function runStage(label, vus, durationMs, scenarios, token) {
  const results = [];
  const endTime = performance.now() + durationMs;
  const stageSeed = 1 + Math.floor(Math.random() * 250);
  const wallStart = performance.now();
  await Promise.all(
    Array.from({ length: vus }, (_, i) => runVU(scenarios, token, endTime, results, fakeIpFor(stageSeed, i)))
  );
  const wallMs = performance.now() - wallStart;

  const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  const statusCounts = {};
  for (const r of results) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

  const summary = {
    label,
    vus,
    requests: results.length,
    rps: results.length / (wallMs / 1000),
    errorRate: results.length ? errors.length / results.length : 0,
    p50: percentile(latencies, 50),
    p90: percentile(latencies, 90),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1] ?? 0,
    statusCounts,
  };

  console.log(`\n--- Stage: ${label} (${vus} VUs, ${(durationMs / 1000).toFixed(0)}s) ---`);
  console.log(
    `Requests: ${summary.requests}  |  RPS: ${summary.rps.toFixed(1)}  |  Errors (5xx/network): ${errors.length} (${(summary.errorRate * 100).toFixed(2)}%)`
  );
  console.log(
    `Latency ms — p50 ${summary.p50.toFixed(0)} | p90 ${summary.p90.toFixed(0)} | p95 ${summary.p95.toFixed(0)} | p99 ${summary.p99.toFixed(0)} | max ${summary.max.toFixed(0)}`
  );
  console.log("Status codes:", statusCounts);

  return summary;
}

async function main() {
  console.log(`Load test target: ${BASE_URL}`);
  const token = await login();
  console.log(token ? "Authenticated — testing public + authenticated endpoints." : "No test credentials resolved — testing public endpoints only.");
  const scenarios = buildScenarios(token);
  console.log("Scenarios:", [...new Set(scenarios.map((s) => s.name))].join(", "));

  // Deliberately bounded, not an unbounded stress-to-destruction run — this
  // still exercises the real Supabase project behind BASE_URL even when
  // BASE_URL itself is localhost, so the ramp stays moderate by design.
  const stages = [
    { label: "warm-up", vus: 5, durationMs: 15_000 },
    { label: "ramp-15", vus: 15, durationMs: 20_000 },
    { label: "ramp-30", vus: 30, durationMs: 20_000 },
    { label: "ramp-60", vus: 60, durationMs: 20_000 },
    { label: "push-100", vus: 100, durationMs: 15_000 },
  ];

  const summaries = [];
  for (const stage of stages) {
    summaries.push(await runStage(stage.label, stage.vus, stage.durationMs, scenarios, token));
  }

  console.log("\n=== Summary ===");
  console.table(
    summaries.map((s) => ({
      stage: s.label,
      VUs: s.vus,
      requests: s.requests,
      RPS: s.rps.toFixed(1),
      "error %": (s.errorRate * 100).toFixed(2),
      "p50 ms": s.p50.toFixed(0),
      "p95 ms": s.p95.toFixed(0),
      "p99 ms": s.p99.toFixed(0),
    }))
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
