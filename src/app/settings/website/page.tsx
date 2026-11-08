"use client";

// ─── Public website content editor (admin/developer) ────────────────────────
// DB-backed content: `system_info.site_content` (+ existing firm keys). Editor
// effective content dikhata hai aur save par sirf changed fields bhejta hai;
// server changed section ko existing DB override par deep-merge karta hai.
// Save route admin-only + optimistic concurrency (409 par reload).
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, Loader2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { supabase, getCachedUser } from "@/lib/supabase";
import { toast } from "@/lib/toast";
import {
  PUBLIC_ICONS,
  SERVICE_IDS,
  type EquipmentItem,
  type FaqItem,
  type FeaturedItem,
  type FeatureItem,
  type FooterContent,
  type PublicSiteContent,
  type SeoContent,
  type ServiceId,
  type ServicePageContent,
  type StatItem,
  type StepItem,
  type TeamMember,
  type Testimonial,
} from "@/lib/public-site-defaults";
import { ART_KINDS } from "@/lib/public-site-schema";
import type { ArtKind } from "@/app/(public)/components/equipment-art";
import {
  AddButton,
  Field,
  ListCard,
  SectionCard,
  Select,
  TextArea,
  Toggle,
  labelCls,
  moveItem,
  inputCls,
} from "./fields";

type TabId = "branding" | "contact" | "home" | "faq" | "about" | "services" | "seo";

const TABS: { id: TabId; label: string }[] = [
  { id: "branding", label: "Branding" },
  { id: "contact", label: "Contact" },
  { id: "home", label: "Home Page" },
  { id: "faq", label: "FAQ" },
  { id: "about", label: "About Page" },
  { id: "services", label: "Services" },
  { id: "seo", label: "Footer & SEO" },
];

const FIRM_KEYS = [
  "name",
  "short_name",
  "tagline",
  "owner",
  "contact",
  "whatsapp",
  "email",
  "address",
  "biz_days",
  "biz_open",
  "biz_close",
  "map_url",
  "facebook",
  "instagram",
  "youtube",
  "announcement",
  "footer_text",
] as const;
type FirmKey = (typeof FIRM_KEYS)[number];
type FirmForm = Record<FirmKey, string>;

const BRANDING_KEYS: FirmKey[] = ["name", "short_name", "tagline", "owner"];
const CONTACT_KEYS: FirmKey[] = [
  "contact",
  "whatsapp",
  "email",
  "address",
  "biz_days",
  "biz_open",
  "biz_close",
  "map_url",
  "facebook",
  "instagram",
  "youtube",
  "announcement",
];

const CAPS = {
  stats: 8,
  featured: 24,
  why: 12,
  testimonials: 12,
  team: 12,
  story: 12,
  badges: 8,
  equipment: 40,
  steps: 10,
  points: 20,
  evChips: 8,
  evImages: 6,
  faq: 10,
} as const;

const splitList = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const splitLines = (value: string): string[] =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
const splitStory = (value: string): string[] =>
  value
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

type HomeForm = {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  trustChips: string;
  stats: StatItem[];
  featured: FeaturedItem[];
  why: FeatureItem[];
  testimonials: Testimonial[];
  ctaTitle: string;
  ctaSubtitle: string;
};

type FaqForm = {
  badge: string;
  title: string;
  subtitle: string;
  items: FaqItem[];
};

type AboutForm = {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  stats: StatItem[];
  storyHeading: string;
  storyHighlight: string;
  story: string;
  quote: string;
  badges: string;
  emergencyEnabled: boolean;
  emergencyValue: string;
  emergencyLabel: string;
  why: FeatureItem[];
  team: TeamMember[];
  testimonials: Testimonial[];
  visitTitle: string;
};

type ContactPageForm = {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  serviceOptions: string;
  formCopy: {
    name: string;
    mobile: string;
    email: string;
    service: string;
    message: string;
    submit: string;
  };
};

type ServiceForm = {
  enabled: boolean;
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
  evPresent: boolean;
  evEnabled: boolean;
  evBadge: string;
  evTitle: string;
  evHighlightText: string;
  evBody: string;
  evChips: string;
  evImages: string;
};

type SeoForm = SeoContent;
type FooterForm = Pick<FooterContent, "tagline" | "whatsappCta" | "copyrightText">;

type SiteContentResponse = {
  ok: boolean;
  updatedAt: string | null;
  content: PublicSiteContent;
  firm: Record<string, string>;
  error?: string;
};

const emptyFirm = (): FirmForm => Object.fromEntries(FIRM_KEYS.map((key) => [key, ""])) as FirmForm;

const pickFirm = (source: Record<string, string> | undefined): FirmForm => {
  const out = emptyFirm();
  if (!source) return out;
  for (const key of FIRM_KEYS) out[key] = (source[key] ?? "").trim();
  return out;
};

const cloneStats = (items: StatItem[]): StatItem[] => items.map((item) => ({ ...item }));
const cloneFeatured = (items: FeaturedItem[]): FeaturedItem[] => items.map((item) => ({ ...item }));
const cloneFeatures = (items: FeatureItem[]): FeatureItem[] => items.map((item) => ({ ...item }));
const cloneTestimonials = (items: Testimonial[]): Testimonial[] =>
  items.map((item) => ({ ...item }));
const cloneTeam = (items: TeamMember[]): TeamMember[] => items.map((item) => ({ ...item }));
const cloneEquipment = (items: EquipmentItem[]): EquipmentItem[] =>
  items.map((item) => ({ ...item }));
const cloneSteps = (items: StepItem[]): StepItem[] => items.map((item) => ({ ...item }));

function toHomeForm(home: PublicSiteContent["home"]): HomeForm {
  return {
    heroBadge: home.heroBadge,
    heroTitle: home.heroTitle,
    heroHighlight: home.heroHighlight,
    heroSubtitle: home.heroSubtitle,
    trustChips: home.trustChips.join(", "),
    stats: cloneStats(home.stats),
    featured: cloneFeatured(home.featured),
    why: cloneFeatures(home.why),
    testimonials: cloneTestimonials(home.testimonials),
    ctaTitle: home.ctaTitle,
    ctaSubtitle: home.ctaSubtitle,
  };
}

function toFaqForm(faq: PublicSiteContent["faq"]): FaqForm {
  return {
    badge: faq.badge,
    title: faq.title,
    subtitle: faq.subtitle,
    items: faq.items.map((item) => ({ ...item })),
  };
}

