import ZoomableImage from "@/components/ZoomableImage";
import {
  BatteryCharging,
  CircuitBoard,
  Gauge,
  MessageCircle,
  Phone,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getPublicSiteContent } from "@/lib/public-site-content";
import { buildWhatsAppLink, type ServiceId } from "@/lib/public-site-defaults";
import { PageHero, ProcessSteps, RepairHighlights, CtaBand, BrandedServicePage } from "./blocks";
import { EquipmentExplorer } from "./equipment-explorer";
import { notFound } from "next/navigation";

const CHIP_ICONS: LucideIcon[] = [CircuitBoard, Gauge, ShieldCheck, Zap];

export async function ServicePageView({ serviceId }: { serviceId: ServiceId }) {
  const content = await getPublicSiteContent();
  const service = content.services[serviceId];

  if (!service.enabled) notFound();

  if (content.mode === "minimal") {
    return (
      <BrandedServicePage
        content={content}
        badge={service.badge}
        title={service.title}
        highlight={service.highlight}
        subtitle={service.minimalSubtitle}
      />
    );
  }

  const ev = service.evHighlight?.enabled ? service.evHighlight : null;
  const evImages = ev ? ev.images.slice(0, 3) : [];

  return (
    <>
      <PageHero
        badge={service.badge}
        title={service.title}
        highlight={service.highlight}
        subtitle={service.subtitle}
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <h2 className="font-display text-xl sm:text-2xl font-black">
              {service.headings.equipment}
            </h2>
            <span className="text-[11px] font-bold text-muted">
              {service.headings.equipmentNote}
            </span>
          </div>
          <EquipmentExplorer items={service.equipment} />
        </div>
      </section>

      {ev && (
        <section className="py-10 sm:py-14 bg-app/60 border-y border-white/[0.05]">
          <div className="mx-auto max-w-7xl px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-black uppercase tracking-widest mb-4">
                  <BatteryCharging size={13} /> {ev.badge}
                </span>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                  {ev.title}{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                    {ev.highlight}
                  </span>
                </h2>
                <p className="mt-3 text-[14px] text-muted leading-relaxed">{ev.body}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {ev.chips.map((chip, i) => {
                    const Icon = CHIP_ICONS[i % CHIP_ICONS.length];
                    return (
                      <div
                        key={`${chip}-${i}`}
                        className="flex items-center gap-2.5 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]"
                      >
                        <Icon size={17} className="text-emerald-400 shrink-0" />
                        <span className="text-[12px] font-bold text-app-2">{chip}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0b0b1a]">
                  <div className="grid grid-cols-2 gap-1">
                    {evImages.map((src, i) => (
                      <ZoomableImage
                        key={`${src}-${i}`}
                        src={src}
                        alt={`${ev.title} — ${i + 1}`}
                        width={600}
                        height={400}
                        className="aspect-[3/2] w-full object-cover hover:scale-[1.03] transition-transform duration-500"
                      />
                    ))}
                    <div className="relative aspect-[3/2] w-full flex items-center justify-center bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border-t border-l border-white/[0.06]">
                      <div className="text-center p-4">
                        <a
                          href={content.contact.phoneHref}
                          className="inline-flex items-center gap-2 text-[13px] font-black text-emerald-400 hover:underline"
                        >
                          <Phone size={14} /> Apna charger dikhao
                        </a>
                        <p className="text-[11px] text-muted mt-1">Photo bhejo — turant estimate</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">
            {service.headings.process}
          </h2>
          <ProcessSteps steps={service.steps} />
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-app/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">
            {service.headings.why}
          </h2>
          <RepairHighlights points={service.points} />
        </div>
      </section>

      <CtaBand content={content} />

      <a
        href={buildWhatsAppLink(
          content,
          `Hello, ${service.label} repair ka free estimate chahiye.`
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-4 z-40 hidden lg:flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-[13px] font-black text-app shadow-2xl shadow-black/40 active:scale-95 transition-transform"
      >
        <MessageCircle size={17} /> Free estimate
      </a>
    </>
  );
}
