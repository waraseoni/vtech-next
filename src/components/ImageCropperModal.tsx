import { useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { X, RotateCcw, RotateCw, ZoomIn, ZoomOut, Scissors, Check } from "lucide-react";
import type { Area, Point } from "react-easy-crop";
import { cropImage } from "@/lib/imageCropper";

type ImageCropperModalProps = {
  open: boolean;
  src: string;
  title?: string;
  aspect?: number; // undefined = free (koi toggle nahi)
  maxDim?: number;
  onCancel: () => void;
  // blob = cropped result; null = "original kaise hai waise rakho"
  onConfirm: (blob: Blob | null) => void;
};

export default function ImageCropperModal({
  open,
  src,
  title,
  aspect,
  maxDim = 1200,
  onCancel,
  onConfirm,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [freeAspect, setFreeAspect] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cropReady, setCropReady] = useState(false);
  const [err, setErr] = useState("");
  const areaRef = useRef<Area | null>(null);

  if (!open) return null;

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFreeAspect(false);
    setBusy(false);
    setCropReady(false);
    setErr("");
    areaRef.current = null;
  };

  const handleConfirm = async () => {
    if (!areaRef.current) return;
    setBusy(true);
    setErr("");
    try {
      const blob = await cropImage(src, areaRef.current, rotation, maxDim);
      reset();
      onConfirm(blob);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Crop fail");
      setBusy(false);
    }
  };

  const handleAsIs = () => {
    reset();
    onConfirm(null);
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Scissors size={15} className="text-blue-400" />
          {title || "Crop Photo"}
        </h3>
        <button
          type="button"
          onClick={() => {
            reset();
            onCancel();
          }}
          disabled={busy}
          className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Cropper */}
      <div className="relative flex-1 min-h-0 bg-black">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          minZoom={1}
          maxZoom={4}
          zoomSpeed={1.2}
          aspect={aspect && !freeAspect ? aspect : 0}
          showGrid
          style={{ containerStyle: { background: "#000" } }}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, area) => {
            areaRef.current = area;
            setCropReady(true);
          }}
        />
      </div>

      {/* Controls */}
      <div className="p-4 bg-panel border-t border-app space-y-3">
        {err && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
            {err}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            disabled={busy}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} /> Rotate
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={busy}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RotateCw size={14} /> Rotate
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            disabled={busy}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <ZoomIn size={14} /> Zoom+
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            disabled={busy}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <ZoomOut size={14} /> Zoom−
          </button>
        </div>

        {aspect && (
          <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-wider">
            <span>Crop Area</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setFreeAspect(false)}
                disabled={busy}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  !freeAspect
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-muted hover:text-white"
                }`}
              >
                Fixed
              </button>
              <button
                type="button"
                onClick={() => setFreeAspect(true)}
                disabled={busy}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  freeAspect
                    ? "bg-blue-600 text-white"
                    : "bg-white/5 text-muted hover:text-white"
                }`}
              >
                Free
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              onCancel();
            }}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-app-2 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAsIs}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            Original rakho
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !cropReady}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check size={15} /> Crop Karo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
