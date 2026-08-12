// ─── Vercel API push (per-client account) ────────────────────────────────────
// Har client ke APNE Vercel account ka token + project ID use hota hai
// (client_credentials mein encrypted store rehta hai). Ye module server-only hai.
// Docs:
//   env:      POST /v10/projects/{id}/env?upsert=true
//   redeploy: GET /v6/deployments?projectId=...  → POST /v13/deployments { deploymentId, target }

export type VercelEnvVar = { key: string; value: string };

const VERIFY_ENV_KEYS = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LICENSE_SERVICE_URL",
  "LICENSE_SERVICE_ANON_KEY",
  "SETUP_TOKEN",
]);

export async function pushEnvToVercel(
  token: string,
  projectIdOrName: string,
  vars: VercelEnvVar[]
): Promise<{ created: number; skipped: number }> {
  if (!token.trim()) throw new Error("Vercel API token required");
  if (!projectIdOrName.trim()) throw new Error("Vercel project ID/name required");

  const body = vars
    .filter((v) => v.key && v.value && VERIFY_ENV_KEYS.has(v.key))
    .map((v) => ({
      key: v.key,
      value: v.value,
      type: "encrypted",
      target: ["production", "preview"],
      comment: "vtech setup-kit auto",
    }));

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdOrName)}/env?upsert=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d?.error?.message as string) || `Vercel env fail (${res.status})`);
  }
  return { created: body.length, skipped: vars.length - body.length };
}

// Custom domain attach — POST /v10/projects/{idOrName}/domains
// Domain already attached/draft ho to 400/409 aata hai → treat as success.
export async function addDomainToVercel(
  token: string,
  projectIdOrName: string,
  domain: string
): Promise<{ verified: boolean; alreadyExists: boolean }> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdOrName)}/domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );

  if (res.status === 400 || res.status === 409) {
    return { verified: true, alreadyExists: true };
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d?.error?.message as string) || `Vercel domain fail (${res.status})`);
  }
  const data = await res.json();
  return { verified: data?.verified === true, alreadyExists: false };
}

export async function triggerVercelDeploy(
  token: string,
  projectIdOrName: string
): Promise<{ url: string; readyState: string }> {
  // Latest PRODUCTION deployment dhoondo. List endpoint ab /v7 hai (v6 deprecated) aur
  // deployment ID `id` ya `uid` dono me aa sakti hai — dono handle karo.
  const listRes = await fetch(
    `https://api.vercel.com/v7/deployments?projectId=${encodeURIComponent(projectIdOrName)}&limit=1&target=production`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    const d = await listRes.json().catch(() => ({}));
    throw new Error((d?.error?.message as string) || `Vercel deployments list fail (${listRes.status})`);
  }
  const data = await listRes.json().catch(() => ({}));
  const last = data?.deployments?.[0];
  const lastId = last?.id || last?.uid;

  // Redeploy target: koi deployment mila → usse redeploy (latest commit ke saath).
  // Nahi mila (naya project / list API mismatch) → connected Git repo se naya deploy trigger.
  let body: Record<string, unknown>;
  if (lastId) {
    // POST /v13/deployments me `name` required hai — redeploy par bhi. 
    // List response me deployment ka project name milta hai.
    body = {
      name: last?.name || projectIdOrName,
      deploymentId: lastId,
      target: "production",
      withLatestCommit: true,
    };
  } else {
    const projRes = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!projRes.ok) {
      const d = await projRes.json().catch(() => ({}));
      throw new Error((d?.error?.message as string) || `Vercel project lookup fail (${projRes.status})`);
    }
    const proj = await projRes.json().catch(() => ({}));
    const link = proj?.link;
    if (link?.type === "github" && link.org && link.repo) {
      body = {
        name: proj.name || projectIdOrName,
        gitSource: {
          type: "github",
          org: link.org,
          repo: link.repo,
          ref: link.productionBranch || "main",
        },
        target: "production",
      };
    } else {
      throw new Error(
        "Is project ka koi deployment nahi mila aur Git repo (GitHub) bhi connect nahi hai. " +
        "Pehle code push karke ek build hone do, phir ye dobara dabao."
      );
    }
  }

  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d?.error?.message as string) || `Vercel redeploy fail (${res.status})`);
  }
  const dep = await res.json();
  return { url: dep?.url || "", readyState: dep?.readyState || "BUILDING" };
}
