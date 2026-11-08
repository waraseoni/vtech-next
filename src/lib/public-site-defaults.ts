/**
 * Public-site content defaults (pure TS, no server imports).
 *
 * Ye file aaj ki hardcoded/env-based public site copy ko ek typed object me
 * freeze karti hai. DB (`system_info.site_content`) khali, corrupt ya
 * unreachable ho to loader inhi defaults par site render karta hai — current
 * behaviour bilkul same rehta hai.
 *
 * Brand/contact defaults env (`NEXT_PUBLIC_SITE_*`) se aate hain, warna
 * seller ke hardcoded values. `getSiteMode()` `IS_BRANDED` behaviour preserve
 * karta hai: `NEXT_PUBLIC_SITE_NAME` set = minimal (client) site.
 */

import type { ArtKind } from "@/app/(public)/components/equipment-art";

export const SERVICE_IDS = ["stage-lighting", "industrial", "power-supply"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export type SiteMode = "full" | "minimal";

export const PUBLIC_ICONS = [
  "clock",
  "wrench",
  "shield",
  "gauge",
  "handcoins",
  "indianrupee",
  "phone",
  "trophy",
] as const;
export type PublicIcon = (typeof PUBLIC_ICONS)[number];

export type StatItem = { value: number; suffix: string; label: string };
export type FeatureItem = { icon: PublicIcon; title: string; desc: string };
export type Testimonial = { quote: string; name: string; rating?: number };
export type TeamMember = { name: string; role: string; quote: string };
export type FeaturedItem = { art: ArtKind; title: string; desc: string };
export type EquipmentItem = {
  art: ArtKind;
  name: string;
  detail: string;
  badge?: "available" | "coming";
  image?: string;
  turnaround?: string;
  startingPrice?: number;
  warranty?: string;
};
export type StepItem = { title: string; desc: string };
export type LegalLink = { label: string; href: string };
export type FaqItem = { q: string; a: string };

export type BrandContent = {
  name: string;
  shortName: string;
  tagline: string;
  owner: string;
  establishedYear: number | null;
  logoUrl: string;
  coverUrl: string;
};

export type ContactInfoContent = {
  phone: string;
  phoneHref: string;
  whatsapp: string;
  whatsappHref: string;
  email: string;
  address: string;
  businessDays: string;
  openTime: string;
  closeTime: string;
  businessHours: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  facebook: string;
  instagram: string;
  youtube: string;
  announcement: string;
};

export type SeoContent = {
  title: string;
  description: string;
  keywords: string;
};

export type HomeContent = {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  trustChips: string[];
  stats: StatItem[];
  featured: FeaturedItem[];
  why: FeatureItem[];
  testimonials: Testimonial[];
  ctaTitle: string;
  ctaSubtitle: string;
};

export type AboutContent = {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  stats: StatItem[];
  storyHeading: string;
  storyHighlight: string;
  story: string[];
  quote: string;
  badges: string[];
  emergency: { value: string; label: string } | null;
  why: FeatureItem[];
  team: TeamMember[];
  testimonials: Testimonial[];
  visitTitle: string;
};

export type ContactPageContent = {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  serviceOptions: string[];
  formCopy: {
    name: string;
    mobile: string;
    email: string;
    service: string;
    message: string;
    submit: string;
  };
};

export type FaqContent = {
  badge: string;
  title: string;
  subtitle: string;
  items: FaqItem[];
};

export type EvHighlight = {
  enabled: boolean;
  badge: string;
  title: string;
  highlight: string;
  body: string;
  chips: string[];
  images: string[];
};

export type ServicePageContent = {
  enabled: boolean;
  href: string;
  label: string;
  desc: string;
  art: ArtKind;
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  minimalSubtitle: string;
  headings: {
    equipment: string;
    process: string;
    why: string;
    equipmentNote: string;
  };
  equipment: EquipmentItem[];
  steps: StepItem[];
  points: StepItem[];
  evHighlight: EvHighlight | null;
};

export type FooterContent = {
  tagline: string;
  whatsappCta: string;
  copyrightText: string;
  legalLinks: LegalLink[];
};

export type PublicSiteContent = {
  version: 1;
  mode: SiteMode;
  updatedAt: string | null;
  brand: BrandContent;
  contact: ContactInfoContent;
  seo: SeoContent;
  home: HomeContent;
  about: AboutContent;
  contactPage: ContactPageContent;
  faq: FaqContent;
  services: Record<ServiceId, ServicePageContent>;
  footer: FooterContent;
};

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Persisted `system_info.site_content` JSON shape — sab sections optional. */
export type SiteContentJson = {
  version?: number;
  seo?: DeepPartial<SeoContent> | null;
  home?: DeepPartial<HomeContent> | null;
  about?: DeepPartial<AboutContent> | null;
  contactPage?: DeepPartial<ContactPageContent> | null;
  faq?: DeepPartial<FaqContent> | null;
  services?: Partial<Record<ServiceId, DeepPartial<ServicePageContent> | null>> | null;
  footer?: DeepPartial<FooterContent> | null;
};

// ── Env helpers ──────────────────────────────────────────────────────────────
// Direct process.env.NEXT_PUBLIC_* access (Next.js inlining rule); helper ke
// andar static name pass hota hai, dynamic key nahi.
function envText(name: string, fallback: string): string {
  const value = process.env[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function getSiteMode(): SiteMode {
  const explicit = (process.env.NEXT_PUBLIC_SITE_MODE || "").trim().toLowerCase();
  if (explicit === "full" || explicit === "minimal") return explicit;
  return process.env.NEXT_PUBLIC_SITE_NAME ? "minimal" : "full";
}

function fmt12h(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return time;
  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minutes} ${suffix}`;
}

export function formatBusinessHours(days: string, open: string, close: string): string {
  return `${days} · ${fmt12h(open)} – ${fmt12h(close)}`;
}

const SITE_NAME = envText("NEXT_PUBLIC_SITE_NAME", "V-Technologies");
const SITE_PHONE = envText("NEXT_PUBLIC_SITE_PHONE", "+91 91791 05875");
const SITE_PHONE_DIGITS = digitsOnly(SITE_PHONE);

const SITE = {
  name: SITE_NAME,
  shortName: envText("NEXT_PUBLIC_SITE_SHORT_NAME", SITE_NAME.split(/\s+/)[0] || SITE_NAME),
  tagline: envText("NEXT_PUBLIC_SITE_TAGLINE", "Repair & Service Experts"),
  owner: envText("NEXT_PUBLIC_SITE_OWNER", "Vikram Jain"),
  phone: SITE_PHONE,
  phoneHref: envText(
    "NEXT_PUBLIC_SITE_PHONE_HREF",
    SITE_PHONE_DIGITS ? `tel:+${SITE_PHONE_DIGITS}` : ""
  ),
  whatsapp: envText(
    "NEXT_PUBLIC_SITE_WHATSAPP",
    SITE_PHONE_DIGITS ? `https://wa.me/${SITE_PHONE_DIGITS}` : ""
  ),
  email: envText("NEXT_PUBLIC_SITE_EMAIL", "vtech.jbp@gmail.com"),
  address: envText(
    "NEXT_PUBLIC_SITE_ADDRESS",
    "F4 Hotel Plaza (Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, MP 482002"
  ),
};

const SERVICES_ENV = (
  process.env.NEXT_PUBLIC_SITE_SERVICES || "stage-lighting,industrial,power-supply"
)
  .split(",")
  .map((id) => id.trim().toLowerCase())
  .filter(Boolean);

const ENABLED_SERVICES = new Set<ServiceId>(
  SERVICES_ENV.filter((id): id is ServiceId => (SERVICE_IDS as readonly string[]).includes(id))
);

const DEFAULT_DAYS = "Mon-Sat";
const DEFAULT_OPEN = "10:00";
const DEFAULT_CLOSE = "20:00";

// ── Shared copy ──────────────────────────────────────────────────────────────
const SHARED_HOME_CTA = {
  ctaTitle: "Need Urgent Repair?",
  ctaSubtitle: "Call karo ya WhatsApp par photo bhejo — free estimate. Same-day service available.",
};

const SHARED_FOOTER_CTA = "WhatsApp par repair book karein — bhejo, hum check karein";

const FULL_STAGE_EQUIPMENT: EquipmentItem[] = [
  {
    art: "moving-head",
    name: "Sharpy / Moving Head — 16 CH",
    detail: "Beam, color wheel, gobo, motors, power supply — full repair.",
    badge: "available",
  },
  {
    art: "moving-head",
    name: "Sharpy / Moving Head — 20 CH",
    detail: "Advance moving head models — motherboard level fix.",
    badge: "available",
  },
  {
    art: "par",
    name: "Par Light — RGBW",
    detail: "LED driver board, color mixing, power section repair.",
    badge: "available",
  },
  {
    art: "par",
    name: "Par Light — COB",
    detail: "COB LED replacement, driver and thermal fault repair.",
    badge: "available",
  },
  {
    art: "strobe",
    name: "DMX Strobe",
    detail: "Flash tube, trigger board, power supply fix.",
    badge: "available",
  },
  {
    art: "beam-bar",
    name: "MI Bar (Mini Beam)",
    detail: "Small beam bars — motor, board, LED section repair.",
    badge: "available",
  },
  {
    art: "pixel-bar",
    name: "Batton / Pixel Bar",
    detail: "Pixel control board, LED module replacement.",
    badge: "available",
  },
  {
    art: "fog",
    name: "Fog / Smoke Machine",
    detail: "Heating element, pump, thermostat, PCB repair.",
    badge: "available",
  },
  {
    art: "bubble",
    name: "Bubble Machine",
    detail: "Motor, pump and control section repair.",
    badge: "available",
  },
  {
    art: "dmx",
    name: "DMX Controller / Console",
    detail: "DMX 512 output, touch screen, fader and motherboard fix.",
    badge: "available",
  },
  {
    art: "laser",
    name: "Laser Light",
    detail: "Galvo, laser driver and diode replacement.",
    badge: "coming",
  },
  {
    art: "led-wall",
    name: "LED Wall / Video Processor",
    detail: "Module, receiving card, hub and PSU repair.",
    badge: "available",
  },
];

const FULL_INDUSTRIAL_EQUIPMENT: EquipmentItem[] = [
  {
    art: "plc",
    name: "PLC Repair",
    detail: "Programmable logic controllers — power, I/O and processor section fix.",
  },
  {
    art: "hmi",
    name: "HMI / Display Repair",
    detail: "Operator panels, touch displays, keypad and communication boards.",
  },
  {
    art: "panel",
    name: "Control Panel",
    detail: "Panel wiring, contactors, relays, power section troubleshooting.",
  },
  {
    art: "pcb",
    name: "Control Card / PCB",
    detail: "Machine control boards, sensor cards, motor drive PCBs.",
  },
  {
    art: "vfd",
    name: "VFD / Inverter Drive",
    detail: "Variable frequency drives — rectifier, IGBT, control card repair.",
  },
  {
    art: "scada",
    name: "SCADA",
    detail: "Monitoring systems, RTU/module cards and communication repair.",
  },
  {
    art: "servo",
    name: "Servo Drive",
    detail: "Servo amplifiers, encoder and motor section fault repair.",
  },
  {
    art: "power-module",
    name: "Power Module",
    detail: "IGBT modules, rectifier stacks, power supply sections.",
  },
  {
    art: "relay",
    name: "Relay / Timer Boards",
    detail: "Industrial relay logic boards and timer cards.",
  },
  {
    art: "industrial",
    name: "Other Industrial Electronics",
    detail: "Koi bhi machine ki electronic board — bhejo, check karte hain.",
  },
];

const FULL_POWER_EQUIPMENT: EquipmentItem[] = [
  {
    art: "smps",
    name: "SMPS (All Types)",
    detail: "Computer, CCTV, LED, industrial SMPS — component-level repair.",
    badge: "available",
  },
  {
    art: "ev-charger",
    image: "/ev_charger_repair.png",
    name: "EV Charger",
    detail: "2-wheeler EV chargers — 48V / 60V / 72V, PCB-level fix.",
    badge: "available",
  },
  {
    art: "ups",
    name: "UPS / Inverter",
    detail: "Home UPS, online UPS, inverter charging section repair.",
    badge: "available",
  },
  {
    art: "battery-charger",
    name: "Battery Charger",
    detail: "Industrial aur domestic battery chargers — all voltages.",
    badge: "available",
  },
  {
    art: "led-driver",
    name: "LED Driver",
    detail: "LED panel, street light, display driver repair.",
    badge: "available",
  },
  {
    art: "adapter",
    name: "Adapter Repair",
    detail: "Laptop, router, CCTV adapters — replacement kai bar expensive.",
    badge: "available",
  },
];

function serviceDefaults(): Record<ServiceId, ServicePageContent> {
  return {
    "stage-lighting": {
      enabled: ENABLED_SERVICES.has("stage-lighting"),
      href: "/stage-lighting",
      label: "Stage Lighting",
      desc: "Moving Head, Par, DMX, Laser, LED Wall, Fog Machine",
      art: "moving-head",
      badge: "Stage Lighting",
      title: "Stage Lighting",
      highlight: "Repair & Service",
      subtitle:
        "Moving heads, par lights, DMX controllers, lasers, LED walls aur fog machines — sab kuch component-level repair karte hain. DJs aur event companies ke liye fast turnaround.",
      minimalSubtitle:
        "Moving heads, par lights, DMX controllers, lasers, LED walls aur fog machines — component-level repair. DJs aur event companies ke liye fast turnaround.",
      headings: {
        equipment: "Equipment We Repair",
        process: "Repair Process",
        why: "Why DJs Trust Us",
        equipmentNote: "Green = Available Now",
      },
      equipment: FULL_STAGE_EQUIPMENT,
      steps: [
        {
          title: "Bhejo & Diagnose",
          desc: "Equipment shop par lao ya photo bhejo — free diagnosis.",
        },
        {
          title: "Component-Level Repair",
          desc: "Actual faulty part change hota hai, board replace nahi.",
        },
        {
          title: "Load Test & Delivery",
          desc: "Full load test ke baad hi equipment return hota hai.",
        },
      ],
      points: [
        {
          title: "No Board Replacement Bait",
          desc: "Hum component change karte hain — repair zyada economical.",
        },
        {
          title: "Genuine Spare Parts",
          desc: "Original motors, LED chips aur drivers hi lagte hain.",
        },
        {
          title: "Same-Day Service",
          desc: "Event urgent ho to priority express repair bhi hoti hai.",
        },
        {
          title: "Service Warranty",
          desc: "Har repair par written service warranty milti hai.",
        },
      ],
      evHighlight: null,
    },
    industrial: {
      enabled: ENABLED_SERVICES.has("industrial"),
      href: "/industrial",
      label: "Industrial Electronics",
      desc: "PLC, HMI, Control Panel, VFD, SCADA, Servo",
      art: "plc",
      badge: "Industrial Electronics",
      title: "Industrial",
      highlight: "Electronics Repair",
      subtitle:
        "PLC, HMI, control panels, VFD drives, servo, SCADA aur machine PCBs — component-level industrial electronics repair jo aapka production line ka downtime kam kare.",
      minimalSubtitle:
        "PLC, HMI, control panels, VFD drives, servo, SCADA aur machine PCBs — component-level industrial electronics repair jo production line ka downtime kam kare.",
      headings: {
        equipment: "What We Repair",
        process: "How It Works",
        why: "Why Factories Choose Us",
        equipmentNote: "Brand-independent service",
      },
      equipment: FULL_INDUSTRIAL_EQUIPMENT,
      steps: [
        {
          title: "Board Bhejo",
          desc: "Faulty board ya machine bhejo — courier facility available.",
        },
        {
          title: "Diagnosis & Quote",
          desc: "Component-level fault nikal kar pehle rate bataate hain.",
        },
        {
          title: "Repair + Load Test",
          desc: "Approval ke baad repair, phir actual load par test.",
        },
      ],
      points: [
        {
          title: "Component-Level Repair",
          desc: "Board replacement bait nahi — asli faulty IC/component change hota hai.",
        },
        {
          title: "Load Tested",
          desc: "Har repaired drive/module ko load par test karke hi return karte hain.",
        },
        {
          title: "Fast Turnaround",
          desc: "Production line rukna afford nahi hota — priority service available.",
        },
        {
          title: "Free Diagnosis",
          desc: "Diagnosis ka alag se koi charge nahi. Repair confirm hoke hi kaam.",
        },
      ],
      evHighlight: null,
    },
    "power-supply": {
      enabled: ENABLED_SERVICES.has("power-supply"),
      href: "/power-supply",
      label: "Power Supply",
      desc: "SMPS, EV Charger, UPS, Inverter, LED Driver",
      art: "smps",
      badge: "Power Supply",
      title: "Power Supply",
      highlight: "Repair Specialists",
      subtitle:
        "SMPS, EV chargers, UPS, inverters, battery chargers aur LED drivers — power supply repair ka specialist center. Component-level fix jo naya kharidne se kaafi sasta padta hai.",
      minimalSubtitle:
        "SMPS, EV chargers, UPS, inverters, battery chargers aur LED drivers — power supply repair ka specialist center. Component-level fix jo naya kharidne se kaafi sasta padta hai.",
      headings: {
        equipment: "What We Repair",
        process: "Repair Process",
        why: "Why Power Supply Repair Beats Replacement",
        equipmentNote: "Green = Available Now",
      },
      equipment: FULL_POWER_EQUIPMENT,
      steps: [
        { title: "Bhejo / Laao", desc: "Power supply laao ya bhejo — free diagnosis." },
        { title: "Fault Fix", desc: "Faulty component change karke load test karte hain." },
        {
          title: "Warranty ke saath wapas",
          desc: "100% load tested repair, service warranty ke saath.",
        },
      ],
      points: [
        {
          title: "PCB-Level Repair",
          desc: "Poora power supply replace nahi — faulty component change hota hai.",
        },
        {
          title: "100% Load Tested",
          desc: "Har repaired unit full load par test karke hi return.",
        },
        {
          title: "Genuine Components",
          desc: "Original MOSFETs, ICs, capacitors hi use karte hain.",
        },
        {
          title: "Kam Rate, Tez Service",
          desc: "Naya kharidne se kaafi sasta — zyada tar same day.",
        },
      ],
      evHighlight: {
        enabled: true,
        badge: "New Service",
        title: "EV Charger",
        highlight: "Repair & Service",
        body: "Ab hum Electric Vehicle chargers bhi repair karte hain — Komaki, Ola, Hero Electric, Ampere aur doosre brands. 48V, 60V, 72V fast chargers ka PCB-level repair, warranty ke saath.",
        chips: ["PCB-Level Repair", "Load Tested", "Service Warranty", "Fast Turnaround"],
        images: ["/ev_charger_repair.png", "/komaki_ev_charger_1.png", "/komaki_ev_charger_2.png"],
      },
    },
  };
}

function fullHome(): HomeContent {
  return {
    heroBadge: SITE.tagline,
    heroTitle: "Expert Repair for Stage Lighting & Power Supply",
    heroHighlight: "Stage Lighting & Power Supply",
    heroSubtitle:
      "SMPS · Sharpy · Moving Head · Par · DMX · Laser · LED Wall · Fog Machine · PLC · HMI · VFD · EV Charger — component-level repair, genuine parts, same-day service.",
    trustChips: ["17+ Years", "29,000+ Repairs", "5,000+ Clients", "Genuine Parts"],
    stats: [
      { value: 29000, suffix: "+", label: "Repairs Completed" },
      { value: 17, suffix: "+", label: "Years of Trust" },
      { value: 5000, suffix: "+", label: "Happy Clients" },
      { value: 100, suffix: "%", label: "Load Tested Repairs" },
    ],
    featured: [
      {
        art: "moving-head",
        title: "Sharpy / Moving Head",
        desc: "16 / 20 ch · Gobo, motor, color",
      },
      { art: "par", title: "Par & DMX Lights", desc: "RGBW · COB · DMX 512 control" },
      { art: "laser", title: "Laser Lights", desc: "Galvo, driver, diode repair" },
      { art: "led-wall", title: "LED Wall / Processor", desc: "Module, receiving card, PSU" },
      { art: "fog", title: "Fog / Smoke Machine", desc: "Pump, heater, PCB" },
      { art: "smps", title: "SMPS / Power Supply", desc: "All types, component-level" },
      { art: "ev-charger", title: "EV Charger", desc: "2-wheeler charger repair" },
      { art: "pcb", title: "PCB / Control Card", desc: "Industrial electronics repair" },
    ],
    why: [
      {
        icon: "clock",
        title: "Fast Turnaround",
        desc: "90% jobs same day ya 24 ghante mein. Emergency repair bhi karte hain.",
      },
      {
        icon: "wrench",
        title: "Component-Level Fix",
        desc: "Board replace nahi karte — actual faulty component change karte hain.",
      },
      {
        icon: "shield",
        title: "Genuine Parts + Warranty",
        desc: "100% original spares. Har repair par service warranty.",
      },
      {
        icon: "gauge",
        title: "Load Tested",
        desc: "Har repaired item full load par test karke hi return karte hain.",
      },
      {
        icon: "handcoins",
        title: "Fair, Transparent Pricing",
        desc: "Pehle batao, phir repair. Koi hidden charges nahi.",
      },
      {
        icon: "indianrupee",
        title: "Best Rates",
        desc: "17 saal ka experience — quality aur price dono me best.",
      },
    ],
    testimonials: [
      {
        quote:
          "2 AM pe DJ kharab ho gaya tha — Vikram bhai 3 ghante mein fix kar ke de gaye. Life saver!",
        name: "Rohit DJ, Jabalpur",
      },
      {
        quote:
          "LED wall ka processor jal gaya tha — market me 15 din bol rahe the. Yahan 18 ghante mein ho gaya!",
        name: "Shubham Events",
      },
      {
        quote:
          "SMPS 5 alag shop dikha ke laaya. Aakhir me yahi se 1 din mein theek hua. Genuine parts, kam rate.",
        name: "Anil Electricals",
      },
      {
        quote:
          "EV charger ka PCB fix kiya jo kisi ne nahi kiya. Ab 6 mahine se ekdum perfect chal raha hai.",
        name: "Sanjay, Bike Rider",
      },
    ],
    ...SHARED_HOME_CTA,
  };
}

function minimalHome(): HomeContent {
  return {
    heroBadge: SITE.tagline,
    heroTitle: "Welcome to {brand}",
    heroHighlight: "{brand}",
    heroSubtitle: "{tagline}. Component-level repair, genuine parts, fast service.",
    trustChips: [],
    stats: [],
    featured: [],
    why: [],
    testimonials: [],
    ctaTitle: "Need Urgent Repair?",
    ctaSubtitle: "Call karo ya WhatsApp par photo bhejo — free estimate.",
  };
}

function fullAbout(): AboutContent {
  return {
    badge: "Since {since}",
    title: "{brand} — {tagline}",
    highlight: "{brand}",
    subtitle:
      "DJ systems, moving heads, laser lights, LED walls, processors aur SMPS — Central India ka sabse bada aur bharosemand repair center.",
    stats: [
      { value: 17, suffix: "+", label: "Years" },
      { value: 29000, suffix: "+", label: "Repairs" },
      { value: 5000, suffix: "+", label: "Clients" },
    ],
    storyHeading: "From One Table to the",
    storyHighlight: "Biggest Repair Hub",
    story: [
      "Hi, I'm {owner}. In {since}, maine yeh journey shuru ki — bas ek chhoti si table, kuch tools, aur cheezein theek karne ka junoon.",
      "Aaj hum proudly hain — Central India ka largest aur most trusted repair center for DJ systems, moving heads, laser lights, LED walls, processors aur SMPS.",
      'Shaadi ki emergency 2 AM par ho ya kal ka bada event — hum kabhi "na" nahi bolte.',
    ],
    quote:
      "Aapka bharosa hi hamari sabse badi kamai hai. Jab aapka equipment perfect chalta hai aur aap smile karte ho — wahi hamara reward hai.",
    badges: ["17+ Years", "5,000+ Clients", "100% Tested"],
    emergency: { value: "24×7", label: "Emergency Repair Service" },
    why: [
      {
        icon: "phone",
        title: "Lightning Fast",
        desc: "90% jobs 24 ghante mein. Emergency? 2–6 ghante mein fix!",
      },
      {
        icon: "trophy",
        title: "17 Years of Mastery",
        desc: "Basic SMPS se lekar high-end LED wall processor tak — sab dekha hai.",
      },
      {
        icon: "shield",
        title: "100% Transparent",
        desc: "Original parts. Koi hidden charges nahi. Sab kuch dikhta hai.",
      },
    ],
    team: [
      {
        name: "Vikram Jain",
        role: "Founder & Master Technician",
        quote:
          "Har kharab equipment ki ek kahani hoti hai. Main bas use dobara chalana seekhata hoon.",
      },
      {
        name: "Preeti Jain",
        role: "Customer Happiness Manager",
        quote: "Repair item uthate waqt aapki smile — wahi mera sabse bada reward hai.",
      },
      {
        name: "Hemant Mehra",
        role: "Head Technician",
        quote: "Dead circuit se perfect beats tak — main machines ko wapas zinda karta hoon.",
      },
    ],
    testimonials: [
      {
        quote:
          "2 AM pe DJ kharab ho gaya tha — Vikram bhai 3 ghante mein fix kar ke de gaye. Life saver!",
        name: "Rohit DJ, Jabalpur",
      },
      {
        quote:
          "LED wall ka processor jal gaya tha — market mein 15 din bol rahe the. Yahan 18 ghante mein ho gaya!",
        name: "Shubham Events",
      },
    ],
    visitTitle: "Visit Our Workshop",
  };
}

function minimalAbout(): AboutContent {
  return {
    badge: "About Us",
    title: "{brand} — {tagline}",
    highlight: "{brand}",
    subtitle:
      "Hamare yahan {owner} ki leadership mein equipment repair aur maintenance ke liye bharosemand service milti hai — genuine parts aur fair pricing ke saath.",
    stats: [],
    storyHeading: "",
    storyHighlight: "",
    story: [],
    quote: "",
    badges: [],
    emergency: null,
    why: [],
    team: [],
    testimonials: [],
    visitTitle: "Contact Information",
  };
}

function sharedContactPage(): ContactPageContent {
  return {
    badge: "Contact & Inquiry",
    title: "Apna message bhejo — hum jaldi reply karenge",
    highlight: "hum jaldi reply karenge",
    subtitle:
      "Repair inquiry, estimate, ya koi bhi sawaal — form bharo ya seedha call/WhatsApp karo.",
    serviceOptions: [
      "Stage Lighting",
      "Industrial Electronics",
      "Power Supply",
      "EV Charger",
      "Other",
    ],
    formCopy: {
      name: "Aapka Naam",
      mobile: "Mobile Number",
      email: "Email (optional)",
      service: "Service",
      message: "Message",
      submit: "Inquiry Bhejo",
    },
  };
}

function sharedFaq(): FaqContent {
  return {
    badge: "FAQ",
    title: "Aksar puche jaane wale sawaal",
    subtitle:
      "Repair, warranty aur tracking ke seedhe jawab. Aur kuchh poochna ho to call ya WhatsApp karein.",
    items: [
      {
        q: "Repair ka charge kitna hota hai?",
        a: "Diagnosis free hai. Fault milne ke baad parts aur kaam ka final rate pehle bataya jata hai — aapki approval ke baad hi repair shuru hoti hai.",
      },
      {
        q: "Repair me kitna time lagta hai?",
        a: "Fault aur part availability par depend karta hai. Diagnosis ke saath estimate aur time bataya jata hai; urgent case me pehle phone/WhatsApp par confirm kar lein.",
      },
      {
        q: "Warranty milti hai?",
        a: "Haan — har repair par written service warranty milti hai. Period bill par likha hota hai aur sirf repaired fault/workmanship cover karta hai.",
      },
      {
        q: "Workshop kahan hai aur kab khula rehta hai?",
        a: "Workshop {address} par hai. Aane se pehle call kar lein taaki technician available mile. Timings aur map footer me bhi diye hain.",
      },
      {
        q: "Job ka status kaise check karein?",
        a: "Job ID ya Repair Code ke saath Track Repair page par status dekhein — login ki zaroorat nahi. Job ID aapke bill par bhi hota hai.",
      },
      {
        q: "Mera contact form data safe hai?",
        a: "Naam, mobile aur message sirf aapki inquiry ka jawab dene ke liye use hote hain — third party ko nahi bechte. Details Privacy section me hain.",
      },
    ],
  };
}

/** Current public-site behaviour, typed. DB empty → exactly this renders. */
export function getDefaultSiteContent(mode: SiteMode = getSiteMode()): PublicSiteContent {
  const isMinimal = mode === "minimal";
  const whatsappNumber = digitsOnly(SITE.whatsapp) || digitsOnly(SITE.phone);

  return {
    version: 1,
    mode,
    updatedAt: null,
    brand: {
      name: SITE.name,
      shortName: SITE.shortName,
      tagline: SITE.tagline,
      owner: SITE.owner,
      establishedYear: 2007,
      logoUrl: "",
      coverUrl: "",
    },
    contact: {
      phone: SITE.phone,
      phoneHref: SITE.phoneHref,
      whatsapp: whatsappNumber,
      whatsappHref: whatsappNumber ? `https://wa.me/${whatsappNumber}` : "",
      email: SITE.email,
      address: SITE.address,
      businessDays: DEFAULT_DAYS,
      openTime: DEFAULT_OPEN,
      closeTime: DEFAULT_CLOSE,
      businessHours: formatBusinessHours(DEFAULT_DAYS, DEFAULT_OPEN, DEFAULT_CLOSE),
      mapUrl: "",
      latitude: null,
      longitude: null,
      facebook: "",
      instagram: "",
      youtube: "",
      announcement: "",
    },
    seo: {
      title: `${SITE.name} — ${SITE.tagline}`,
      description:
        "Stage lighting, industrial electronics aur power supply repair — component-level fix, genuine parts aur same-day service.",
      keywords:
        "stage lighting repair, moving head repair, SMPS repair, EV charger repair, industrial electronics repair, Jabalpur",
    },
    home: isMinimal ? minimalHome() : fullHome(),
    about: isMinimal ? minimalAbout() : fullAbout(),
    contactPage: sharedContactPage(),
    faq: sharedFaq(),
    services: serviceDefaults(),
    footer: {
      tagline:
        "{tagline} — Trusted repair center since {since}. Fast repairs, genuine parts, fair rates.",
      whatsappCta: SHARED_FOOTER_CTA,
      copyrightText: "© {year} {brand}",
      legalLinks: [
        { label: "Privacy", href: "/policies#privacy" },
        { label: "Terms", href: "/policies#terms" },
        { label: "Warranty", href: "/policies#warranty" },
      ],
    },
  };
}

/**
 * `{brand}`, `{shortName}`, `{tagline}`, `{owner}`, `{year}` (current year),
 * `{since}` (established year), `{phone}`, `{email}`, `{address}`, `{hours}`.
 */
export function applySiteTokens(text: string, content: PublicSiteContent): string {
  const tokens: Record<string, string> = {
    brand: content.brand.name,
    shortName: content.brand.shortName,
    tagline: content.brand.tagline,
    owner: content.brand.owner,
    year: String(new Date().getFullYear()),
    since: String(content.brand.establishedYear ?? new Date().getFullYear()),
    phone: content.contact.phone,
    email: content.contact.email,
    address: content.contact.address,
    hours: content.contact.businessHours,
  };
  return text.replace(
    /\{(brand|shortName|tagline|owner|year|since|phone|email|address|hours)\}/g,
    (_, key: string) => tokens[key] ?? ""
  );
}

export function buildWhatsAppLink(content: PublicSiteContent, text = ""): string {
  const number = digitsOnly(content.contact.whatsapp) || digitsOnly(content.contact.phone);
  const base = number ? `https://wa.me/${number}` : content.contact.whatsappHref;
  if (!base) return "";
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function getServiceList(content: PublicSiteContent): ServicePageContent[] {
  return SERVICE_IDS.map((id) => content.services[id]).filter((service) => service.enabled);
}

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

/** "Mon-Sat", "Mon, Tue, Fri", "Daily" → day indexes; unknown → null. */
export function parseBusinessDays(value: string): Set<number> | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/(daily|every\s*day|all\s*days|mon\s*-\s*sun)/.test(text)) {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  const days = new Set<number>();
  for (const chunk of text.split(/[,/]/)) {
    const part = chunk.trim();
    if (!part) continue;
    const range = /^([a-z]+)\s*-\s*([a-z]+)$/.exec(part);
    if (range) {
      const start = DAY_INDEX[range[1]];
      const end = DAY_INDEX[range[2]];
      if (start === undefined || end === undefined) return null;
      for (let day = start; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === end) break;
      }
      continue;
    }
    const single = DAY_INDEX[part];
    if (single === undefined) return null;
    days.add(single);
  }
  return days.size ? days : null;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export type BusinessOpenState = { known: boolean; open: boolean; label: string };

/** Live open/closed state in the visitor's local time. */
export function getBusinessOpenState(
  content: PublicSiteContent,
  now: Date = new Date()
): BusinessOpenState {
  const days = parseBusinessDays(content.contact.businessDays);
  const open = timeToMinutes(content.contact.openTime);
  const close = timeToMinutes(content.contact.closeTime);
  if (!days || open === null || close === null) {
    return { known: false, open: false, label: "" };
  }
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const openNow =
    close > open
      ? days.has(day) && minute >= open && minute < close
      : (days.has(day) && minute >= open) || (days.has((day + 6) % 7) && minute < close);
  return { known: true, open: openNow, label: openNow ? "Open now" : "Closed now" };
}

/** City label derived from the configured address (e.g. "Jabalpur"). */
export function getCityLabel(address: string): string {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i].replace(/\s+\d{6}$/, "").trim();
    if (candidate && !/^\d+$/.test(candidate)) return candidate;
  }
  return "";
}

