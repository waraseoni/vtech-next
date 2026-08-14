// Public site identity — har client ke apne Vercel project mein
// NEXT_PUBLIC_SITE_* env vars se override hota hai. Nahi diya to
// seller ka default (V-Technologies) aata hai.
//
// ⚠️ IMPORTANT: sirf DIRECT process.env.NEXT_PUBLIC_X access use karo.
// Dynamic access (process.env[key]) ko Next.js client bundle mein inline
// NAHI karta — browser mein undefined milta hai, hydration ke baad
// fallback (hardcoded) dikhne lagta hai.

import type { ArtKind } from "./components/equipment-art";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const SITE_NAME =
  (process.env.NEXT_PUBLIC_SITE_NAME || "V-Technologies").trim();
const SITE_PHONE =
  (process.env.NEXT_PUBLIC_SITE_PHONE || "+91 91791 05875").trim();
const SITE_PHONE_DIGITS = digitsOnly(SITE_PHONE);

export const SITE = {
  name: SITE_NAME,
  shortName: (
    process.env.NEXT_PUBLIC_SITE_SHORT_NAME ||
    SITE_NAME.split(/\s+/)[0] ||
    SITE_NAME
  ).trim(),
  tagline: (
    process.env.NEXT_PUBLIC_SITE_TAGLINE || "Repair & Service Experts"
  ).trim(),
  owner: (process.env.NEXT_PUBLIC_SITE_OWNER || "Vikram Jain").trim(),
  phone: SITE_PHONE,
  phoneHref: (
    process.env.NEXT_PUBLIC_SITE_PHONE_HREF ||
    (SITE_PHONE_DIGITS ? `tel:+${SITE_PHONE_DIGITS}` : "#")
  ).trim(),
  whatsapp: (
    process.env.NEXT_PUBLIC_SITE_WHATSAPP ||
    (SITE_PHONE_DIGITS ? `https://wa.me/${SITE_PHONE_DIGITS}` : "#")
  ).trim(),
  email: (
    process.env.NEXT_PUBLIC_SITE_EMAIL || "vtech.jbp@gmail.com"
  ).trim(),
  address: (
    process.env.NEXT_PUBLIC_SITE_ADDRESS ||
    "F4 Hotel Plaza (Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, MP 482002"
  ).trim(),
};

export const WHATSAPP_LINK = (text: string) =>
  `${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

type ServiceDef = { href: string; label: string; desc: string; art: ArtKind };

const KNOWN_SERVICES: Record<string, ServiceDef> = {
  "stage-lighting": {
    href: "/stage-lighting",
    label: "Stage Lighting",
    desc: "Moving Head, Par, DMX, Laser, LED Wall, Fog Machine",
    art: "moving-head",
  },
  industrial: {
    href: "/industrial",
    label: "Industrial Electronics",
    desc: "PLC, HMI, Control Panel, VFD, SCADA, Servo",
    art: "plc",
  },
  "power-supply": {
    href: "/power-supply",
    label: "Power Supply",
    desc: "SMPS, EV Charger, UPS, Inverter, LED Driver",
    art: "smps",
  },
};

// Comma-separated list: "stage-lighting,industrial". Khali ("") = koi service nahi.
const SERVICES_ENV = (
  process.env.NEXT_PUBLIC_SITE_SERVICES ||
  "stage-lighting,industrial,power-supply"
).trim();

export const SERVICES: ServiceDef[] = SERVICES_ENV
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
  .map((s) => KNOWN_SERVICES[s])
  .filter((s): s is ServiceDef => !!s);
