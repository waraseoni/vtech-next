// Image compression util — compresses an image file to ≤ MAX_BYTES via canvas.
// Runs fully client-side (browser), no server deps.

export const MAX_IMAGE_BYTES = 100 * 1024; // 100 KB hard cap

export type CompressedImage = {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

// Reads a file, draws it scaled to MAX_DIM, and exports JPEG at decreasing
// quality until it fits under MAX_BYTES.
export async function compressImage(file: File, maxDim = 800): Promise<CompressedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });

  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  // JPEG quality ladder — start high, step down until ≤100 KB.
  let quality = 0.85;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length * 0.75 > MAX_IMAGE_BYTES && quality > 0.35) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  // Fall back to WebP if JPEG still too big (widely supported).
  if (out.length * 0.75 > MAX_IMAGE_BYTES) {
    out = canvas.toDataURL("image/webp", 0.8);
  }

  const bytes = Math.round(out.length * 0.75);
  const ext = out.startsWith("data:image/webp") ? "webp" : "jpeg";
  const blob = await (await fetch(out)).blob();
  const finalFile = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, {
    type: blob.type,
  });

  return { file: finalFile, dataUrl: out, width, height, bytes };
}
