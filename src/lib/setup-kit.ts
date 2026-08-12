import { createHmac } from "node:crypto";

// ─── Client Setup Kit — shared builder ───────────────────────────────────────
// Ye module CLI script (scripts/make-client-package.mjs) AUR seller portal ke
// /api/seller/setup-kit route dono use karte hain — single source of truth.
// Dependency-free (sirf node:crypto) taaki plain Node bhi import kar sake.

export type SetupKitInput = {
  slug: string;
  shopName: string;
  appUrl?: string;
  licenseKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  setupToken?: string;
  licenseServiceUrl?: string;
  licenseServiceAnonKey?: string;
};

export type SetupKitFiles = Record<string, string>;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Deterministic per-client setup token — licenseId + seller secret se derive.
// Naya token har baar alag nahi aata (seller download karke client ko de sakta hai).
export function deriveSetupToken(licenseId: number): string {
  const secret =
    process.env.SELLER_CREDS_ENCRYPTION_KEY ||
    process.env.LICENSE_SERVICE_SERVICE_ROLE_KEY ||
    "vtech-setup-token-fallback";
  return createHmac("sha256", secret).update(`setup-token:${licenseId}`).digest("hex").slice(0, 24);
}

function envContent(c: SetupKitInput): string {
  const lines = [
    "# V-TECH PRO - client package env (client ke apne data project ke liye)",
    `# Shop: ${c.shopName}`,
    `NEXT_PUBLIC_SUPABASE_URL=${c.supabaseUrl}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${c.supabaseAnonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${c.supabaseServiceRoleKey}`,
    "",
    "# License service (seller ka central project - SAME har client ke liye)",
    `LICENSE_SERVICE_URL=${c.licenseServiceUrl || ""}`,
    `LICENSE_SERVICE_ANON_KEY=${c.licenseServiceAnonKey || ""}`,
    "",
    "# Optional: setup page ko sirf is token se admin banane do",
    c.setupToken ? `SETUP_TOKEN=${c.setupToken}` : "# SETUP_TOKEN=",
    "",
    "# WARNING: Is package mein SELLER PORTAL vars nahi daalein:",
    "#    (LICENSE_SERVICE_SERVICE_ROLE_KEY, SELLER_PORTAL_PASSWORD, DEV_PORTAL_PASSWORD)",
    "#    Inke bina client ke admin ko navigation mein Seller/Developer portals NAHI dikhte.",
  ];
  return lines.join("\n") + "\n";
}

function setupMd(c: SetupKitInput): string {
  const tokenLine = c.setupToken
    ? `Setup token (pehli baar admin banane ke liye): \`${c.setupToken}\` — ya URL mein: \`?setup_token=${c.setupToken}\``
    : "Setup token ki zaroorat nahi (seller ne optional rakha hai).";
  return `# ${c.shopName} - Setup Guide (Client ke liye)

Ye aapka V-TECH PRO management system hai. Bas 3 chhote steps:

## Step 1 - URL kholo
Browser mein ye kholo: **${c.appUrl || "APP_URL_HERE"}**

## Step 2 - Admin account banao (sirf pehli baar)
1. Pehli baar khulne par "Initial Setup" page dikhega.
2. Apna **naam, email aur password** set karo.
   ${tokenLine}
3. "Create Admin" dabao - ho gaya.

## Step 3 - License key daalo
1. Login karo (abhi banaya email/password).
2. Login ke baad "Trial Mode" / "License" gate dikhega - wahi key daal do:
   \`${c.licenseKey}\`
3. Activate - aapka system chal gaya. ✅

> Koi aur user/staff add karna ho to: Settings → Users → Create User.
> Help ke liye seller (V-Technologies) se contact karein.

---
_Generated: ${new Date().toISOString()} · V-TECH PRO Client Package_
`;
}

function deployMd(c: SetupKitInput): string {
  return `# ${c.shopName} - Deploy Guide (Seller ke liye)

Client data project + deployment set karne ke steps. Har client ke liye 15-20 min.

## 1. Supabase project (client ka DATA project)
- https://supabase.com par naya project banao (region koi bhi, free plan kaafi).
- Niche wale values is project ke hain:
  - Project URL: \`${c.supabaseUrl}\`
  - Anon key: \`${c.supabaseAnonKey}\`
  - Service Role key: \`${c.supabaseServiceRoleKey}\`

## 2. Schema lagao (CLI)
\`\`\`bash
supabase login
supabase link --project-ref <PROJECT_REF>   # URL se ref: https://<ref>.supabase.co
supabase db push                             # supabase/migrations/ se poora schema
\`\`\`
> Agar CLI nahi hai: SQL Editor mein har migration file copy-paste kar sakte ho.

## 3. Deployment (Vercel ya koi Node host)
- Repo (client package wala code) import karo.
- Env vars set karo - \`.env.production\` ka content hosting ke env mein paste karo.
- Build command: \`npm ci && npm run build\`, Start: \`npm start\`.
- Deploy ke baad app URL: \`${c.appUrl || "..."}\`

## 4. Client ko do
- App URL
- \`SETUP.md\` ka Step 2 (setup token agar hai)
- License key: \`${c.licenseKey}\`

## 5. Seller portal mein update (optional)
Client ke "Client Details" page mein Supabase/GitHub/Vercel credentials + app URL save karo.

---
_Generated: ${new Date().toISOString()}_
`;
}

