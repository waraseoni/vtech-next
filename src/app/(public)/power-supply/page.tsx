import Image from "next/image";
import { BatteryCharging, ShieldCheck, CircuitBoard, Gauge, Zap, Phone } from "lucide-react";
import { SITE } from "../site";
import { PageHero, EquipmentGrid, ProcessSteps, RepairHighlights, CtaBand } from "../components/blocks";

const EQUIPMENT = [
  { art: "smps" as const, name: "SMPS (All Types)", detail: "Computer, CCTV, LED, industrial SMPS — component-level repair.", badge: "available" as const },
  { art: "ev-charger" as const, image: "/ev_charger_repair.png", name: "EV Charger", detail: "2-wheeler EV chargers — 48V / 60V / 72V, PCB-level fix.", badge: "available" as const },
  { art: "ups" as const, name: "UPS / Inverter", detail: "Home UPS, online UPS, inverter charging section repair.", badge: "available" as const },
  { art: "battery-charger" as const, name: "Battery Charger", detail: "Industrial aur domestic battery chargers — all voltages.", badge: "available" as const },
  { art: "led-driver" as const, name: "LED Driver", detail: "LED panel, street light, display driver repair.", badge: "available" as const },
  { art: "adapter" as const, name: "Adapter Repair", detail: "Laptop, router, CCTV adapters — replacement kai bar expensive.", badge: "available" as const },
];

const STEPS = [
  { title: "Bhejo / Laao", desc: "Power supply laao ya bhejo — free diagnosis." },
  { title: "Fault Fix", desc: "Faulty component change karke load test karte hain." },
  { title: "Warranty ke saath wapas", desc: "100% load tested repair, service warranty ke saath." },
];

const POINTS = [
  { title: "PCB-Level Repair", desc: "Poora power supply replace nahi — faulty component change hota hai." },
  { title: "100% Load Tested", desc: "Har repaired unit full load par test karke hi return." },
  { title: "Genuine Components", desc: "Original MOSFETs, ICs, capacitors hi use karte hain." },
  { title: "Kam Rate, Tez Service", desc: "Naya kharidne se kaafi sasta — zyada tar same day." },
];

export default function PowerSupplyPage() {
  return (
    <>
      <PageHero
        badge="Power Supply"
        title="Power Supply"
        highlight="Repair Specialists"
        subtitle="SMPS, EV chargers, UPS, inverters, battery chargers aur LED drivers — power supply repair ka specialist center. Component-level fix jo naya kharidne se kaafi sasta padta hai."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <h2 className="font-display text-xl sm:text-2xl font-black">What We Repair</h2>
            <span className="text-[11px] font-bold text-slate-500">Green = Available Now</span>
          </div>
          <EquipmentGrid items={EQUIPMENT} />
        </div>
      </section>

      {/* EV Charger highlight */}
      <section className="py-10 sm:py-14 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-black uppercase tracking-widest mb-4">
                <BatteryCharging size={13} /> New Service
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                EV Charger <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Repair &amp; Service</span>
              </h2>
              <p className="mt-3 text-[14px] text-slate-400 leading-relaxed">
                Ab hum Electric Vehicle chargers bhi repair karte hain — Komaki, Ola, Hero Electric, Ampere aur doosre brands. 48V, 60V, 72V fast chargers ka PCB-level repair, warranty ke saath.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                  <CircuitBoard size={17} className="text-emerald-400 shrink-0" />
                  <span className="text-[12px] font-bold text-slate-300">PCB-Level Repair</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                  <Gauge size={17} className="text-emerald-400 shrink-0" />
                  <span className="text-[12px] font-bold text-slate-300">Load Tested</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                  <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
                  <span className="text-[12px] font-bold text-slate-300">Service Warranty</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl p-3.5 bg-white/[0.03] border border-white/[0.06]">
                  <Zap size={17} className="text-emerald-400 shrink-0" />
                  <span className="text-[12px] font-bold text-slate-300">Fast Turnaround</span>
                </div>
              </div>
            </div>
            <div>
              <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0b0b1a]">
                <div className="grid grid-cols-2 gap-1">
                  <Image src="/ev_charger_repair.png" alt="EV charger repair — open PCB" width={600} height={400}
                    className="aspect-[3/2] w-full object-cover hover:scale-[1.03] transition-transform duration-500" />
                  <Image src="/komaki_ev_charger_1.png" alt="Komaki EV charger" width={600} height={400}
                    className="aspect-[3/2] w-full object-cover hover:scale-[1.03] transition-transform duration-500" />
                  <Image src="/komaki_ev_charger_2.png" alt="Komaki EV charger repair" width={600} height={400}
                    className="aspect-[3/2] w-full object-cover hover:scale-[1.03] transition-transform duration-500" />
                  <div className="relative aspect-[3/2] w-full flex items-center justify-center bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border-t border-l border-white/[0.06]">
                    <div className="text-center p-4">
                      <a href={SITE.phoneHref} className="inline-flex items-center gap-2 text-[13px] font-black text-emerald-400 hover:underline">
                        <Phone size={14} /> Apna charger dikhao
                      </a>
                      <p className="text-[11px] text-slate-500 mt-1">Photo bhejo — turant estimate</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">Repair Process</h2>
          <ProcessSteps steps={STEPS} />
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">Why Power Supply Repair Beats Replacement</h2>
          <RepairHighlights points={POINTS} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
