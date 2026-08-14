// Public site identity — har client ke apne Vercel project mein
// NEXT_PUBLIC_SITE_* env vars se override hota hai. Nahi diya to
// seller ka default (V-Technologies) aata hai.

import type { ArtKind } from "./components/equipment-art";

const env = (k: string, fb: string): string => {
  const v = process.env[k]?.trim();
  return v ? v : fb;
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

const name  = env("NEXT_PUBLIC_SITE_NAME", "V-Technologies");
const phone = env("NEXT_PUBLIC_SITE_PHONE", "+91 91791 05875");
const phoneDigits = digitsOnly(env("NEXT_PUBLIC_SITE_PHONE_DIGITS", phone));

export const SITE = {
  name,
  shortName: env("NEXT_PUBLIC_SITE_SHORT_NAME", name.split(/\s+/)[0] || name),
  tagline: env("NEXT_PUBLIC_SITE_TAGLINE", "Repair & Service Experts"),
  owner: env("NEXT_PUBLIC_SITE_OWNER", "Vikram Jain"),
  phone,
  phoneHref: env("NEXT_PUBLIC_SITE_PHONE_HREF", phoneDigits ? `tel:+${phoneDigits}` : "#"),
  whatsapp: env("NEXT_PUBLIC_SITE_WHATSAPP", phoneDigits ? `https://wa.me/${phoneDigits}` : "#"),
  email: env("NEXT_PUBLIC_SITE_EMAIL", "vtech.jbp@gmail.com"),
  address:
    env(
      "NEXT_PUBLIC_SITE_ADDRESS",
      "F4 Hotel Plaza (Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, MP 482002"
    ),
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
const SERVICES_ENV = env(
  "NEXT_PUBLIC_SITE_SERVICES",
  "stage-lighting,industrial,power-supply"
);

export const SERVICES: ServiceDef[] = SERVICES_ENV
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
  .map((s) => KNOWN_SERVICES[s])
  .filter((s): s is ServiceDef => !!s);