function toAboutForm(about: PublicSiteContent["about"]): AboutForm {
  return {
    badge: about.badge,
    title: about.title,
    highlight: about.highlight,
    subtitle: about.subtitle,
    stats: cloneStats(about.stats),
    storyHeading: about.storyHeading,
    storyHighlight: about.storyHighlight,
    story: about.story.join("\n\n"),
    quote: about.quote,
    badges: about.badges.join(", "),
    emergencyEnabled: !!about.emergency,
    emergencyValue: about.emergency?.value ?? "24×7",
    emergencyLabel: about.emergency?.label ?? "Emergency Repair Service",
    why: cloneFeatures(about.why),
    team: cloneTeam(about.team),
    testimonials: cloneTestimonials(about.testimonials),
    visitTitle: about.visitTitle,
  };
}

function toContactPageForm(page: PublicSiteContent["contactPage"]): ContactPageForm {
  return {
    badge: page.badge,
    title: page.title,
    highlight: page.highlight,
    subtitle: page.subtitle,
    serviceOptions: page.serviceOptions.join(", "),
    formCopy: { ...page.formCopy },
  };
}

function toServiceForm(service: ServicePageContent): ServiceForm {
  const ev = service.evHighlight;
  return {
    enabled: service.enabled,
    label: service.label,
    desc: service.desc,
    art: service.art,
    badge: service.badge,
    title: service.title,
    highlight: service.highlight,
    subtitle: service.subtitle,
    minimalSubtitle: service.minimalSubtitle,
    headings: { ...service.headings },
    equipment: cloneEquipment(service.equipment),
    steps: cloneSteps(service.steps),
    points: cloneSteps(service.points),
    evPresent: !!ev,
    evEnabled: ev?.enabled ?? true,
    evBadge: ev?.badge ?? "New Service",
    evTitle: ev?.title ?? "EV Charger",
    evHighlightText: ev?.highlight ?? "Repair & Service",
    evBody: ev?.body ?? "",
    evChips: (ev?.chips ?? []).join(", "),
    evImages: (ev?.images ?? []).join("\n"),
  };
}

function toServicesForm(services: PublicSiteContent["services"]): Record<ServiceId, ServiceForm> {
  return {
    "stage-lighting": toServiceForm(services["stage-lighting"]),
    industrial: toServiceForm(services.industrial),
    "power-supply": toServiceForm(services["power-supply"]),
  };
}

function fullEvHighlight(form: ServiceForm) {
  return {
    enabled: form.evEnabled,
    badge: form.evBadge,
    title: form.evTitle,
    highlight: form.evHighlightText,
    body: form.evBody,
    chips: splitList(form.evChips),
    images: splitLines(form.evImages),
  };
}

