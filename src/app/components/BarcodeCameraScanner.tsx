"use client";
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  isCameraSupported,
  cameraUnsupportedReason,
  cameraErrorMessage,
} from "@/lib/cameraSupport";

let scannerIdCounter = 0;

/**
 * Inline phone-camera barcode scanner box.
 * Mount karo to camera start, unmount to stop. First successful read → onScan(text).
 * Parent visibility control karta hai (conditional render).
 */
export default function BarcodeCameraScanner({ onScan }: { onScan: (text: string) => void }) {
  const [camErr, setCamErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const didScan = useRef(false);
  const [elementId] = useState(() => `barcode-scanner-${++scannerIdCounter}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isCameraSupported()) {
          setStarting(false);
          setCamErr(cameraUnsupportedReason());
          return;
        }
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelled) return;
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
        scannerRef.current = scanner;
        setStarting(false);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 140 } },
          async (text) => {
            if (didScan.current) return;
            didScan.current = true;
            try {
              await scanner.stop();
            } catch {
              /* ignore */
            }
            scanner.clear();
            onScan(text);
          },
          () => {
            /* frame miss */
          }
        );
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setCamErr(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        try {
          void s.stop().catch(() => {});
        } catch {
          /* ignore */
        }
        try {
          s.clear();
        } catch {
          /* ignore */
        }
      }
    };
  }, [elementId, onScan]);

  return (
    <div className="rounded-xl overflow-hidden border border-[#21293d] bg-black relative">
      <div id={elementId} ref={boxRef} className="w-full" />
      {starting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={22} className="animate-spin text-slate-400" />
        </div>
      )}
      {!camErr && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-1.5 text-center pointer-events-none">
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
            Barcode / QR ko camera me laayen
          </p>
        </div>
      )}
      {camErr && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111520]/95 px-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400 text-xs font-bold">{camErr}</p>
          </div>
        </div>
      )}
    </div>
  );
}
