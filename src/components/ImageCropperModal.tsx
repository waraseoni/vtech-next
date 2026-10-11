import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, RotateCcw, RotateCw, RefreshCcw, Scissors, Check } from "lucide-react";
import { cropImage, sourceMime } from "@/lib/imageCropper";

type ImageCropperModalProps = {
  open: boolean;
  src: string;
  title?: string;
  aspect?: number; // undefined = free caller (ratio presets dikhao)
  maxDim?: number;
  onCancel: () => void;
  // blob = cropped result; null = "original kaise hai waise rakho"
  onConfirm: (blob: Blob | null) => void;
};

type CropSessionProps = Omit<ImageCropperModalProps, "open">;

// ReactCrop ko hamesha percent crop state chahiye — output natural px me
// nikalte hain (imgDims se convert), warna display-scaling pe galat cut jayega.
const emptyCrop: PercentCrop = { x: 0, y: 0, width: 0, height: 0, unit: "%" };

const RATIOS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

// Display ke liye 90°-step rotation. react-easy-crop rotation virtuously
// dikhata tha; ReactCrop ko rotate karne ke liye src hi naya banao (canvas),
// phir wahi src cropImage ko jayega (rotation param nahi bachega). Mime
// source se pass hota hai — beech me JPEG karne se PNG ka alpha ud jata.
async function rotateSrc(src: string, deg: 90 | -90, mime: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.98));
  if (!blob) throw new Error("Rotate fail");
  return URL.createObjectURL(blob);
}

function defaultCrop(w: number, h: number, ratio?: number): PercentCrop {
  if (ratio) {
    return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, ratio, w, h), w, h);
  }
  return centerCrop({ unit: "%", x: 0, y: 0, width: 90, height: 90 }, w, h);
}

export default function ImageCropperModal({
  open,
  src,
  title,
  aspect,
  maxDim = 1200,
  onCancel,
  onConfirm,
}: ImageCropperModalProps) {
  if (!open) return null;
  // src change = naya session (state/rotated URLs fresh); close par session
  // unmount hota hai isliye manual reset ki zaroorat nahi.
  return (
    <CropSession
      key={src}
      src={src}
      title={title}
      aspect={aspect}
      maxDim={maxDim}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function CropSession({ src, title, aspect, maxDim = 1200, onCancel, onConfirm }: CropSessionProps) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [crop, setCrop] = useState<PercentCrop>(emptyCrop);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [freeAspect, setFreeAspect] = useState(false);
  const [preset, setPreset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [err, setErr] = useState("");
  const genUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (genUrlRef.current) URL.revokeObjectURL(genUrlRef.current);
    },
    []
  );

  const frozen = busy || rotating;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !frozen) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frozen, onCancel]);

  const activeAspect =
    aspect !== undefined ? (freeAspect ? undefined : aspect) : (preset ?? undefined);

  const onImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setImgDims({ w, h });
    setCrop(defaultCrop(w, h, activeAspect));
  };

  // Current selection ki width se naya ratio apply (clamped + re-centered).
  const applyAspect = (ratio: number) => {
    if (!imgDims) return;
    const { w, h } = imgDims;
    setCrop(centerCrop(makeAspectCrop({ unit: "%", width: crop.width || 90 }, ratio, w, h), w, h));
  };

  const applyPreset = (value: number | null) => {
    setPreset(value);
    if (value != null) applyAspect(value);
  };

  const goFixed = () => {
    setFreeAspect(false);
    if (aspect) applyAspect(aspect);
  };

  const handleRotate = async (deg: 90 | -90) => {
    if (frozen) return;
    setRotating(true);
    setErr("");
    try {
      const mime = await sourceMime(displaySrc);
      const next = await rotateSrc(displaySrc, deg, mime);
      if (genUrlRef.current) URL.revokeObjectURL(genUrlRef.current);
      genUrlRef.current = next;
      // Naya src load hote hi default crop onImageLoad me set hoga.
      setImgDims(null);
      setCrop(emptyCrop);
      setDisplaySrc(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rotate fail");
    } finally {
      setRotating(false);
    }
  };

  const handleReset = () => {
    if (frozen) return;
    if (genUrlRef.current) {
      URL.revokeObjectURL(genUrlRef.current);
      genUrlRef.current = null;
    }
    setErr("");
    setFreeAspect(false);
    setPreset(null);
    setImgDims(null);
    setCrop(emptyCrop);
    setDisplaySrc(src); // session original — onLoad default crop dobara set karega
  };

  const handleConfirm = async () => {
    if (!imgDims || frozen || !crop.width || !crop.height) return;
    setBusy(true);
    setErr("");
    try {
      const { w, h } = imgDims;
      // Percent → natural px, image bounds ke andar clamped.
      const sx = Math.min(Math.round((crop.x / 100) * w), w - 1);
      const sy = Math.min(Math.round((crop.y / 100) * h), h - 1);
      const sw = Math.max(1, Math.min(Math.round((crop.width / 100) * w), w - sx));
      const sh = Math.max(1, Math.min(Math.round((crop.height / 100) * h), h - sy));
      const mime = await sourceMime(displaySrc);
      const blob = await cropImage(
        displaySrc,
        { x: sx, y: sy, width: sw, height: sh },
        maxDim,
        mime
      );
      onConfirm(blob);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Crop fail");
      setBusy(false);
    }
  };

  const sizeLabel =
    imgDims && crop.width > 0 && crop.height > 0
      ? `${Math.round((imgDims.w * crop.width) / 100)} × ${Math.round(
          (imgDims.h * crop.height) / 100
        )} px`
      : null;

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
          onClick={onCancel}
          disabled={frozen}
          className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Cropper — 8 handles (4 corner + 4 edge), keyboard accessible */}
      <div
        className="relative flex-1 min-h-0 bg-black overflow-hidden flex items-center justify-center p-6"
        style={
          {
            "--rc-drag-handle-size": "16px",
            "--rc-drag-handle-mobile-size": "44px",
          } as CSSProperties
        }
      >
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          aspect={activeAspect}
          minWidth={40}
          minHeight={40}
          ruleOfThirds
          disabled={frozen}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt="Crop photo"
            onLoad={onImageLoad}
            className="block max-h-[55vh] max-w-full object-contain select-none"
          />
        </ReactCrop>
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
            onClick={() => void handleRotate(-90)}
            disabled={frozen}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {rotating ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}{" "}
            Rotate
          </button>
          <button
            type="button"
            onClick={() => void handleRotate(90)}
            disabled={frozen}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RotateCw size={14} /> Rotate
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={frozen}
            className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={14} /> Reset
          </button>
          {sizeLabel && (
            <span className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-muted tabular-nums">
              {sizeLabel}
            </span>
          )}
        </div>

        {aspect !== undefined ? (
          <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-wider">
            <span>Crop Area</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={goFixed}
                disabled={frozen}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  !freeAspect ? "bg-blue-600 text-white" : "bg-white/5 text-muted hover:text-white"
                }`}
              >
                Fixed
              </button>
              <button
                type="button"
                onClick={() => setFreeAspect(true)}
                disabled={frozen}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                  freeAspect ? "bg-blue-600 text-white" : "bg-white/5 text-muted hover:text-white"
                }`}
              >
                Free
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-muted uppercase tracking-wider">
            <span>Ratio</span>
            <div className="flex gap-1">
              {RATIOS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => applyPreset(r.value)}
                  disabled={frozen}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                    preset === r.value
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-muted hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={frozen}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-app-2 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(null)}
            disabled={frozen}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Original rakho
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={frozen || !crop.width || !imgDims}
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
