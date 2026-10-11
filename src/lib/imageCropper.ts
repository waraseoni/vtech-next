// Client-side crop util. `pixelCrop` original image ke coordinate space me
// (ReactCrop ka percent crop naturalWidth/Height se modal me convert hota hai).
// Output ≤ maxDim (long edge). JPEG default — visiting-card/product photos.
// Rotation display-level par hota hai (ImageCropperModal pre-rotate karke laata
// hai), isliye yahan sirf straight extraction + fit-scale hai.

export type Area = { width: number; height: number; x: number; y: number };

function readImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

// Crops `src` ko pixelCrop (original image space) ke hisaab se, aur fit karke
// output canvas me scale karta hai. Output ≤ maxDim (long edge).
export async function cropImage(
  src: string,
  pixelCrop: Area,
  maxDim = 1200,
  outMime = "image/jpeg"
): Promise<Blob> {
  const image = await readImage(src);

  // Defensive clamp: source rect kabhi image ke bahar nahi jana chahiye.
  const sx = Math.min(Math.max(0, Math.round(pixelCrop.x)), image.naturalWidth - 1);
  const sy = Math.min(Math.max(0, Math.round(pixelCrop.y)), image.naturalHeight - 1);
  const sw = Math.max(1, Math.min(Math.round(pixelCrop.width), image.naturalWidth - sx));
  const sh = Math.max(1, Math.min(Math.round(pixelCrop.height), image.naturalHeight - sy));

  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const outW = Math.max(1, Math.round(sw * scale));
  const outH = Math.max(1, Math.round(sh * scale));

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext("2d");
  if (!octx) throw new Error("Canvas not supported");
  octx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);

  return await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop export failed"))),
      outMime,
      0.92
    );
  });
}

// Source URL ka output mime decide karta hai. Transparent PNG ko JPEG me crop
// karne par alpha ud jata hai (black bg) — settings logo seedha save hota hai
// (compressImage nahi) isliye wahan dikkat dikhti hai. SVG cropper me aata hi
// nahi (caller skip karta hai). Unknown/failure = jpeg (purana behavior).
export async function sourceMime(src: string): Promise<string> {
  try {
    const res = await fetch(src);
    const type = res.headers.get("content-type") ?? "";
    return type === "image/png" ? "image/png" : "image/jpeg";
  } catch {
    return "image/jpeg";
  }
}

export async function urlToBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  return await res.blob();
}
