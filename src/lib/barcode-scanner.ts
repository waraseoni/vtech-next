"use client";

/**
 * Barcode scanner engine — native pehle, fallback html5-qrcode.
 *
 * Browser me `BarcodeDetector` ho (Chrome/Edge/Android WebView) to wahi use hota
 * hai: getUserMedia + `<video>` + detect loop. Isse ~250KB ka html5-qrcode
 * bundle load hi nahi hota. Jahan native API nahi hai (Safari/iOS, Firefox) wahan
 * purana html5-qrcode lazy-import hi chalta hai — behaviour same.
 *
 * Dono engine ka contract same hai: first successful read par scanner khud
 * band hota hai, phir `onScan(text)` call hota hai.
 */

/** Native API jo hum use karte hain (TS lib.dom me BarcodeDetector nahi hai). */
type DetectedBarcode = { rawValue?: string };
type NativeBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type NativeBarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** html5-qrcode ke format enums (fallback path) ke barabar native names. */
const NATIVE_FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
] as const;

/** Native detect loop ka interval — 10fps se zyada battery khaata hai. */
const DETECT_INTERVAL_MS = 120;

export type ScanEngine = "native" | "html5-qrcode";

export type ScannerHandle = {
  engine: ScanEngine;
  stop: () => Promise<void>;
};

export type StartScannerOptions = {
  /** Jis element ke andar camera render hoga (video ya html5-qrcode markup). */
  container: HTMLElement;
  onScan: (text: string) => void;
  /** Native API available na ho to fallback; fallback bhi fail ho to throw. */
  qrbox?: { width: number; height: number };
};

let autoId = 0;
function ensureId(el: HTMLElement): string {
  if (!el.id) el.id = `barcode-scanner-${++autoId}`;
  return el.id;
}

function getNativeCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor })
    .BarcodeDetector;
  return ctor ?? null;
}

/** Native detector banao — supported formats ke saath. Na ho to null. */
async function createNativeDetector(): Promise<NativeBarcodeDetector | null> {
  const ctor = getNativeCtor();
  if (!ctor) return null;
  try {
    let formats: string[] = [...NATIVE_FORMATS];
    if (typeof ctor.getSupportedFormats === "function") {
      const supported = await ctor.getSupportedFormats();
      formats = formats.filter((f) => supported.includes(f));
      // Koi bhi format support na ho to engine bekaar hai.
      if (formats.length === 0) return null;
    }
    return new ctor({ formats });
  } catch {
    // Purane Chrome me constructor unknown format par throw karta hai.
    return null;
  }
}

async function startNative(
  container: HTMLElement,
  onScan: (text: string) => void
): Promise<ScannerHandle | null> {
  const detector = await createNativeDetector();
  if (!detector) return null;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });

  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "true");
  video.muted = true;
  video.autoplay = true;
  video.style.width = "100%";
  video.style.display = "block";
  video.srcObject = stream;

  container.replaceChildren(video);

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
    video.remove();
  };

  /** detect loop — ek frame me ek hi detect call, warna queue ban jaati hai. */
  const tick = async () => {
    if (stopped) return;
    let hitText: string | null = null;
    try {
      if (video.readyState >= 2) {
        const results = await detector.detect(video);
        const hit = results.find((r) => r.rawValue && r.rawValue.trim());
        if (hit?.rawValue) hitText = hit.rawValue.trim();
      }
    } catch {
      /* frame decode fail — next tick par retry */
    }
    if (hitText) {
      // Pehle band, phir callback — parent turant unmount kar sakta hai.
      await stop();
      onScan(hitText);
      return;
    }
    if (!stopped) timer = setTimeout(tick, DETECT_INTERVAL_MS);
  };

  try {
    await video.play();
  } catch {
    /* autoplay block ho to bhi detection chal sakti hai */
  }
  timer = setTimeout(tick, DETECT_INTERVAL_MS);

  return { engine: "native", stop };
}

async function startHtml5Qrcode(
  container: HTMLElement,
  onScan: (text: string) => void,
  qrbox?: { width: number; height: number }
): Promise<ScannerHandle> {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

  const elementId = ensureId(container);
  // Purana markup (failed native attempt ke baad) clear karo — html5-qrcode
  // ko khali container chahiye.
  container.replaceChildren();

  const scanner = new Html5Qrcode(elementId, {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ],
    verbose: false,
  });

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear();
    } catch {
      /* element already gone */
    }
  };

  await scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: qrbox ?? { width: 230, height: 150 } },
    async (text) => {
      await stop();
      onScan(text);
    },
    () => {
      /* frame miss — ignore */
    }
  );

  return { engine: "html5-qrcode", stop };
}

/**
 * Camera scan start karo. Native `BarcodeDetector` available ho to wahi,
 * warna html5-qrcode fallback. Errors (permission/CCTV busy) throw hote hain —
 * caller `cameraErrorMessage(err)` se user-friendly text banata hai.
 */
export async function startBarcodeScanner({
  container,
  onScan,
  qrbox,
}: StartScannerOptions): Promise<ScannerHandle> {
  const native = await startNative(container, onScan).catch((err) => {
    // getUserMedia errors (permission denied etc.) fallback se theek nahi honge
    // — seedha caller ko do. Sirf "native API not usable" case null deta hai.
    if (
      err instanceof Error &&
      err.name &&
      /NotAllowed|NotFound|NotReadable|SecurityError/.test(err.name)
    ) {
      throw err;
    }
    return null;
  });
  if (native) return native;
  return await startHtml5Qrcode(container, onScan, qrbox);
}

/** Kya native engine milega? (UI copy / debug ke liye — camera start nahi karta.) */
export async function hasNativeBarcodeDetector(): Promise<boolean> {
  return (await createNativeDetector()) !== null;
}
