// Vercel se purane deployments delete karta hai taaki Deployment Storage
// kam rahe. GitHub Action (weekly cron) se chalta hai.
//
// Guardrails:
//  - Hamesha latest 3 production + 2 preview deployments RAKHTA hai (rollback
//    + demo ke liye) — chahe kitne purane ho.
//  - Sirf READY/ERROR/CANCELED ko delete karta hai; BUILDING/QUEUED/INITIALIZING
//    ko haath nahi lagata.
//  - `softDeletedByRetention` (Vercel retention policy ne pehle hi delete kiya)
//    ko skip karta hai.
//  - Production `target` wala (jo alias se live hai) kabhi delete nahi hota.
//
// Env:
//   VERCEL_TOKEN      (zaroori)  — Vercel → Settings → Tokens → Create
//   VERCEL_PROJECT_ID (zaroori)  — Vercel → Project → Settings → General
//   VERCEL_TEAM_ID    (optional) — personal account me skip; team me chahiye

const token = process.env.VERCEL_TOKEN;
const projectId = process.env.VERCEL_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID || "";

const ONE_DAY = 86400_000;

// Retention (din) — Vercel Dashboard settings se match karta hai:
// prod 30, pre-production 7, errored 3, canceled 1.
const RETENTION = {
  production: 30,
  staging: 7,
  errored: 3,
  canceled: 1,
};

// Hamesha latest kitne production/preview rakein (rollback + demo).
const ALWAYS_KEEP = { production: 3, staging: 2 };

if (!token || !projectId) {
  console.error("VERCEL_TOKEN aur VERCEL_PROJECT_ID dono zaroori hain.");
  process.exit(1);
}

function apiUrl(path, params = {}) {
  const qs = new URLSearchParams(params);
  if (teamId) qs.set("teamId", teamId);
  return `https://api.vercel.com${path}?${qs}`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status} ${res.url}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function listAllDeployments() {
  const all = [];
  let until = undefined;
  for (let page = 0; page < 50; page++) {
    const params = { projectId, limit: "100" };
    if (until) params.until = String(until);
    const body = await fetchJson(apiUrl("/v6/deployments", params));
    const items = body.deployments || [];
    all.push(...items);
    const next = body.pagination?.next;
    if (items.length === 0 || !next) break;
    until = next;
  }
  return all;
}

function createdAt(d) {
  return d.created ?? d.createdAt ?? 0;
}

function shouldDelete(d, counts) {
  const state = d.state || d.readyState || "";
  if (["BUILDING", "INITIALIZING", "QUEUED", "BLOCKED", "DELETED"].includes(state)) {
    return false;
  }
  if (d.softDeletedByRetention) return false;

  const created = createdAt(d);
  if (!created) return false;
  const ageDays = (Date.now() - created) / ONE_DAY;

  const target = (d.target || "").toLowerCase(); // "production" | "staging" | ""
  if (target === "production") {
    if (counts.production < ALWAYS_KEEP.production) {
      counts.production++;
      return false;
    }
    return ageDays > RETENTION.production;
  }
  if (target === "staging") {
    if (counts.staging < ALWAYS_KEEP.staging) {
      counts.staging++;
      return false;
    }
    return ageDays > RETENTION.staging;
  }
  // Target nahi → preview/general wala.
  if (state === "ERROR") return ageDays > RETENTION.errored;
  if (state === "CANCELED") return ageDays > RETENTION.canceled;
  return ageDays > RETENTION.staging;
}

async function main() {
  console.log("Vercel se deployments fetch kar raha hoon...");
  const deployments = (await listAllDeployments())
    .filter((d) => d.readyState && d.readyState !== "DELETED")
    .sort((a, b) => createdAt(b) - createdAt(a));

  console.log(`Total (non-deleted): ${deployments.length}`);

  const counts = { production: 0, staging: 0 };
  const toDelete = deployments.filter((d) => shouldDelete(d, counts));

  if (toDelete.length === 0) {
    console.log("Delete karne layak kuch nahi mila. Done.");
    return;
  }

  console.log(`\n${toDelete.length} deployment(s) delete ho rahe hain:`);
  let deleted = 0;
  let failed = 0;
  for (const d of toDelete) {
    const when = new Date(createdAt(d)).toISOString().slice(0, 10);
    const label = `${d.uid} (${d.target || "preview"}, ${when})`;
    try {
      await fetchJson(apiUrl(`/v13/deployments/${d.uid}`), { method: "DELETE" });
      console.log(`  DELETED  ${label}`);
      deleted++;
    } catch (err) {
      console.error(`  FAILED   ${label} — ${err.message}`);
      failed++;
    }
  }
  console.log(`\nDone: ${deleted} deleted, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});