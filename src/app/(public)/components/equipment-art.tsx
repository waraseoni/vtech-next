import { useId } from "react";

export type ArtKind =
  | "moving-head" | "par" | "strobe" | "beam-bar" | "pixel-bar" | "fog" | "bubble"
  | "dmx" | "laser" | "led-wall"
  | "plc" | "hmi" | "panel" | "pcb" | "vfd" | "servo" | "scada" | "power-module" | "relay" | "industrial"
  | "smps" | "ev-charger" | "ups" | "battery-charger" | "led-driver" | "adapter";

type Cat = "stage" | "industry" | "power";

const CAT: Record<Cat, { a: string; b: string; c: string }> = {
  stage:    { a: "#22d3ee", b: "#3b82f6", c: "#0ea5e9" },
  industry: { a: "#a78bfa", b: "#6366f1", c: "#8b5cf6" },
  power:    { a: "#34d399", b: "#2dd4bf", c: "#14b8a6" },
};

const KIND_CAT: Record<ArtKind, Cat> = {
  "moving-head": "stage", "par": "stage", "strobe": "stage", "beam-bar": "stage",
  "pixel-bar": "stage", "fog": "stage", "bubble": "stage", "dmx": "stage",
  "laser": "stage", "led-wall": "stage",
  "plc": "industry", "hmi": "industry", "panel": "industry", "pcb": "industry",
  "vfd": "industry", "servo": "industry", "scada": "industry", "power-module": "industry",
  "relay": "industry", "industrial": "industry",
  "smps": "power", "ev-charger": "power", "ups": "power", "battery-charger": "power",
  "led-driver": "power", "adapter": "power",
};

