"use client";
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  isCameraSupported,
  cameraUnsupportedReason,
  cameraErrorMessage,
} from "@/lib/cameraSupport";
import { startBarcodeScanner, type ScannerHandle } from "@/lib/barcode-scanner";

/**
 * Inline phone-camera barcode scanner box.
 * Mount karo to camera start, unmount to stop. First successful read → onScan(text).
 * Parent visibility control karta hai (conditional render).
 *
 * Engine: native `BarcodeDetector` pehle, warna html5-qrcode fallback
 * (`src/lib/barcode-scanner.ts`).
 */
export default function BarcodeCameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const [camErr, setCamErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isCameraSupported()) {
          setStarting(false);
          setCamErr(cameraUnsupportedReason());
          return;
        }
        const container = boxRef.current;
        if (!container) return;

        const handle = await startBarcodeScanner({
          container,
          qrbox: { width: 220, height: 140 },
          onScan,
        });
        // Unmount race: camera start hone se pehle hi component gaya.
        if (cancelled) {
          await handle.stop();
          return;
        }
        scannerRef.current = handle;
        setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setCamErr(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) void s.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="rounded-xl overflow-hidden border border-app bg-black relative">
      <div ref={boxRef} className="w-full" />
      {starting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={22} className="animate-spin text-muted" />
        </div>
      )}
      {!camErr && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-1.5 text-center pointer-events-none">
          <p className="text-[9px] font-bold text-app-2 uppercase tracking-widest">
            Barcode / QR ko camera me laayen
          </p>
        </div>
      )}
      {camErr && (
        <div className="absolute inset-0 flex items-center justify-center bg-panel-2/95 px-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400 text-xs font-bold">{camErr}</p>
          </div>
        </div>
      )}
    </div>
  );
}
