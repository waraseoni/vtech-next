import { NextResponse } from "next/server";
import os from "node:os";

// Dev helper: returns the machine's LAN IPv4 so the dashboard QR code can point
// at an address phones on the same WiFi can actually reach (instead of localhost).
// In production this is meaningless (returns null) — the QR then uses the domain.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ lanIp: null });
  }
  const candidates: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list ?? []) {
      if (!net.internal && String(net.family) === "IPv4") {
        candidates.push(net.address);
      }
    }
  }
  // Prefer the usual home/office 192.168.x.x range, else any LAN IPv4
  const lanIp = candidates.sort((a, b) =>
    a.startsWith("192.168.") ? -1 : b.startsWith("192.168.") ? 1 : 0
  )[0] ?? null;
  return NextResponse.json({ lanIp });
}
