// ─── Inventory location helpers ("Spare Finder") ───────────────────────────
// Har stock-in row par 4 structured fields hote hain:
//   zone ▸ rack ▸ bin ▸ box   (e.g. "Main Shop" ▸ "Rack 1" ▸ "Bin 3" ▸ "Box B2")
// `place` (legacy free-text column) ko derived rakha jata hai = path string,
// taaki purani screens (list, history, dashboard) bina change ke kaam karein.
//
// QR label format (shelf labels ke liye): "VTECH-LOC:<zone>|<rack>|<bin>|<box>"
// — product barcode nahi, sirf location token. Scanner/Spare Finder ise decode
// karke us location ka tree khota hai.

export interface LocationParts {
  zone: string;
  rack: string;
  bin: string;
  box: string;
}

export type LocationRow = {
  zone?: string | null;
  rack?: string | null;
  bin?: string | null;
  box?: string | null;
  place_zone?: string | null;
  place_rack?: string | null;
  place_bin?: string | null;
  place_box?: string | null;
  place?: string | null;
};

export const EMPTY_LOCATION: LocationParts = { zone: "", rack: "", bin: "", box: "" };

export const LOC_TOKEN_PREFIX = "VTECH-LOC:";

/** Each part ko trim karta hai. */
export const normalizePart = (s?: string | null): string => (s || "").trim();

/** Row ya parts se LocationParts banao (missing → empty). */
export const partsFrom = (p?: Partial<LocationParts> | null): LocationParts => ({
  zone: normalizePart(p?.zone),
  rack: normalizePart(p?.rack),
  bin: normalizePart(p?.bin),
  box: normalizePart(p?.box),
});

/** Koi bhi structured part set hai ya nahi. */
export const hasParts = (p?: Partial<LocationParts> | null): boolean =>
  partsFrom(p).zone !== "" ||
  partsFrom(p).rack !== "" ||
  partsFrom(p).bin !== "" ||
  partsFrom(p).box !== "";

/** "Zone ▸ Rack ▸ Bin ▸ Box" — khali parts skip. Empty ho to "" return. */
export const locPath = (p?: Partial<LocationParts> | null): string => {
  const f = partsFrom(p);
  return [f.zone, f.rack, f.bin, f.box].filter(Boolean).join(" ▸ ");
};

/** Compact form: sirf last 2 levels (bin ▸ box) agar hain, warna poori path. */
export const locPathShort = (p?: Partial<LocationParts> | null): string => {
  const f = partsFrom(p);
  const last = [f.bin, f.box].filter(Boolean).join(" ▸ ");
  if (last) return last;
  return [f.zone, f.rack].filter(Boolean).join(" ▸ ");
};

/** Do parts ko compare (trim ignore karke). */
export const sameLoc = (
  a?: Partial<LocationParts> | null,
  b?: Partial<LocationParts> | null
): boolean => {
  const A = partsFrom(a);
  const B = partsFrom(b);
  return A.zone === B.zone && A.rack === B.rack && A.bin === B.bin && A.box === B.box;
};

/** QR label ka token: VTECH-LOC:zone|rack|bin|box (URI-encoded). */
export const encodeLocationToken = (p?: Partial<LocationParts> | null): string => {
  const f = partsFrom(p);
  return LOC_TOKEN_PREFIX + [f.zone, f.rack, f.bin, f.box].map(encodeURIComponent).join("|");
};

/** Token ko wapas parts me decode. Galat/unknown → null. */
export const decodeLocationToken = (raw: string): LocationParts | null => {
  const s = (raw || "").trim();
  if (!s.startsWith(LOC_TOKEN_PREFIX)) return null;
  const body = s.slice(LOC_TOKEN_PREFIX.length);
  const [zone, rack, bin, box] = body.split("|");
  try {
    return {
      zone: zone ? decodeURIComponent(zone) : "",
      rack: rack ? decodeURIComponent(rack) : "",
      bin: bin ? decodeURIComponent(bin) : "",
      box: box ? decodeURIComponent(box) : "",
    };
  } catch {
    return null;
  }
};

/** Row (inventory_list se) → LocationParts. Legacy rows me sirf place ho to zone me. */
export const partsFromRow = (row: LocationRow): LocationParts => {
  const structured = partsFrom({
    zone: row.place_zone ?? row.zone ?? undefined,
    rack: row.place_rack ?? row.rack ?? undefined,
    bin: row.place_bin ?? row.bin ?? undefined,
    box: row.place_box ?? row.box ?? undefined,
  });
  if (hasParts(structured)) return structured;
  const legacy = normalizePart(row.place);
  if (legacy) return { ...EMPTY_LOCATION, zone: legacy };
  return EMPTY_LOCATION;
};
