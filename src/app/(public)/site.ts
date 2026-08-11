export const SITE = {
  name: "V-Technologies",
  shortName: "V-Tech",
  tagline: "Repair & Service Experts",
  phone: "+91 91791 05875",
  phoneHref: "tel:+919179105875",
  whatsapp: "https://wa.me/919179105875",
  email: "vtech.jbp@gmail.com",
  address:
    "F4 Hotel Plaza (Madhushala), Besides Jayanti Complex, Marhatal, Jabalpur, MP 482002",
};

export const WHATSAPP_LINK = (text: string) =>
  `https://wa.me/919179105875?text=${encodeURIComponent(text)}`;

export const SERVICES = [
  { href: "/stage-lighting", label: "Stage Lighting", desc: "Moving Head, Par, DMX, Laser, LED Wall, Fog Machine", art: "moving-head" },
  { href: "/industrial", label: "Industrial Electronics", desc: "PLC, HMI, Control Panel, VFD, SCADA, Servo", art: "plc" },
  { href: "/power-supply", label: "Power Supply", desc: "SMPS, EV Charger, UPS, Inverter, LED Driver", art: "smps" },
] as const;