export function EquipmentArt({ kind, className }: { kind: ArtKind; className?: string }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const c = CAT[KIND_CAT[kind]];
  return (
    <svg viewBox="0 0 220 130" preserveAspectRatio="xMidYMid meet" className={className}
      aria-hidden="true" role="img">
      <defs>
        <radialGradient id={`${uid}bg`} cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor="rgba(10,14,34,0.9)" />
          <stop offset="100%" stopColor="rgba(8,10,24,1)" />
        </radialGradient>
        <radialGradient id={`${uid}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c.a} stopOpacity="0.45" />
          <stop offset="100%" stopColor={c.a} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}beam`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={c.a} stopOpacity="0.75" />
          <stop offset="100%" stopColor={c.a} stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`${uid}body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2440" />
          <stop offset="100%" stopColor="#11172c" />
        </linearGradient>
        <pattern id={`${uid}dots`} width="13" height="13" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)" />
        </pattern>
      </defs>

      <rect width="220" height="130" fill={`url(#${uid}bg)`} />
      <rect width="220" height="130" fill={`url(#${uid}dots)`} />
      <circle cx="110" cy="64" r="58" fill={`url(#${uid}glow)`} />
      <ellipse cx="110" cy="114" rx="55" ry="5" fill="rgba(0,0,0,0.45)" />

      <g>
        <Scene kind={kind} uid={uid} c={c} />
      </g>
    </svg>
  );
}

function Scene({ kind, uid, c }: { kind: ArtKind; uid: string; c: { a: string; b: string; c: string } }) {
  switch (kind) {
    /* ─── STAGE ─────────────────────────────────────────────────── */
    case "moving-head":
      return (
        <g>
          <polygon points="110,44 70,6 40,18 110,70" fill={`url(#${uid}beam)`} />
          <polygon points="110,44 150,6 180,18 110,70" fill={`url(#${uid}beam)`} opacity="0.7" />
          <line x1="110" y1="118" x2="110" y2="78" stroke="#2a3552" strokeWidth="5" strokeLinecap="round" />
          <line x1="110" y1="118" x2="92" y2="108" stroke="#2a3552" strokeWidth="4" strokeLinecap="round" />
          <line x1="110" y1="118" x2="128" y2="108" stroke="#2a3552" strokeWidth="4" strokeLinecap="round" />
          <rect x="80" y="58" width="60" height="34" rx="10" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.5" />
          <rect x="80" y="66" width="60" height="10" fill="#0d1226" />
          <circle cx="135" cy="75" r="12" fill="#0d1226" stroke={c.a} strokeWidth="2" />
          <circle cx="135" cy="75" r="6" fill={c.a} opacity="0.9" />
          <circle cx="128" cy="45" r="4" fill={c.a} opacity="0.6" />
          <circle cx="124" cy="50" r="2.5" fill="#e2f7ff" opacity="0.9" />
        </g>
      );

    case "par":
      return (
        <g>
          <rect x="74" y="52" width="72" height="26" rx="13" fill="#0d1226" stroke="#2a3552" strokeWidth="1.5" />
          <circle cx="110" cy="65" r="30" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.5" />
          <circle cx="110" cy="65" r="21" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
            <circle key={deg} cx={110 + 21 * Math.cos((deg * Math.PI) / 180)} cy={65 + 21 * Math.sin((deg * Math.PI) / 180)}
              r="3.2" fill={i % 3 === 0 ? c.a : i % 3 === 1 ? c.b : c.c} opacity="0.9" />
          ))}
          <circle cx="110" cy="65" r="10" fill={`url(#${uid}glow)`} />
          <circle cx="110" cy="65" r="5" fill="#d9fbff" />
        </g>
      );

    case "strobe":
      return (
        <g>
          <rect x="62" y="52" width="96" height="44" rx="10" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="74" y="64" width="72" height="20" rx="5" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <circle cx="110" cy="74" r="8" fill={`url(#${uid}glow)`} />
          <circle cx="110" cy="74" r="4" fill="#fff" />
          {[-70, -50, -30, -10, 10, 30, 50, 70].map((x, i) => (
            <line key={i} x1={110 + x} y1="92" x2={110 + x * 0.35} y2="84"
              stroke={i % 2 ? c.a : c.b} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
          ))}
        </g>
      );

    case "beam-bar":
      return (
        <g>
          <rect x="46" y="78" width="128" height="30" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          {[0, 1, 2, 3].map(i => {
            const x = 72 + i * 26;
            return (
              <g key={i}>
                <polygon points={`${x},64 ${x - 9},26 ${x + 9},26 ${x},64`} fill={`url(#${uid}beam)`} opacity="0.55" />
                <rect x={x - 7} y="66" width="14" height="12" rx="3" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
                <circle cx={x} cy="72" r="3.2" fill={i === 0 ? "#fff" : c.a} opacity="0.95" />
              </g>
            );
          })}
        </g>
      );

    case "pixel-bar":
      return (
        <g>
          <rect x="40" y="62" width="140" height="38" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <g key={i}>
              <rect x={48 + i * 16} y="70" width="11" height="22" rx="3" fill={i % 2 ? c.b : c.a} opacity={i % 3 === 0 ? 0.95 : 0.7} />
              <circle cx={53.5 + i * 16} cy="81" r="1.8" fill="#fff" opacity="0.9" />
            </g>
          ))}
        </g>
      );

    case "fog":
      return (
        <g>
          <rect x="48" y="72" width="96" height="34" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="144" y="78" width="18" height="18" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <circle cx="153" cy="87" r="5" fill={c.a} opacity="0.9" />
          <line x1="66" y1="60" x2="76" y2="60" stroke="#2a3552" strokeWidth="2.5" strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <g key={i}>
              <circle cx={166 + i * 8} cy={84 - i * 4} r={7 - i * 0.6} fill={c.a} opacity={0.32 - i * 0.04} />
              <circle cx={172 + i * 7} cy={92 + i * 3} r={5.5 - i * 0.5} fill={c.b} opacity={0.22 - i * 0.03} />
            </g>
          ))}
        </g>
      );

    case "bubble":
      return (
        <g>
          <rect x="52" y="70" width="88" height="36" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="140" y="76" width="16" height="16" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <circle cx="148" cy="84" r="4" fill={c.a} opacity="0.8" />
          {[
            { x: 168, y: 66, r: 9 }, { x: 186, y: 80, r: 7 }, { x: 174, y: 92, r: 6 },
            { x: 198, y: 64, r: 5 }, { x: 192, y: 48, r: 4 },
          ].map((b, i) => (
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={b.r} fill="none" stroke={i % 2 ? c.b : c.a} strokeWidth="1.4" opacity="0.85" />
              <circle cx={b.x - b.r * 0.35} cy={b.y - b.r * 0.35} r={b.r * 0.22} fill="#fff" opacity="0.5" />
            </g>
          ))}
        </g>
      );

    case "dmx":
      return (
        <g>
          <rect x="52" y="40" width="116" height="64" rx="10" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="60" y="47" width="44" height="14" rx="3" fill="#0d1226" stroke={c.b} strokeWidth="1" />
          <rect x="60" y="47" width="30" height="14" rx="3" fill={c.b} opacity="0.25" />
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <rect x={112 + i * 14} y="48" width="10" height="12" rx="2" fill="#1b2440" stroke="#2a3552" strokeWidth="1" />
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map(i => {
            const x = 66 + i * 16;
            const knob = 56 + (i % 2) * 14;
            return (
              <g key={i}>
                <line x1={x} y1="70" x2={x} y2="96" stroke="#2a3552" strokeWidth="3.5" strokeLinecap="round" />
                <rect x={x - 4.5} y={knob} width="9" height="11" rx="2.5" fill={c.a} opacity="0.9" />
              </g>
            );
          })}
        </g>
      );

    case "laser":
      return (
        <g>
          <line x1="104" y1="96" x2="88" y2="34" stroke={c.a} strokeWidth="2" opacity="0.7" />
          <line x1="110" y1="96" x2="110" y2="22" stroke="#fff" strokeWidth="2.2" opacity="0.85" />
          <line x1="116" y1="96" x2="132" y2="34" stroke={c.b} strokeWidth="2" opacity="0.7" />
          <line x1="120" y1="96" x2="146" y2="52" stroke={c.c} strokeWidth="1.6" opacity="0.6" />
          <circle cx="110" cy="86" r="5" fill={c.a} opacity="0.5" />
          <rect x="78" y="80" width="64" height="28" rx="8" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.5" />
          <circle cx="92" cy="94" r="5" fill="#0d1226" stroke="#2a3552" strokeWidth="1.2" />
          <rect x="104" y="88" width="18" height="10" rx="2" fill="#0d1226" stroke={c.b} strokeWidth="1" />
        </g>
      );

    case "led-wall":
      return (
        <g>
          {[0, 1].map(r => (
            [0, 1, 2].map(col => {
              const x = 52 + col * 40;
              const y = 44 + r * 30;
              return (
                <g key={`${r}-${col}`}>
                  <rect x={x} y={y} width="34" height="24" rx="3" fill="#0d1226" stroke={r === 1 && col === 1 ? c.a : "#2a3552"} strokeWidth="1.3" />
                  <circle cx={x + 7} cy={y + 7} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.a} opacity="0.9" />
                  <circle cx={x + 17} cy={y + 7} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.b} opacity="0.9" />
                  <circle cx={x + 27} cy={y + 7} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.c} opacity="0.9" />
                  <circle cx={x + 7} cy={y + 17} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.b} opacity="0.9" />
                  <circle cx={x + 17} cy={y + 17} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.a} opacity="0.9" />
                  <circle cx={x + 27} cy={y + 17} r="2.4" fill={r === 1 && col === 1 ? "#fff" : c.c} opacity="0.9" />
                </g>
              );
            })
          ))}
        </g>
      );

    /* ─── INDUSTRIAL ─────────────────────────────────────────────── */
    case "plc":
      return (
        <g>
          <rect x="54" y="46" width="112" height="62" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="62" y="42" width="96" height="12" rx="3" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={70 + i * 15} y="45" width="9" height="6" rx="1.5" fill={i % 2 ? c.c : "#4a557a"} />
          ))}
          {[0, 1, 2, 3, 4].map(r => (
            <g key={r}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(cell => (
                <circle key={cell} cx={72 + cell * 12.5} cy={66 + r * 8} r="2.4"
                  fill={r === 0 && cell % 3 === 0 ? c.a : r === 1 && cell % 2 ? "#34d399" : cell % 4 === 0 ? "#f59e0b" : "#3a4568"}
                  opacity="0.95" />
              ))}
            </g>
          ))}
        </g>
      );

    case "hmi":
      return (
        <g>
          <rect x="60" y="36" width="100" height="68" rx="10" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <circle cx="68" cy="44" r="2.2" fill="#4a557a" />
          <circle cx="152" cy="44" r="2.2" fill="#4a557a" />
          <rect x="68" y="46" width="84" height="48" rx="5" fill="#0d1226" stroke={c.b} strokeWidth="1.2" />
          <circle cx="96" cy="70" r="15" fill="none" stroke="#2a3552" strokeWidth="2.5" />
          <circle cx="96" cy="70" r="15" fill="none" stroke={c.a} strokeWidth="2.5"
            strokeDasharray="70 100" strokeLinecap="round" transform="rotate(130 96 70)" />
          <circle cx="96" cy="70" r="6" fill="none" stroke={c.a} strokeWidth="1.6" />
          <line x1="96" y1="70" x2="102" y2="61" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <polyline points="130,90 132,82 136,84 140,76 144,78 148,66" fill="none" stroke={c.b} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="128" y1="92" x2="152" y2="92" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case "panel":
      return (
        <g>
          <rect x="70" y="28" width="80" height="86" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="104" y="34" width="12" height="26" rx="3" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          <circle cx="86" cy="44" r="7" fill="#ef4444" opacity="0.85" />
          <circle cx="86" cy="44" r="3.5" fill="#ff7b7b" opacity="0.9" />
          <circle cx="110" cy="74" r="5.5" fill="#34d399" opacity="0.9" />
          <circle cx="128" cy="74" r="5.5" fill="#f59e0b" opacity="0.9" />
          <line x1="82" y1="92" x2="138" y2="92" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={78 + i * 17} y="100" width="11" height="7" rx="2" fill={i % 2 ? "#3a4568" : "#4a557a"} />
          ))}
          <rect x="70" y="28" width="12" height="86" rx="4" fill="#0d1226" opacity="0.6" />
        </g>
      );

    case "pcb":
      return (
        <g>
          <rect x="46" y="38" width="128" height="66" rx="8" fill="#0c1418" stroke="#1e3a34" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line key={i} x1={56 + i * 20} y1="44" x2={56 + i * 20} y2="98" stroke="#2a5c4a" strokeWidth="1" opacity="0.7" />
          ))}
          <polyline points="70,60 96,60 96,78 124,78" fill="none" stroke={c.c} strokeWidth="1.6" opacity="0.8" />
          <polyline points="140,88 124,88 124,66 100,66" fill="none" stroke={c.a} strokeWidth="1.6" opacity="0.8" />
          <rect x="88" y="56" width="34" height="26" rx="3" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.4" />
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={70 + i * 12} y="52" width="3" height="34" fill={c.b} opacity="0.7" />
          ))}
          <rect x="104" y="56" width="34" height="26" rx="3" fill={`url(#${uid}body)`} stroke={c.b} strokeWidth="1.4" />
          {[0, 1, 2, 3, 4].map(i => (
            <circle key={i} cx={58 + i * 22} cy={92} r="2.4" fill={i % 2 ? c.c : "#f59e0b"} opacity="0.9" />
          ))}
        </g>
      );

    case "vfd":
      return (
        <g>
          <rect x="60" y="36" width="100" height="70" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="68" y="42" width="36" height="18" rx="3" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
          <text x="74" y="55" fill={c.a} fontSize="9" fontWeight="700" fontFamily="monospace">0.00</text>
          <rect x="112" y="42" width="40" height="18" rx="3" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={116 + (i % 4) * 9} y={47 + Math.floor(i / 4) * 7} width="6" height="5" rx="1" fill={i % 2 ? c.b : "#3a4568"} />
          ))}
          {[0, 1, 2].map(i => (
            <circle key={i} cx={76 + i * 12} cy={72} r="4.5" fill={i === 1 ? c.a : "#2a3552"} />
          ))}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={70 + i * 13} y={82} width="9" height="3.5" rx="1.5" fill="#2a3552" />
          ))}
          <rect x="68" y="90" width="84" height="10" rx="4" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <line key={i} x1={72 + i * 10} y1="95" x2={72 + i * 10 + 4} y2="95" stroke="#3a4568" strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </g>
      );

    case "servo":
      return (
        <g>
          <rect x="52" y="44" width="86" height="54" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="60" y="50" width="30" height="16" rx="3" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
          <rect x="60" y="70" width="30" height="20" rx="3" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          <circle cx="75" cy="80" r="5" fill={c.b} opacity="0.85" />
          <circle cx="98" cy="72" r="4" fill={c.a} opacity="0.9" />
          <circle cx="98" cy="84" r="4" fill={c.c} opacity="0.9" />
          <line x1="138" y1="60" x2="138" y2="84" stroke="#2a3552" strokeWidth="3" strokeLinecap="round" />
          <rect x="140" y="52" width="20" height="38" rx="5" fill="#0d1226" stroke={c.a} strokeWidth="1.3" />
          <rect x="160" y="60" width="22" height="24" rx="4" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.3" />
          <circle cx="171" cy="72" r="8" fill="none" stroke="#2a3552" strokeWidth="1.5" />
          <circle cx="171" cy="72" r="3.5" fill={c.b} />
        </g>
      );

    case "scada":
      return (
        <g>
          <rect x="56" y="34" width="108" height="70" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="64" y="42" width="92" height="52" rx="4" fill="#0d1226" stroke={c.b} strokeWidth="1.2" />
          <rect x="70" y="48" width="14" height="7" rx="2" fill={c.c} opacity="0.85" />
          <rect x="70" y="58" width="14" height="7" rx="2" fill={c.a} opacity="0.85" />
          <rect x="70" y="68" width="14" height="7" rx="2" fill={c.b} opacity="0.85" />
          <polyline points="98,84 104,74 110,78 116,66 122,70 128,58 134,62 140,50" fill="none" stroke={c.a} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="98,84 104,74 110,78 116,66 122,70 128,58 134,62 140,50" fill={c.a} opacity="0.12" />
          <line x1="96" y1="86" x2="144" y2="86" stroke="#2a3552" strokeWidth="1.4" />
          <line x1="98" y1="86" x2="98" y2="46" stroke="#2a3552" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="140" cy="50" r="3" fill="#fff" />
        </g>
      );

    case "power-module":
      return (
        <g>
          <rect x="50" y="70" width="120" height="30" rx="6" fill="#0d1226" stroke="#2a3552" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <rect key={i} x={62 + i * 18} y="64" width="12" height="7" rx="1.5" fill={i % 2 ? c.b : "#4a557a"} />
          ))}
          {[0, 1, 2].map(i => (
            <circle key={i} cx={66 + i * 44} cy="85" r="4" fill={c.a} opacity="0.85" />
          ))}
          <rect x="78" y="52" width="64" height="16" rx="4" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.3" />
          <rect x="60" y="104" width="100" height="6" rx="3" fill="#2a3552" />
          <path d="M110 20 l-16 10 h32 z" fill={c.c} opacity="0.8" />
          <path d="M110 34 l-10 6 h20 z" fill={c.a} opacity="0.6" />
        </g>
      );

    case "relay":
      return (
        <g>
          <rect x="58" y="48" width="104" height="56" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="78" y="54" width="28" height="40" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.4" />
          <rect x="84" y="60" width="16" height="10" rx="2" fill={c.b} opacity="0.9" />
          {[0, 1].map(i => (
            <circle key={i} cx={92} cy={76 + i * 8} r="2.4" fill={i ? "#34d399" : "#f59e0b"} />
          ))}
          <rect x="114" y="58" width="18" height="30" rx="3" fill="#0d1226" stroke="#2a3552" strokeWidth="1.2" />
          <line x1="118" y1="66" x2="128" y2="66" stroke={c.a} strokeWidth="1.6" />
          <line x1="118" y1="72" x2="128" y2="72" stroke={c.b} strokeWidth="1.6" />
          <line x1="118" y1="78" x2="128" y2="78" stroke={c.c} strokeWidth="1.6" />
          {[0, 1, 2, 3].map(i => (
            <rect key={i} x={66 + i * 22} y="108" width="16" height="5" rx="2" fill="#3a4568" />
          ))}
        </g>
      );

    case "industrial":
      return (
        <g>
          <path d="M110 44 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0" fill="none" stroke={c.c} strokeWidth="2" opacity="0.5"
            transform="rotate(-14 110 44)" />
          <path d="M110 44 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0" fill="none" stroke={c.b} strokeWidth="2" opacity="0.6"
            transform="rotate(12 110 44)" />
          <circle cx="110" cy="44" r="12" fill={c.a} opacity="0.35" />
          <rect x="70" y="64" width="80" height="44" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="88" y="72" width="44" height="28" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.4" />
          <rect x="94" y="78" width="32" height="16" rx="2" fill={c.a} opacity="0.18" />
          {[0, 1, 2, 3, 4, 5].map(i => (
            <circle key={i} cx={76 + i * 14} cy={68} r="2.2" fill={i % 3 === 0 ? c.a : "#3a4568"} />
          ))}
          {[0, 1, 2].map(i => (
            <circle key={i} cx={140 + i * 8} cy={86} r="2.6" fill={i === 1 ? "#34d399" : "#f59e0b"} />
          ))}
        </g>
      );

    /* ─── POWER ──────────────────────────────────────────────────── */
    case "smps":
      return (
        <g>
          <rect x="56" y="44" width="108" height="62" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <circle cx="86" cy="66" r="20" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <circle cx="86" cy="66" r="15" fill="none" stroke="#2a3552" strokeWidth="1.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <g key={deg} transform={`rotate(${deg} 86 66)`}>
              <path d="M86 51 l3 4 l-3 4 l-3 -4 z" fill={c.a} opacity="0.85" />
            </g>
          ))}
          <rect x="112" y="52" width="40" height="8" rx="2" fill="#2a3552" opacity="0.8" />
          <rect x="112" y="64" width="40" height="8" rx="2" fill="#2a3552" opacity="0.8" />
          <rect x="112" y="76" width="40" height="8" rx="2" fill="#2a3552" opacity="0.8" />
          <rect x="62" y="88" width="26" height="10" rx="2" fill="#0d1226" stroke="#2a3552" strokeWidth="1" />
          <circle cx="118" cy="92" r="3" fill={c.a} opacity="0.95" />
        </g>
      );

    case "ev-charger":
      return (
        <g>
          <rect x="64" y="26" width="72" height="70" rx="9" fill={`url(#${uid}body)`} stroke={c.a} strokeWidth="1.5" />
          <rect x="74" y="36" width="52" height="20" rx="4" fill="#0d1226" stroke="#2a3552" strokeWidth="1.2" />
          <rect x="82" y="41" width="12" height="10" rx="2" fill={c.a} opacity="0.3" />
          <circle cx="112" cy="46" r="4" fill={c.a} opacity="0.95" />
          <circle cx="122" cy="46" r="4" fill={c.c} opacity="0.95" />
          <line x1="86" y1="66" x2="114" y2="66" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <line x1="86" y1="74" x2="106" y2="74" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <line x1="86" y1="82" x2="114" y2="82" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="92" r="5" fill="#0d1226" stroke={c.c} strokeWidth="1.4" />
          <path d="M96 92 l3 -4 v3 h3 l-3 4 v-3 z" fill={c.c} />
          <path d="M146 66 q26 0 26 22 q0 16 -18 18 h-10" fill="none" stroke={c.c} strokeWidth="4" strokeLinecap="round" />
          <rect x="142" y="104" width="22" height="12" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <circle cx="153" cy="110" r="3.4" fill={c.a} />
        </g>
      );

    case "ups":
      return (
        <g>
          <rect x="56" y="38" width="108" height="74" rx="9" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="64" y="46" width="40" height="20" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
          <text x="70" y="60" fill={c.a} fontSize="10" fontWeight="700" fontFamily="monospace">100%</text>
          <circle cx="118" cy="50" r="3.5" fill="#34d399" opacity="0.95" />
          <circle cx="128" cy="50" r="3.5" fill="#f59e0b" opacity="0.95" />
          <line x1="66" y1="76" x2="98" y2="76" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <line x1="66" y1="84" x2="98" y2="84" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <rect x="108" y="70" width="44" height="30" rx="5" fill="#0d1226" stroke="#2a3552" strokeWidth="1.2" />
          <rect x="114" y="76" width="18" height="18" rx="2" fill={c.a} opacity="0.2" />
          <rect x="118" y="80" width="10" height="10" rx="1.5" fill="none" stroke={c.a} strokeWidth="1.5" />
          <line x1="132" y1="80" x2="146" y2="80" stroke={c.c} strokeWidth="2" strokeLinecap="round" />
          <line x1="132" y1="88" x2="146" y2="88" stroke={c.b} strokeWidth="2" strokeLinecap="round" />
          <circle cx="100" cy="100" r="3" fill={c.c} opacity="0.9" />
        </g>
      );

    case "battery-charger":
      return (
        <g>
          <rect x="50" y="62" width="70" height="38" rx="8" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="58" y="70" width="28" height="14" rx="3" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
          <rect x="58" y="88" width="40" height="6" rx="2" fill="#2a3552" opacity="0.8" />
          <circle cx="108" cy="81" r="3.5" fill={c.a} opacity="0.95" />
          <path d="M120 76 q24 0 24 10 q0 12 -20 12" fill="none" stroke={c.c} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="118" y="98" width="24" height="16" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.5" />
          <path d="M118 104 l8 4 l-3 2 l8 4 l-6 2 l-4 -4 l-3 -2 l-4 2 z" fill={c.a} opacity="0.9" transform="translate(2,0)" />
          <rect x="150" y="60" width="34" height="22" rx="4" fill="#0d1226" stroke="#2a3552" strokeWidth="1.4" />
          <rect x="154" y="64" width="26" height="14" rx="2" fill="none" stroke={c.c} strokeWidth="1.4" />
          <circle cx="172" cy="58" r="3" fill="#f59e0b" />
          <path d="M154 82 l4 0 M170 82 l4 0" stroke="#3a4568" strokeWidth="3" strokeLinecap="round" />
        </g>
      );

    case "led-driver":
      return (
        <g>
          <rect x="46" y="56" width="74" height="28" rx="6" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="54" y="63" width="34" height="6" rx="2" fill="#2a3552" opacity="0.8" />
          <circle cx="108" cy="70" r="3" fill={c.a} opacity="0.95" />
          <line x1="128" y1="66" x2="150" y2="66" stroke="#2a3552" strokeWidth="3" strokeLinecap="round" />
          <line x1="128" y1="74" x2="150" y2="74" stroke="#2a3552" strokeWidth="3" strokeLinecap="round" />
          <rect x="148" y="58" width="18" height="30" rx="4" fill="#0d1226" stroke={c.a} strokeWidth="1.3" />
          {[0, 1, 2, 3].map(i => (
            <circle key={i} cx={157} cy={64 + i * 6} r="2.3" fill={i === 0 ? "#fff" : c.a} opacity={0.95} />
          ))}
          <polygon points="166,58 182,70 182,88 166,102" fill={`url(#${uid}beam)`} opacity="0.5" />
          <rect x="168" y="44" width="26" height="66" rx="5" fill="#0d1226" stroke="#2a3552" strokeWidth="1.2" />
          {[0, 1, 2, 3, 4].map(i => (
            <rect key={i} x="173" y={50 + i * 12} width="16" height="5" rx="2" fill={i % 2 ? c.a : c.c} opacity="0.8" />
          ))}
        </g>
      );

    case "adapter":
      return (
        <g>
          <rect x="66" y="44" width="72" height="58" rx="10" fill={`url(#${uid}body)`} stroke="#2a3552" strokeWidth="1.5" />
          <rect x="76" y="52" width="28" height="10" rx="3" fill="#0d1226" stroke={c.a} strokeWidth="1.2" />
          <rect x="84" y="54" width="10" height="6" rx="2" fill={c.a} opacity="0.4" />
          <circle cx="122" cy="70" r="4" fill={c.a} opacity="0.95" />
          <line x1="76" y1="72" x2="108" y2="72" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <line x1="76" y1="80" x2="104" y2="80" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <line x1="76" y1="88" x2="112" y2="88" stroke="#2a3552" strokeWidth="2" strokeLinecap="round" />
          <rect x="62" y="98" width="18" height="20" rx="3" fill="#0d1226" stroke={c.b} strokeWidth="1.4" />
          <rect x="70" y="102" width="3" height="12" rx="1.5" fill={c.b} opacity="0.9" />
          <rect x="124" y="98" width="18" height="20" rx="3" fill="#0d1226" stroke={c.b} strokeWidth="1.4" />
          <rect x="132" y="102" width="3" height="12" rx="1.5" fill={c.b} opacity="0.9" />
          <path d="M102 60 q22 -6 30 -16 q10 -12 -6 -14 q-12 -2 -24 8 q-8 6 -10 16" fill="none" stroke={c.c} strokeWidth="3" strokeLinecap="round" />
          <path d="M96 58 q20 -4 26 -12" fill="none" stroke={c.c} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
  }
}