/** "23.167934, 79.935528" — empty jab office GPS configured na ho. */
export function formatCoordinates(content: PublicSiteContent): string {
  const { latitude, longitude } = content.contact;
  return latitude !== null && longitude !== null ? `${latitude}, ${longitude}` : "";
}

/**
 * Google Maps link priority: admin `map_url` → office GPS (geofence) → address
 * search. Live data me geofence coords hi hon to exact pin milta hai.
 */
export function buildMapLink(content: PublicSiteContent): string {
  const configured = content.contact.mapUrl.trim();
  if (configured) return configured;
  const coordinates = formatCoordinates(content);
  if (coordinates) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`;
  }
  const address = content.contact.address.trim();
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Turn-by-turn directions link — GPS destination, warna address, warna map_url. */
export function buildDirectionsLink(content: PublicSiteContent): string {
  const destination = formatCoordinates(content) || content.contact.address.trim();
  if (!destination) return content.contact.mapUrl.trim();
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Address + GPS + map/directions + phone — WhatsApp/copy ke liye plain text. */
export function buildLocationShareText(content: PublicSiteContent): string {
  const { brand, contact } = content;
  const lines = [brand.name];
  if (contact.address.trim()) lines.push(contact.address.trim());
  const coordinates = formatCoordinates(content);
  if (coordinates) lines.push(`GPS: ${coordinates}`);
  const map = buildMapLink(content);
  if (map) lines.push(`Map: ${map}`);
  const directions = buildDirectionsLink(content);
  if (directions && directions !== map) lines.push(`Directions: ${directions}`);
  if (contact.phone.trim()) lines.push(`Phone: ${contact.phone.trim()}`);
  return lines.join("\n");
}

/**
 * Recipient number normalize: 10-digit local → +91, leading 0 → +91, else
 * digits as-is. Empty/invalid → "".
 */
export function normalizeWhatsAppRecipient(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

/** Kisi bhi text ko diye gaye (ya chooser) WhatsApp number par bhejne ka link. */
export function buildWhatsAppShareLink(text: string, recipient = ""): string {
  const encoded = encodeURIComponent(text);
  const number = normalizeWhatsAppRecipient(recipient);
  return number ? `https://wa.me/${number}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

/**
 * Location text kisi aur ko WhatsApp par bhejne ka link. `recipient` khali ho to
 * WhatsApp apna contact chooser dikhata hai.
 */
export function buildLocationWhatsAppLink(content: PublicSiteContent, recipient = ""): string {
  return buildWhatsAppShareLink(buildLocationShareText(content), recipient);
}