/** Sirf changed service fields ka patch; kuch nahi badla to `null`. */
function diffService(current: ServiceForm, base: ServiceForm): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (current.enabled !== base.enabled) patch.enabled = current.enabled;

  const textKeys = [
    "label",
    "desc",
    "title",
    "highlight",
    "subtitle",
    "minimalSubtitle",
    "badge",
  ] as const;
  for (const key of textKeys) {
    if (current[key] !== base[key]) patch[key] = current[key];
  }
  if (current.art !== base.art) patch.art = current.art;

  const headings: Record<string, string> = {};
  for (const key of ["equipment", "process", "why", "equipmentNote"] as const) {
    if (current.headings[key] !== base.headings[key]) headings[key] = current.headings[key];
  }
  if (Object.keys(headings).length > 0) patch.headings = headings;

  for (const key of ["equipment", "steps", "points"] as const) {
    if (JSON.stringify(current[key]) !== JSON.stringify(base[key])) patch[key] = current[key];
  }

  if (current.evPresent !== base.evPresent) {
    patch.evHighlight = current.evPresent ? fullEvHighlight(current) : null;
  } else if (current.evPresent) {
    const ev: Record<string, unknown> = {};
    if (current.evEnabled !== base.evEnabled) ev.enabled = current.evEnabled;
    if (current.evBadge !== base.evBadge) ev.badge = current.evBadge;
    if (current.evTitle !== base.evTitle) ev.title = current.evTitle;
    if (current.evHighlightText !== base.evHighlightText) ev.highlight = current.evHighlightText;
    if (current.evBody !== base.evBody) ev.body = current.evBody;
    if (current.evChips !== base.evChips) ev.chips = splitList(current.evChips);
    if (current.evImages !== base.evImages) ev.images = splitLines(current.evImages);
    if (Object.keys(ev).length > 0) patch.evHighlight = ev;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

// ─── Reusable list editors ──────────────────────────────────────────────────

function StatsEditor({
  items,
  onChange,
}: {
  items: StatItem[];
  onChange: (items: StatItem[]) => void;
}) {
  const update = (index: number, patch: Partial<StatItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.stats} stats
        </span>
        <AddButton
          label="Add stat"
          disabled={items.length >= CAPS.stats}
          onClick={() => onChange([...items, { value: 0, suffix: "+", label: "New stat" }])}
        />
      </div>
      {items.map((stat, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="stat"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_80px_1fr]">
            <div>
              <label className={labelCls}>Value</label>
              <input
                type="number"
                value={stat.value}
                onChange={(e) => update(index, { value: Number(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Suffix</label>
              <input
                value={stat.suffix}
                onChange={(e) => update(index, { suffix: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Label</label>
              <input
                value={stat.label}
                onChange={(e) => update(index, { label: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </ListCard>
      ))}
      {items.length === 0 && (
        <p className="text-[11px] text-muted-2">Koi stat nahi — section hide rahega.</p>
      )}
    </div>
  );
}

function FeaturesEditor({
  items,
  onChange,
  cap = CAPS.why,
  label = "feature",
}: {
  items: FeatureItem[];
  onChange: (items: FeatureItem[]) => void;
  cap?: number;
  label?: string;
}) {
  const update = (index: number, patch: Partial<FeatureItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{cap} {label}s
        </span>
        <AddButton
          label={`Add ${label}`}
          disabled={items.length >= cap}
          onClick={() =>
            onChange([...items, { icon: "shield", title: "New feature", desc: "Description" }])
          }
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel={label}
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr]">
            <Select
              label="Icon"
              value={item.icon}
              options={PUBLIC_ICONS}
              onChange={(value) => update(index, { icon: value as FeatureItem["icon"] })}
            />
            <Field
              label="Title"
              value={item.title}
              onChange={(value) => update(index, { title: value })}
            />
          </div>
          <div className="mt-2">
            <TextArea
              label="Description"
              rows={2}
              value={item.desc}
              onChange={(value) => update(index, { desc: value })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi item nahi.</p>}
    </div>
  );
}

function TestimonialsEditor({
  items,
  onChange,
}: {
  items: Testimonial[];
  onChange: (items: Testimonial[]) => void;
}) {
  const update = (index: number, patch: Partial<Testimonial>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.testimonials} testimonials
        </span>
        <AddButton
          label="Add testimonial"
          disabled={items.length >= CAPS.testimonials}
          onClick={() => onChange([...items, { quote: "Quote", name: "Client name", rating: 5 }])}
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="testimonial"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <TextArea
            label="Quote"
            rows={2}
            value={item.quote}
            onChange={(value) => update(index, { quote: value })}
          />
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px]">
            <Field
              label="Name"
              value={item.name}
              onChange={(value) => update(index, { name: value })}
            />
            <Select
              label="Rating"
              value={String(item.rating ?? 5)}
              options={["1", "2", "3", "4", "5"]}
              onChange={(value) => update(index, { rating: Number(value) })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi testimonial nahi.</p>}
    </div>
  );
}

function TeamEditor({
  items,
  onChange,
}: {
  items: TeamMember[];
  onChange: (items: TeamMember[]) => void;
}) {
  const update = (index: number, patch: Partial<TeamMember>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.team} members
        </span>
        <AddButton
          label="Add member"
          disabled={items.length >= CAPS.team}
          onClick={() => onChange([...items, { name: "Name", role: "Role", quote: "Short quote" }])}
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="member"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field
              label="Name"
              value={item.name}
              onChange={(value) => update(index, { name: value })}
            />
            <Field
              label="Role"
              value={item.role}
              onChange={(value) => update(index, { role: value })}
            />
          </div>
          <div className="mt-2">
            <TextArea
              label="Quote"
              rows={2}
              value={item.quote}
              onChange={(value) => update(index, { quote: value })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi member nahi.</p>}
    </div>
  );
}

function StepsEditor({
  items,
  onChange,
  cap,
  label,
}: {
  items: StepItem[];
  onChange: (items: StepItem[]) => void;
  cap: number;
  label: string;
}) {
  const update = (index: number, patch: Partial<StepItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{cap} {label}s
        </span>
        <AddButton
          label={`Add ${label}`}
          disabled={items.length >= cap}
          onClick={() => onChange([...items, { title: "Title", desc: "Description" }])}
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel={label}
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <Field
            label="Title"
            value={item.title}
            onChange={(value) => update(index, { title: value })}
          />
          <div className="mt-2">
            <TextArea
              label="Description"
              rows={2}
              value={item.desc}
              onChange={(value) => update(index, { desc: value })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi {label} nahi.</p>}
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: FaqItem[];
  onChange: (items: FaqItem[]) => void;
}) {
  const update = (index: number, patch: Partial<FaqItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.faq} questions
        </span>
        <AddButton
          label="Add question"
          disabled={items.length >= CAPS.faq}
          onClick={() => onChange([...items, { q: "Naya sawaal?", a: "Jawab yahan likhein." }])}
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="question"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <Field
            label="Question"
            value={item.q}
            onChange={(value) => update(index, { q: value })}
          />
          <div className="mt-2">
            <TextArea
              label="Answer"
              rows={3}
              value={item.a}
              onChange={(value) => update(index, { a: value })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi question nahi.</p>}
    </div>
  );
}

function FeaturedEditor({
  items,
  onChange,
}: {
  items: FeaturedItem[];
  onChange: (items: FeaturedItem[]) => void;
}) {
  const update = (index: number, patch: Partial<FeaturedItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.featured} cards
        </span>
        <AddButton
          label="Add card"
          disabled={items.length >= CAPS.featured}
          onClick={() => onChange([...items, { art: "pcb", title: "Title", desc: "Description" }])}
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="card"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
            <Select
              label="Art"
              value={item.art}
              options={ART_KINDS}
              onChange={(value) => update(index, { art: value as ArtKind })}
            />
            <Field
              label="Title"
              value={item.title}
              onChange={(value) => update(index, { title: value })}
            />
          </div>
          <div className="mt-2">
            <Field
              label="Description"
              value={item.desc}
              onChange={(value) => update(index, { desc: value })}
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi card nahi.</p>}
    </div>
  );
}

function EquipmentEditor({
  items,
  onChange,
}: {
  items: EquipmentItem[];
  onChange: (items: EquipmentItem[]) => void;
}) {
  const update = (index: number, patch: Partial<EquipmentItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-2">
          {items.length}/{CAPS.equipment} items
        </span>
        <AddButton
          label="Add equipment"
          disabled={items.length >= CAPS.equipment}
          onClick={() =>
            onChange([...items, { art: "pcb", name: "Name", detail: "Detail", badge: "available" }])
          }
        />
      </div>
      {items.map((item, index) => (
        <ListCard
          key={index}
          index={index}
          count={items.length}
          removeLabel="equipment"
          onMoveUp={() => onChange(moveItem(items, index, index - 1))}
          onMoveDown={() => onChange(moveItem(items, index, index + 1))}
          onRemove={() => onChange(items.filter((_, i) => i !== index))}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr_120px]">
            <Select
              label="Art"
              value={item.art}
              options={ART_KINDS}
              onChange={(value) => update(index, { art: value as ArtKind })}
            />
            <Field
              label="Name"
              value={item.name}
              onChange={(value) => update(index, { name: value })}
            />
            <Select
              label="Badge"
              value={item.badge ?? "none"}
              options={["none", "available", "coming"]}
              onChange={(value) =>
                update(index, {
                  badge: value === "none" ? undefined : (value as "available" | "coming"),
                })
              }
            />
          </div>
          <div className="mt-2">
            <Field
              label="Detail"
              value={item.detail}
              onChange={(value) => update(index, { detail: value })}
            />
          </div>
          <div className="mt-2">
            <Field
              label="Image URL (optional)"
              value={item.image ?? ""}
              onChange={(value) => update(index, { image: value })}
              placeholder="/ev_charger_repair.png"
            />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field
              label="Turnaround (optional)"
              value={item.turnaround ?? ""}
              onChange={(value) => update(index, { turnaround: value || undefined })}
              placeholder="Same day"
            />
            <Field
              label="Starting price ₹ (optional)"
              value={item.startingPrice ? String(item.startingPrice) : ""}
              onChange={(value) => {
                const amount = Number(value.replace(/[^\d.]/g, ""));
                update(index, {
                  startingPrice:
                    value.trim() && Number.isFinite(amount) && amount > 0
                      ? Math.round(amount)
                      : undefined,
                });
              }}
              placeholder="500"
            />
            <Field
              label="Warranty (optional)"
              value={item.warranty ?? ""}
              onChange={(value) => update(index, { warranty: value || undefined })}
              placeholder="3 months"
            />
          </div>
        </ListCard>
      ))}
      {items.length === 0 && <p className="text-[11px] text-muted-2">Koi equipment nahi.</p>}
    </div>
  );
}

function SaveRow({
  label,
  hint,
  disabled,
  saving,
  onSave,
  onReset,
  resetConfirm,
}: {
  label: string;
  hint?: string;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  resetConfirm?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[10px] text-muted-2">{hint}</p>
      <div className="flex items-center gap-2">
        {onReset && (
          <button
            onClick={() => {
              if (!resetConfirm || window.confirm(resetConfirm)) onReset();
            }}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[12px] font-bold disabled:opacity-60"
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
        <button
          onClick={onSave}
          disabled={saving || disabled}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-[12px] font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {label}
        </button>
      </div>
    </div>
  );
}

export default function WebsiteSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("branding");
  const [activeService, setActiveService] = useState<ServiceId>("stage-lighting");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [content, setContent] = useState<PublicSiteContent | null>(null);

  const [firm, setFirm] = useState<FirmForm>(emptyFirm);
  const [firmBase, setFirmBase] = useState<FirmForm>(emptyFirm);
  const [home, setHome] = useState<HomeForm | null>(null);
  const [homeBase, setHomeBase] = useState<HomeForm | null>(null);
  const [faq, setFaq] = useState<FaqForm | null>(null);
  const [faqBase, setFaqBase] = useState<FaqForm | null>(null);
  const [about, setAbout] = useState<AboutForm | null>(null);
  const [aboutBase, setAboutBase] = useState<AboutForm | null>(null);
  const [contactPage, setContactPage] = useState<ContactPageForm | null>(null);
  const [contactPageBase, setContactPageBase] = useState<ContactPageForm | null>(null);
  const [services, setServices] = useState<Record<ServiceId, ServiceForm> | null>(null);
  const [servicesBase, setServicesBase] = useState<Record<ServiceId, ServiceForm> | null>(null);
  const [seo, setSeo] = useState<SeoForm | null>(null);
  const [seoBase, setSeoBase] = useState<SeoForm | null>(null);
  const [footer, setFooter] = useState<FooterForm | null>(null);
  const [footerBase, setFooterBase] = useState<FooterForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/settings/site-content", { cache: "no-store" });
      const data = (await res.json()) as SiteContentResponse;
      if (!res.ok || !data.content) throw new Error(data.error || "Content load fail");

      const nextFirm = pickFirm(data.firm);
      setFirm(nextFirm);
      setFirmBase(nextFirm);

      const nextHome = toHomeForm(data.content.home);
      setHome(nextHome);
      setHomeBase(nextHome);

      const nextFaq = toFaqForm(data.content.faq);
      setFaq(nextFaq);
      setFaqBase(nextFaq);

      const nextAbout = toAboutForm(data.content.about);
      setAbout(nextAbout);
      setAboutBase(nextAbout);

      const nextContactPage = toContactPageForm(data.content.contactPage);
      setContactPage(nextContactPage);
      setContactPageBase(nextContactPage);

      const nextServices = toServicesForm(data.content.services);
      setServices(nextServices);
      setServicesBase(nextServices);

      const nextSeo: SeoForm = { ...data.content.seo };
      setSeo(nextSeo);
      setSeoBase(nextSeo);

      const nextFooter: FooterForm = {
        tagline: data.content.footer.tagline,
        whatsappCta: data.content.footer.whatsappCta,
        copyrightText: data.content.footer.copyrightText,
      };
      setFooter(nextFooter);
      setFooterBase(nextFooter);

      setContent(data.content);
      setUpdatedAt(data.updatedAt ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await getCachedUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "admin" && profile?.role !== "developer") {
        router.push("/");
        return;
      }
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  const dirtyFirm = useMemo(() => {
    const changes: Record<string, string> = {};
    for (const key of FIRM_KEYS) {
      if (firm[key].trim() !== firmBase[key].trim()) changes[key] = firm[key].trim();
    }
    return changes;
  }, [firm, firmBase]);

  const homePatch = useMemo(() => {
    if (!home || !homeBase) return {};
    const patch: Record<string, unknown> = {};
    for (const key of [
      "heroBadge",
      "heroTitle",
      "heroHighlight",
      "heroSubtitle",
      "ctaTitle",
      "ctaSubtitle",
    ] as const) {
      if (home[key] !== homeBase[key]) patch[key] = home[key];
    }
    if (home.trustChips !== homeBase.trustChips) {
      patch.trustChips = splitList(home.trustChips);
    }
    if (JSON.stringify(home.stats) !== JSON.stringify(homeBase.stats)) patch.stats = home.stats;
    if (JSON.stringify(home.featured) !== JSON.stringify(homeBase.featured)) {
      patch.featured = home.featured;
    }
    if (JSON.stringify(home.why) !== JSON.stringify(homeBase.why)) patch.why = home.why;
    if (JSON.stringify(home.testimonials) !== JSON.stringify(homeBase.testimonials)) {
      patch.testimonials = home.testimonials;
    }
    return patch;
  }, [home, homeBase]);

  const faqPatch = useMemo(() => {
    if (!faq || !faqBase) return {};
    const patch: Record<string, unknown> = {};
    for (const key of ["badge", "title", "subtitle"] as const) {
      if (faq[key] !== faqBase[key]) patch[key] = faq[key];
    }
    if (JSON.stringify(faq.items) !== JSON.stringify(faqBase.items)) patch.items = faq.items;
    return patch;
  }, [faq, faqBase]);

  const aboutPatch = useMemo(() => {
    if (!about || !aboutBase) return {};
    const patch: Record<string, unknown> = {};
    for (const key of [
      "badge",
      "title",
      "highlight",
      "subtitle",
      "storyHeading",
      "storyHighlight",
      "quote",
      "visitTitle",
    ] as const) {
      if (about[key] !== aboutBase[key]) patch[key] = about[key];
    }
    if (JSON.stringify(about.stats) !== JSON.stringify(aboutBase.stats)) patch.stats = about.stats;
    if (about.story !== aboutBase.story) patch.story = splitStory(about.story);
    if (about.badges !== aboutBase.badges) patch.badges = splitList(about.badges);
    if (
      about.emergencyEnabled !== aboutBase.emergencyEnabled ||
      about.emergencyValue !== aboutBase.emergencyValue ||
      about.emergencyLabel !== aboutBase.emergencyLabel
    ) {
      patch.emergency = about.emergencyEnabled
        ? { value: about.emergencyValue, label: about.emergencyLabel }
        : null;
    }
    if (JSON.stringify(about.why) !== JSON.stringify(aboutBase.why)) patch.why = about.why;
    if (JSON.stringify(about.team) !== JSON.stringify(aboutBase.team)) patch.team = about.team;
    if (JSON.stringify(about.testimonials) !== JSON.stringify(aboutBase.testimonials)) {
      patch.testimonials = about.testimonials;
    }
    return patch;
  }, [about, aboutBase]);

  const contactPagePatch = useMemo(() => {
    if (!contactPage || !contactPageBase) return {};
    const patch: Record<string, unknown> = {};
    for (const key of ["badge", "title", "highlight", "subtitle"] as const) {
      if (contactPage[key] !== contactPageBase[key]) patch[key] = contactPage[key];
    }
    if (contactPage.serviceOptions !== contactPageBase.serviceOptions) {
      patch.serviceOptions = splitList(contactPage.serviceOptions);
    }
    if (JSON.stringify(contactPage.formCopy) !== JSON.stringify(contactPageBase.formCopy)) {
      patch.formCopy = contactPage.formCopy;
    }
    return patch;
  }, [contactPage, contactPageBase]);

  const servicesPatch = useMemo(() => {
    if (!services || !servicesBase) return {} as Record<string, Record<string, unknown>>;
    const out: Record<string, Record<string, unknown>> = {};
    for (const id of SERVICE_IDS) {
      const diff = diffService(services[id], servicesBase[id]);
      if (diff) out[id] = diff;
    }
    return out;
  }, [services, servicesBase]);

  const hasSeoChange = useMemo(
    () => !!seo && !!seoBase && JSON.stringify(seo) !== JSON.stringify(seoBase),
    [seo, seoBase]
  );
  const hasFooterChange = useMemo(
    () => !!footer && !!footerBase && JSON.stringify(footer) !== JSON.stringify(footerBase),
    [footer, footerBase]
  );
  const hasFooterFirmChange = firm.footer_text.trim() !== firmBase.footer_text.trim();

  const save = useCallback(
    async (payload: {
      firm?: Record<string, string>;
      patch?: Record<string, unknown>;
      confirmText?: string;
    }) => {
      const firmChanges = payload.firm ?? {};
      const patch = payload.patch ?? {};
      if (Object.keys(firmChanges).length === 0 && Object.keys(patch).length === 0) {
        toast.info("Koi change nahi hai.");
        return;
      }
      if (payload.confirmText && !window.confirm(payload.confirmText)) return;

      setSaving(true);
      try {
        const res = await fetch("/api/settings/site-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: updatedAt,
            firm: firmChanges,
            patch,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          fieldErrors?: string[];
          updatedAt?: string;
          currentUpdatedAt?: string | null;
        };
        if (!res.ok) {
          const detail = data.fieldErrors?.length
            ? `${data.error}: ${data.fieldErrors.join("; ")}`
            : data.error || "Save fail";
          if (res.status === 409) {
            toast.error(detail);
            await load();
            return;
          }
          throw new Error(detail);
        }
        toast.success("Website content save ho gaya ✅");
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setSaving(false);
      }
    },
    [updatedAt, load]
  );

  const saveBranding = () =>
    save({
      firm: Object.fromEntries(
        BRANDING_KEYS.filter((key) => dirtyFirm[key] !== undefined).map((key) => [
          key,
          dirtyFirm[key],
        ])
      ),
    });

  const saveContact = () =>
    save({
      firm: Object.fromEntries(
        CONTACT_KEYS.filter((key) => dirtyFirm[key] !== undefined).map((key) => [
          key,
          dirtyFirm[key],
        ])
      ),
      patch: Object.keys(contactPagePatch).length > 0 ? { contactPage: contactPagePatch } : {},
    });

  const saveHome = () =>
    save({ patch: Object.keys(homePatch).length > 0 ? { home: homePatch } : {} });

  const saveFaq = () => save({ patch: Object.keys(faqPatch).length > 0 ? { faq: faqPatch } : {} });

  const saveAbout = () =>
    save({ patch: Object.keys(aboutPatch).length > 0 ? { about: aboutPatch } : {} });

  const saveServices = () =>
    save({
      patch: Object.keys(servicesPatch).length > 0 ? { services: servicesPatch } : {},
    });

  const saveSeo = () => {
    const patch: Record<string, unknown> = {};
    if (hasSeoChange) patch.seo = seo;
    if (hasFooterChange) patch.footer = footer;
    const firmChanges: Record<string, string> = {};
    if (hasFooterFirmChange) firmChanges.footer_text = firm.footer_text.trim();
    save({ patch, firm: firmChanges });
  };

  const updateHome = (patch: Partial<HomeForm>) =>
    setHome((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateFaq = (patch: Partial<FaqForm>) =>
    setFaq((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateAbout = (patch: Partial<AboutForm>) =>
    setAbout((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateContactPage = (patch: Partial<ContactPageForm>) =>
    setContactPage((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateService = (id: ServiceId, patch: Partial<ServiceForm>) =>
    setServices((prev) => (prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (
    loadError ||
    !content ||
    !home ||
    !faq ||
    !about ||
    !contactPage ||
    !services ||
    !seo ||
    !footer
  ) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-red-400">
            <TriangleAlert size={16} /> {loadError || "Content load nahi hua"}
          </p>
          <button
            onClick={load}
            className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold"
          >
            Dobara try karo
          </button>
        </div>
      </div>
    );
  }

  const serviceForm = services[activeService];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <div className="mb-5">
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-white"
        >
          <ArrowLeft size={13} /> Settings
        </Link>
        <h1 className="flex items-center gap-2 font-display text-xl font-black">
          <Globe size={20} className="text-cyan-400" /> Website Content
        </h1>
        <p className="mt-1 text-[12px] text-muted">
          Public site DB se chalti hai. Form effective value dikhata hai; save par sirf changed
          fields jaate hain. Save ke baad hard refresh par naya content dikhega.
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-2">
          Mode: {content.mode} · Last update:{" "}
          {updatedAt ? new Date(updatedAt).toLocaleString("en-IN") : "kabhi nahi"}
        </p>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-app bg-panel p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-[12px] font-bold transition-colors ${
              tab === t.id ? "bg-blue-500/15 text-blue-300" : "text-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "branding" && (
        <section className="space-y-4">
          <SectionCard title="Branding">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Business Name"
                value={firm.name}
                onChange={(v) => setFirm((p) => ({ ...p, name: v }))}
                placeholder={content.brand.name}
              />
              <Field
                label="Short Name"
                value={firm.short_name}
                onChange={(v) => setFirm((p) => ({ ...p, short_name: v }))}
                placeholder={content.brand.shortName}
              />
              <Field
                label="Tagline"
                value={firm.tagline}
                onChange={(v) => setFirm((p) => ({ ...p, tagline: v }))}
                placeholder={content.brand.tagline}
              />
              <Field
                label="Owner Name"
                value={firm.owner}
                onChange={(v) => setFirm((p) => ({ ...p, owner: v }))}
                placeholder={content.brand.owner}
                hint="Tokens: {brand}, {shortName}, {tagline}, {owner}, {year}, {since}"
              />
            </div>
            <div className="mt-5">
              <SaveRow
                label="Save Branding"
                hint="Khaali chhodne par env/hardcoded default use hota hai."
                disabled={Object.keys(dirtyFirm).length === 0}
                saving={saving}
                onSave={saveBranding}
              />
            </div>
          </SectionCard>
        </section>
      )}

      {tab === "contact" && (
        <section className="space-y-4">
          <SectionCard
            title="Contact details"
            action={
              <button
                onClick={() =>
                  save({
                    patch: { contactPage: null },
                    firm: Object.fromEntries(CONTACT_KEYS.map((key) => [key, ""])),
                    confirmText: "Contact page aur firm contact overrides clear karein?",
                  })
                }
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold"
              >
                <RotateCcw size={12} /> Reset
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Phone (display)"
                value={firm.contact}
                onChange={(v) => setFirm((p) => ({ ...p, contact: v }))}
                placeholder={content.contact.phone}
              />
              <Field
                label="WhatsApp number"
                value={firm.whatsapp}
                onChange={(v) => setFirm((p) => ({ ...p, whatsapp: v }))}
                placeholder={content.contact.whatsapp}
              />
              <Field
                label="Email"
                type="email"
                value={firm.email}
                onChange={(v) => setFirm((p) => ({ ...p, email: v }))}
                placeholder={content.contact.email}
              />
              <Field
                label="Business days"
                value={firm.biz_days}
                onChange={(v) => setFirm((p) => ({ ...p, biz_days: v }))}
                placeholder={content.contact.businessDays}
              />
              <Field
                label="Opens (HH:MM)"
                value={firm.biz_open}
                onChange={(v) => setFirm((p) => ({ ...p, biz_open: v }))}
                placeholder={content.contact.openTime}
                hint="24-hour format — e.g. 10:00"
              />
              <Field
                label="Closes (HH:MM)"
                value={firm.biz_close}
                onChange={(v) => setFirm((p) => ({ ...p, biz_close: v }))}
                placeholder={content.contact.closeTime}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4">
              <TextArea
                label="Address"
                value={firm.address}
                onChange={(v) => setFirm((p) => ({ ...p, address: v }))}
                placeholder={content.contact.address}
                rows={2}
              />
              <TextArea
                label="Announcement banner"
                value={firm.announcement}
                onChange={(v) => setFirm((p) => ({ ...p, announcement: v }))}
                placeholder={content.contact.announcement || "Optional banner text"}
                rows={2}
                hint="Khaali = banner hide. Public navbar ke neeche dismissible strip dikhegi."
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Google Maps URL"
                value={firm.map_url}
                onChange={(v) => setFirm((p) => ({ ...p, map_url: v }))}
                placeholder={content.contact.mapUrl}
                hint="Khaali = office GPS (geofence settings) se exact map/directions link banta hai; warna address search."
              />
              <Field
                label="Facebook URL"
                value={firm.facebook}
                onChange={(v) => setFirm((p) => ({ ...p, facebook: v }))}
                placeholder={content.contact.facebook}
              />
              <Field
                label="Instagram URL"
                value={firm.instagram}
                onChange={(v) => setFirm((p) => ({ ...p, instagram: v }))}
                placeholder={content.contact.instagram}
              />
              <Field
                label="YouTube URL"
                value={firm.youtube}
                onChange={(v) => setFirm((p) => ({ ...p, youtube: v }))}
                placeholder={content.contact.youtube}
              />
            </div>
          </SectionCard>

          <SectionCard title="Contact page copy">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Badge"
                value={contactPage.badge}
                onChange={(v) => updateContactPage({ badge: v })}
              />
              <Field
                label="Highlight phrase"
                value={contactPage.highlight}
                onChange={(v) => updateContactPage({ highlight: v })}
              />
            </div>
            <div className="mt-4 space-y-4">
              <TextArea
                label="Title"
                value={contactPage.title}
                onChange={(v) => updateContactPage({ title: v })}
                rows={2}
              />
              <TextArea
                label="Subtitle"
                value={contactPage.subtitle}
                onChange={(v) => updateContactPage({ subtitle: v })}
                rows={2}
              />
              <Field
                label="Service options (comma separated)"
                value={contactPage.serviceOptions}
                onChange={(v) => updateContactPage({ serviceOptions: v })}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="Name label"
                value={contactPage.formCopy.name}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, name: v } })
                }
              />
              <Field
                label="Mobile label"
                value={contactPage.formCopy.mobile}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, mobile: v } })
                }
              />
              <Field
                label="Email label"
                value={contactPage.formCopy.email}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, email: v } })
                }
              />
              <Field
                label="Service label"
                value={contactPage.formCopy.service}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, service: v } })
                }
              />
              <Field
                label="Message label"
                value={contactPage.formCopy.message}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, message: v } })
                }
              />
              <Field
                label="Submit label"
                value={contactPage.formCopy.submit}
                onChange={(v) =>
                  updateContactPage({ formCopy: { ...contactPage.formCopy, submit: v } })
                }
              />
            </div>
            <div className="mt-5">
              <SaveRow
                label="Save Contact"
                hint="Business hours public footer/contact me dikhte hain."
                disabled={
                  Object.keys(dirtyFirm).length === 0 && Object.keys(contactPagePatch).length === 0
                }
                saving={saving}
                onSave={saveContact}
              />
            </div>
          </SectionCard>
        </section>
      )}

      {tab === "home" && (
        <section className="space-y-4">
          <SectionCard title="Hero">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Badge"
                value={home.heroBadge}
                onChange={(v) => updateHome({ heroBadge: v })}
              />
              <Field
                label="Highlight phrase"
                value={home.heroHighlight}
                onChange={(v) => updateHome({ heroHighlight: v })}
                hint="Title me isi phrase par gradient lagta hai."
              />
            </div>
            <div className="mt-4 space-y-4">
              <TextArea
                label="Title"
                value={home.heroTitle}
                onChange={(v) => updateHome({ heroTitle: v })}
                rows={2}
              />
              <TextArea
                label="Subtitle"
                value={home.heroSubtitle}
                onChange={(v) => updateHome({ heroSubtitle: v })}
              />
              <Field
                label="Trust chips (comma separated)"
                value={home.trustChips}
                onChange={(v) => updateHome({ trustChips: v })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Stats">
            <StatsEditor items={home.stats} onChange={(items) => updateHome({ stats: items })} />
          </SectionCard>

          <SectionCard title="Featured cards">
            <FeaturedEditor
              items={home.featured}
              onChange={(items) => updateHome({ featured: items })}
            />
          </SectionCard>

          <SectionCard title="Why choose us">
            <FeaturesEditor items={home.why} onChange={(items) => updateHome({ why: items })} />
          </SectionCard>

          <SectionCard title="Testimonials">
            <TestimonialsEditor
              items={home.testimonials}
              onChange={(items) => updateHome({ testimonials: items })}
            />
          </SectionCard>

          <SectionCard title="Bottom CTA">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="CTA title"
                value={home.ctaTitle}
                onChange={(v) => updateHome({ ctaTitle: v })}
              />
              <Field
                label="CTA subtitle"
                value={home.ctaSubtitle}
                onChange={(v) => updateHome({ ctaSubtitle: v })}
              />
            </div>
          </SectionCard>

          <SaveRow
            label="Save Home"
            hint="Reset sirf home section ke DB overrides hataata hai."
            disabled={Object.keys(homePatch).length === 0}
            saving={saving}
            onSave={saveHome}
            onReset={() => save({ patch: { home: null } })}
            resetConfirm="Home page ke saare DB overrides hata kar defaults wapas laayein?"
          />
        </section>
      )}

      {tab === "faq" && (
        <section className="space-y-4">
          <SectionCard title="FAQ section">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Badge" value={faq.badge} onChange={(v) => updateFaq({ badge: v })} />
              <Field label="Title" value={faq.title} onChange={(v) => updateFaq({ title: v })} />
            </div>
            <div className="mt-4">
              <TextArea
                label="Subtitle"
                value={faq.subtitle}
                onChange={(v) => updateFaq({ subtitle: v })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Questions">
            <FaqEditor items={faq.items} onChange={(items) => updateFaq({ items })} />
          </SectionCard>

          <SaveRow
            label="Save FAQ"
            hint="FAQ home page par dikhta hai; pehla open, baaki accordion me. JSON-LD inhi questions se banta hai."
            disabled={Object.keys(faqPatch).length === 0}
            saving={saving}
            onSave={saveFaq}
            onReset={() => save({ patch: { faq: null } })}
            resetConfirm="FAQ ke saare DB overrides hata kar defaults wapas laayein?"
          />
        </section>
      )}

      {tab === "about" && (
        <section className="space-y-4">
          <SectionCard title="Hero">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Badge"
                value={about.badge}
                onChange={(v) => updateAbout({ badge: v })}
              />
              <Field
                label="Highlight phrase"
                value={about.highlight}
                onChange={(v) => updateAbout({ highlight: v })}
              />
            </div>
            <div className="mt-4 space-y-4">
              <TextArea
                label="Title"
                value={about.title}
                onChange={(v) => updateAbout({ title: v })}
                rows={2}
              />
              <TextArea
                label="Subtitle"
                value={about.subtitle}
                onChange={(v) => updateAbout({ subtitle: v })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Stats">
            <StatsEditor items={about.stats} onChange={(items) => updateAbout({ stats: items })} />
          </SectionCard>

          <SectionCard title="Story">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Story heading"
                value={about.storyHeading}
                onChange={(v) => updateAbout({ storyHeading: v })}
              />
              <Field
                label="Story highlight"
                value={about.storyHighlight}
                onChange={(v) => updateAbout({ storyHighlight: v })}
              />
            </div>
            <div className="mt-4">
              <TextArea
                label="Story paragraphs"
                value={about.story}
                onChange={(v) => updateAbout({ story: v })}
                rows={6}
                hint="Paragraphs blank line se alag karein."
              />
            </div>
            <div className="mt-4">
              <TextArea
                label="Quote"
                value={about.quote}
                onChange={(v) => updateAbout({ quote: v })}
                rows={3}
              />
            </div>
            <div className="mt-4">
              <Field
                label="Badges (comma separated)"
                value={about.badges}
                onChange={(v) => updateAbout({ badges: v })}
              />
            </div>
          </SectionCard>

          <SectionCard title="Emergency badge">
            <Toggle
              label="Emergency badge dikhao"
              checked={about.emergencyEnabled}
              onChange={(checked) => updateAbout({ emergencyEnabled: checked })}
            />
            {about.emergencyEnabled && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Value"
                  value={about.emergencyValue}
                  onChange={(v) => updateAbout({ emergencyValue: v })}
                />
                <Field
                  label="Label"
                  value={about.emergencyLabel}
                  onChange={(v) => updateAbout({ emergencyLabel: v })}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Why choose us">
            <FeaturesEditor items={about.why} onChange={(items) => updateAbout({ why: items })} />
          </SectionCard>

          <SectionCard title="Team">
            <TeamEditor items={about.team} onChange={(items) => updateAbout({ team: items })} />
          </SectionCard>

          <SectionCard title="Testimonials">
            <TestimonialsEditor
              items={about.testimonials}
              onChange={(items) => updateAbout({ testimonials: items })}
            />
          </SectionCard>

          <SectionCard title="Workshop visit">
            <Field
              label="Visit section title"
              value={about.visitTitle}
              onChange={(v) => updateAbout({ visitTitle: v })}
            />
          </SectionCard>

          <SaveRow
            label="Save About"
            hint="Reset sirf about section ke DB overrides hataata hai."
            disabled={Object.keys(aboutPatch).length === 0}
            saving={saving}
            onSave={saveAbout}
            onReset={() => save({ patch: { about: null } })}
            resetConfirm="About page ke saare DB overrides hata kar defaults wapas laayein?"
          />
        </section>
      )}

      {tab === "services" && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-app bg-panel p-1">
            {SERVICE_IDS.map((id) => {
              const form = services[id];
              return (
                <button
                  key={id}
                  onClick={() => setActiveService(id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[12px] font-bold transition-colors ${
                    activeService === id
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {form.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                      form.enabled
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/[0.06] text-muted-2"
                    }`}
                  >
                    {form.enabled ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>

          <SectionCard title={`${serviceForm.label} — settings`}>
            <div className="space-y-4">
              <Toggle
                label="Service enabled"
                checked={serviceForm.enabled}
                onChange={(checked) => updateService(activeService, { enabled: checked })}
                hint="Off karne par nav, footer aur sitemap se hide ho jayegi."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field
                  label="Label"
                  value={serviceForm.label}
                  onChange={(v) => updateService(activeService, { label: v })}
                />
                <Field
                  label="Badge"
                  value={serviceForm.badge}
                  onChange={(v) => updateService(activeService, { badge: v })}
                />
                <Select
                  label="Hero art"
                  value={serviceForm.art}
                  options={ART_KINDS}
                  onChange={(value) => updateService(activeService, { art: value as ArtKind })}
                />
              </div>
              <Field
                label="Menu description"
                value={serviceForm.desc}
                onChange={(v) => updateService(activeService, { desc: v })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Title"
                  value={serviceForm.title}
                  onChange={(v) => updateService(activeService, { title: v })}
                />
                <Field
                  label="Highlight phrase"
                  value={serviceForm.highlight}
                  onChange={(v) => updateService(activeService, { highlight: v })}
                />
              </div>
              <TextArea
                label="Subtitle"
                value={serviceForm.subtitle}
                onChange={(v) => updateService(activeService, { subtitle: v })}
              />
              <TextArea
                label="Minimal mode subtitle"
                value={serviceForm.minimalSubtitle}
                onChange={(v) => updateService(activeService, { minimalSubtitle: v })}
                rows={2}
              />
            </div>
          </SectionCard>

          <SectionCard title="Section headings">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Equipment heading"
                value={serviceForm.headings.equipment}
                onChange={(v) =>
                  updateService(activeService, {
                    headings: { ...serviceForm.headings, equipment: v },
                  })
                }
              />
              <Field
                label="Equipment note"
                value={serviceForm.headings.equipmentNote}
                onChange={(v) =>
                  updateService(activeService, {
                    headings: { ...serviceForm.headings, equipmentNote: v },
                  })
                }
              />
              <Field
                label="Process heading"
                value={serviceForm.headings.process}
                onChange={(v) =>
                  updateService(activeService, {
                    headings: { ...serviceForm.headings, process: v },
                  })
                }
              />
              <Field
                label="Why heading"
                value={serviceForm.headings.why}
                onChange={(v) =>
                  updateService(activeService, {
                    headings: { ...serviceForm.headings, why: v },
                  })
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Equipment">
            <EquipmentEditor
              items={serviceForm.equipment}
              onChange={(items) => updateService(activeService, { equipment: items })}
            />
          </SectionCard>

          <SectionCard title="Repair steps">
            <StepsEditor
              items={serviceForm.steps}
              cap={CAPS.steps}
              label="step"
              onChange={(items) => updateService(activeService, { steps: items })}
            />
          </SectionCard>

          <SectionCard title="Why us points">
            <StepsEditor
              items={serviceForm.points}
              cap={CAPS.points}
              label="point"
              onChange={(items) => updateService(activeService, { points: items })}
            />
          </SectionCard>

          <SectionCard title="EV highlight">
            <div className="space-y-4">
              <Toggle
                label="EV highlight section dikhao"
                checked={serviceForm.evPresent}
                onChange={(checked) =>
                  updateService(activeService, {
                    evPresent: checked,
                    ...(checked ? { evEnabled: true } : {}),
                  })
                }
                hint="Off = section poori tarah hide (DB override hata kar default behavior)."
              />
              {serviceForm.evPresent && (
                <>
                  <Toggle
                    label="Highlight enabled"
                    checked={serviceForm.evEnabled}
                    onChange={(checked) => updateService(activeService, { evEnabled: checked })}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Badge"
                      value={serviceForm.evBadge}
                      onChange={(v) => updateService(activeService, { evBadge: v })}
                    />
                    <Field
                      label="Title"
                      value={serviceForm.evTitle}
                      onChange={(v) => updateService(activeService, { evTitle: v })}
                    />
                  </div>
                  <Field
                    label="Highlight phrase"
                    value={serviceForm.evHighlightText}
                    onChange={(v) => updateService(activeService, { evHighlightText: v })}
                  />
                  <TextArea
                    label="Body"
                    value={serviceForm.evBody}
                    onChange={(v) => updateService(activeService, { evBody: v })}
                    rows={4}
                  />
                  <Field
                    label="Chips (comma separated)"
                    value={serviceForm.evChips}
                    onChange={(v) => updateService(activeService, { evChips: v })}
                  />
                  <TextArea
                    label="Images (one URL per line)"
                    value={serviceForm.evImages}
                    onChange={(v) => updateService(activeService, { evImages: v })}
                    rows={3}
                    hint="Local path (/image.png) ya https:// URL."
                  />
                </>
              )}
            </div>
          </SectionCard>

          <SaveRow
            label="Save Services"
            hint={`${Object.keys(servicesPatch).length} service section(s) me changes.`}
            disabled={Object.keys(servicesPatch).length === 0}
            saving={saving}
            onSave={saveServices}
            onReset={() =>
              save({
                patch: { services: { [activeService]: null } },
                confirmText: `${serviceForm.label} ke DB overrides hata kar defaults wapas laayein?`,
              })
            }
          />
        </section>
      )}

      {tab === "seo" && (
        <section className="space-y-4">
          <SectionCard title="SEO">
            <div className="space-y-4">
              <Field
                label="Meta title"
                value={seo.title}
                onChange={(v) => setSeo((p) => (p ? { ...p, title: v } : p))}
              />
              <TextArea
                label="Meta description"
                value={seo.description}
                onChange={(v) => setSeo((p) => (p ? { ...p, description: v } : p))}
                rows={2}
              />
              <Field
                label="Keywords"
                value={seo.keywords}
                onChange={(v) => setSeo((p) => (p ? { ...p, keywords: v } : p))}
              />
            </div>
          </SectionCard>

          <SectionCard title="Footer">
            <div className="space-y-4">
              <TextArea
                label="Footer tagline"
                value={footer.tagline}
                onChange={(v) => setFooter((p) => (p ? { ...p, tagline: v } : p))}
                rows={2}
              />
              <Field
                label="WhatsApp CTA text"
                value={footer.whatsappCta}
                onChange={(v) => setFooter((p) => (p ? { ...p, whatsappCta: v } : p))}
              />
              <Field
                label="Copyright text"
                value={footer.copyrightText}
                onChange={(v) => setFooter((p) => (p ? { ...p, copyrightText: v } : p))}
                hint="Token {year} current year deta hai."
              />
              <Field
                label="Footer text override (legacy key)"
                value={firm.footer_text}
                onChange={(v) => setFirm((p) => ({ ...p, footer_text: v }))}
                placeholder={content.footer.tagline}
              />
            </div>
          </SectionCard>

          <SaveRow
            label="Save SEO & Footer"
            hint="Reset SEO + footer DB overrides hataata hai."
            disabled={!hasSeoChange && !hasFooterChange && !hasFooterFirmChange}
            saving={saving}
            onSave={saveSeo}
            onReset={() =>
              save({
                patch: { seo: null, footer: null },
                firm: { footer_text: "" },
                confirmText: "SEO aur footer ke DB overrides hata kar defaults wapas laayein?",
              })
            }
          />
        </section>
      )}
    </div>
  );
}