export function buildSetupKitFiles(c: SetupKitInput): SetupKitFiles {
  return {
    ".env.production": envContent(c),
    "LICENSE_KEY.txt": `${c.licenseKey}\n`,
    "SETUP.md": setupMd(c),
    "DEPLOY.md": deployMd(c),
    "app-info.json":
      JSON.stringify(
        {
          slug: c.slug,
          shopName: c.shopName,
          appUrl: c.appUrl || "",
          licenseKey: c.licenseKey,
          supabaseUrl: c.supabaseUrl,
          licenseServiceConfigured: !!(c.licenseServiceUrl && c.licenseServiceAnonKey),
          setupTokenSet: !!c.setupToken,
          generatedAt: new Date().toISOString(),
        },
        null,
        2
      ) + "\n",
  };
}

// Env + package fields se seedha zip (seller/dev setup-kit routes use karte hain).
export function buildSetupKitZip(params: {
  slug: string;
  shopName: string;
  appUrl: string;
  licenseKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  setupToken: string;
}): Uint8Array {
  return zipFiles(
    buildSetupKitFiles({
      slug: params.slug,
      shopName: params.shopName,
      appUrl: params.appUrl,
      licenseKey: params.licenseKey,
      supabaseUrl: params.supabaseUrl,
      supabaseAnonKey: params.supabaseAnonKey,
      supabaseServiceRoleKey: params.supabaseServiceRoleKey,
      setupToken: params.setupToken,
      licenseServiceUrl: process.env.LICENSE_SERVICE_URL,
      licenseServiceAnonKey: process.env.LICENSE_SERVICE_ANON_KEY,
    })
  );
}

// ─── Minimal ZIP writer (store, no compression — dependency-free) ──────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(): { time: number; date: number } {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export function zipFiles(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  const { time, date } = dosDateTime();
  let offset = 0;

  for (const name of Object.keys(files)) {
    const nameBuf = enc.encode(name);
    const data = enc.encode(files[name]);
    const crc = crc32(data);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true); // version
    lh.setUint16(6, 0, true); // flags
    lh.setUint16(8, 0, true); // method: store
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameBuf.length, true);
    lh.setUint16(28, 0, true); // extra len

    const entry = new Uint8Array(30 + nameBuf.length + data.length);
    entry.set(new Uint8Array(lh.buffer), 0);
    entry.set(nameBuf, 30);
    entry.set(data, 30 + nameBuf.length);
    local.push(entry);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true); // version made by
    ch.setUint16(6, 20, true); // version needed
    ch.setUint16(8, 0, true); // flags
    ch.setUint16(10, 0, true); // method
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameBuf.length, true);
    ch.setUint16(30, 0, true); // extra len
    ch.setUint16(32, 0, true); // comment len
    ch.setUint16(34, 0, true); // disk
    ch.setUint16(36, 0, true); // internal attrs
    ch.setUint32(38, 0, true); // external attrs
    ch.setUint32(42, offset, true); // local header offset

    const cent = new Uint8Array(46 + nameBuf.length);
    cent.set(new Uint8Array(ch.buffer), 0);
    cent.set(nameBuf, 46);
    central.push(cent);

    offset += entry.length;
  }

  const centralSize = central.reduce((a, b) => a + b.length, 0);
  const cdStart = local.reduce((a, b) => a + b.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true); // disk
  eocd.setUint16(6, 0, true); // cd start disk
  eocd.setUint16(8, central.length, true);
  eocd.setUint16(10, central.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, cdStart, true);
  eocd.setUint16(20, 0, true); // comment len

  const out = new Uint8Array(cdStart + centralSize + 22);
  let pos = 0;
  for (const b of [...local, ...central]) {
    out.set(b, pos);
    pos += b.length;
  }
  out.set(new Uint8Array(eocd.buffer), pos);
  return out;
}
