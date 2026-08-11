import { PageHero, EquipmentGrid, ProcessSteps, RepairHighlights, CtaBand } from "../components/blocks";

const EQUIPMENT = [
  { art: "moving-head" as const, name: "Sharpy / Moving Head — 16 CH", detail: "Beam, color wheel, gobo, motors, power supply — full repair.", badge: "available" as const },
  { art: "moving-head" as const, name: "Sharpy / Moving Head — 20 CH", detail: "Advance moving head models — motherboard level fix.", badge: "available" as const },
  { art: "par" as const, name: "Par Light — RGBW", detail: "LED driver board, color mixing, power section repair.", badge: "available" as const },
  { art: "par" as const, name: "Par Light — COB", detail: "COB LED replacement, driver and thermal fault repair.", badge: "available" as const },
  { art: "strobe" as const, name: "DMX Strobe", detail: "Flash tube, trigger board, power supply fix.", badge: "available" as const },
  { art: "beam-bar" as const, name: "MI Bar (Mini Beam)", detail: "Small beam bars — motor, board, LED section repair.", badge: "available" as const },
  { art: "pixel-bar" as const, name: "Batton / Pixel Bar", detail: "Pixel control board, LED module replacement.", badge: "available" as const },
  { art: "fog" as const, name: "Fog / Smoke Machine", detail: "Heating element, pump, thermostat, PCB repair.", badge: "available" as const },
  { art: "bubble" as const, name: "Bubble Machine", detail: "Motor, pump and control section repair.", badge: "available" as const },
  { art: "dmx" as const, name: "DMX Controller / Console", detail: "DMX 512 output, touch screen, fader and motherboard fix.", badge: "available" as const },
  { art: "laser" as const, name: "Laser Light", detail: "Galvo, laser driver and diode replacement.", badge: "coming" as const },
  { art: "led-wall" as const, name: "LED Wall / Video Processor", detail: "Module, receiving card, hub and PSU repair.", badge: "available" as const },
];

const STEPS = [
  { title: "Bhejo & Diagnose", desc: "Equipment shop par lao ya photo bhejo — free diagnosis." },
  { title: "Component-Level Repair", desc: "Actual faulty part change hota hai, board replace nahi." },
  { title: "Load Test & Delivery", desc: "Full load test ke baad hi equipment return hota hai." },
];

const POINTS = [
  { title: "No Board Replacement Bait", desc: "Hum component change karte hain — repair zyada economical." },
  { title: "Genuine Spare Parts", desc: "Original motors, LED chips aur drivers hi lagte hain." },
  { title: "Same-Day Service", desc: "Event urgent ho to priority express repair bhi hoti hai." },
  { title: "Service Warranty", desc: "Har repair par written service warranty milti hai." },
];

export default function StageLightingPage() {
  return (
    <>
      <PageHero
        badge="Stage Lighting"
        title="Stage Lighting"
        highlight="Repair & Service"
        subtitle="Moving heads, par lights, DMX controllers, lasers, LED walls aur fog machines — sab kuch component-level repair karte hain. DJs aur event companies ke liye fast turnaround."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <h2 className="font-display text-xl sm:text-2xl font-black">Equipment We Repair</h2>
            <span className="text-[11px] font-bold text-slate-500">Green = Available Now</span>
          </div>
          <EquipmentGrid items={EQUIPMENT} />
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">Repair Process</h2>
          <ProcessSteps steps={STEPS} />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">Why DJs Trust Us</h2>
          <RepairHighlights points={POINTS} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
