import { PageHero, EquipmentGrid, ProcessSteps, RepairHighlights, CtaBand } from "../components/blocks";

const EQUIPMENT = [
  { art: "plc" as const, name: "PLC Repair", detail: "Programmable logic controllers — power, I/O and processor section fix." },
  { art: "hmi" as const, name: "HMI / Display Repair", detail: "Operator panels, touch displays, keypad and communication boards." },
  { art: "panel" as const, name: "Control Panel", detail: "Panel wiring, contactors, relays, power section troubleshooting." },
  { art: "pcb" as const, name: "Control Card / PCB", detail: "Machine control boards, sensor cards, motor drive PCBs." },
  { art: "vfd" as const, name: "VFD / Inverter Drive", detail: "Variable frequency drives — rectifier, IGBT, control card repair." },
  { art: "scada" as const, name: "SCADA", detail: "Monitoring systems, RTU/module cards and communication repair." },
  { art: "servo" as const, name: "Servo Drive", detail: "Servo amplifiers, encoder and motor section fault repair." },
  { art: "power-module" as const, name: "Power Module", detail: "IGBT modules, rectifier stacks, power supply sections." },
  { art: "relay" as const, name: "Relay / Timer Boards", detail: "Industrial relay logic boards and timer cards." },
  { art: "industrial" as const, name: "Other Industrial Electronics", detail: "Koi bhi machine ki electronic board — bhejo, check karte hain." },
];

const STEPS = [
  { title: "Board Bhejo", desc: "Faulty board ya machine bhejo — courier facility available." },
  { title: "Diagnosis & Quote", desc: "Component-level fault nikal kar pehle rate bataate hain." },
  { title: "Repair + Load Test", desc: "Approval ke baad repair, phir actual load par test." },
];

const POINTS = [
  { title: "Component-Level Repair", desc: "Board replacement bait nahi — asli faulty IC/component change hota hai." },
  { title: "Load Tested", desc: "Har repaired drive/module ko load par test karke hi return karte hain." },
  { title: "Fast Turnaround", desc: "Production line rukna afford nahi hota — priority service available." },
  { title: "Free Diagnosis", desc: "Diagnosis ka alag se koi charge nahi. Repair confirm hoke hi kaam." },
];

export default function IndustrialPage() {
  return (
    <>
      <PageHero
        badge="Industrial Electronics"
        title="Industrial"
        highlight="Electronics Repair"
        subtitle="PLC, HMI, control panels, VFD drives, servo, SCADA aur machine PCBs — component-level industrial electronics repair jo aapka production line ka downtime kam kare."
      />

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <h2 className="font-display text-xl sm:text-2xl font-black">What We Repair</h2>
            <span className="text-[11px] font-bold text-slate-500">Brand-independent service</span>
          </div>
          <EquipmentGrid items={EQUIPMENT} />
        </div>
      </section>

      <section className="py-10 sm:py-14 bg-[#0a0a18]/60 border-y border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">How It Works</h2>
          <ProcessSteps steps={STEPS} />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="font-display text-xl sm:text-2xl font-black mb-5 sm:mb-7">Why Factories Choose Us</h2>
          <RepairHighlights points={POINTS} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
