import { useCallback, useEffect, useRef, useState } from "react";
import ImageCropperModal from "@/components/ImageCropperModal";

// Pick → crop modal → compressed-worthy File flow. UI components openCropper
// se pick kiye file ko crop editor me le jaate hain aur cropped file (ya
// original "as-is") resolve karte hain. Cancel → null (matlab kuch mat karo).

export type CropOptions = {
  aspect?: number; // undefined = free
  title?: string;
  maxDim?: number;
};

type Pending = {
  src: string;
  aspect?: number;
  title?: string;
  maxDim?: number;
};

export function useImageUpload() {
  const [pending, setPending] = useState<Pending | null>(null);
  const fileRef = useRef<File | null>(null);
  const srcRef = useRef<string | null>(null);
  const resolverRef = useRef<((f: File | null) => void) | null>(null);

  const dismiss = useCallback((result: File | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (srcRef.current?.startsWith("blob:")) URL.revokeObjectURL(srcRef.current);
    srcRef.current = null;
    fileRef.current = null;
    setPending(null);
    resolve?.(result);
  }, []);

  const openCropper = useCallback((file: File, opts?: CropOptions) => {
    // Pichla session active ho toh pehle band karo (stale modal kabhi na chhute).
    if (resolverRef.current) {
      const stale = resolverRef.current;
      resolverRef.current = null;
      stale(null);
    }
    if (srcRef.current?.startsWith("blob:")) URL.revokeObjectURL(srcRef.current);
    fileRef.current = file;
    const src = URL.createObjectURL(file);
    srcRef.current = src;
    setPending({ src, aspect: opts?.aspect, title: opts?.title, maxDim: opts?.maxDim });
    return new Promise<File | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleCancel = useCallback(() => dismiss(null), [dismiss]);

  const handleConfirm = useCallback(
    (blob: Blob | null) => {
      const base = fileRef.current;
      let result: File | null = null;
      if (blob) {
        const ext = blob.type === "image/png" ? "png" : "jpg";
        const name = (base?.name.replace(/\.[^.]+$/, "") || "crop") + "-crop." + ext;
        result = new File([blob], name, { type: blob.type });
      } else if (base) {
        result = base; // "Original rakho" — waise hi bhej do
      }
      dismiss(result);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(null);
        resolverRef.current = null;
      }
      if (srcRef.current?.startsWith("blob:")) URL.revokeObjectURL(srcRef.current);
      srcRef.current = null;
    };
  }, []);

  const cropperEl = pending ? (
    <ImageCropperModal
      open
      src={pending.src}
      title={pending.title}
      aspect={pending.aspect}
      maxDim={pending.maxDim}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  ) : null;

  return { openCropper, cropperEl };
}
