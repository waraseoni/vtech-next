import type { Area } from "react-easy-crop";

// Client-side crop + rotate util. react-easy-crop ka `onCropComplete` cropped
// area original image ke coordinate space me deta hai; 90°-steps (0/90/180/270)
// me rotated bbox se sabse safe extraction ke liye official approach replicate
// karte hain: pehle rotated bounding-box canvas banao, phir wahi crop rect
// output canvas me draw karo.

function readImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

function getRadianAngle(deg: number): number {
  return (deg * Math.PI) / 180;
}

function rotateSize(w: number, h: number, rotation: number): { width: number; height: number } {
  const rad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h),
    height: Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h),
  };
}

// Crops `src` ko pixelCrop (original image space) + `rotation` (90° steps) ke
// hisaab se, aur fit karke output canvas me scale karta hai. Output ≤ maxDim
// (long edge). JPEG default — visiting-card/product photos ke liye best.
export async function cropImage(
  src: string,
  pixelCrop: Area,
  rotation = 0,
  maxDim = 1200,
  outMime = "image/jpeg"
): Promise<Blob> {
  const image = await readImage(src);
  const rotRad = getRadianAngle(rotation % 360);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation % 360
  );

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = Math.round(bBoxWidth);
  rotatedCanvas.height = Math.round(bBoxHeight);
  const rctx = rotatedCanvas.getContext("2d");
  if (!rctx) throw new Error("Canvas not supported");

  rctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
  rctx.rotate(rotRad);
  rctx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  rctx.drawImage(image, 0, 0);

  // Output dims: pixelCrop se aage nahi badhna, long edge maxDim ke andar.
  const scale = Math.min(1, maxDim / Math.max(pixelCrop.width, pixelCrop.height));
  const outW = Math.max(1, Math.round(pixelCrop.width * scale));
  const outH = Math.max(1, Math.round(pixelCrop.height * scale));

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const octx = outCanvas.getContext("2d");
  if (!octx) throw new Error("Canvas not supported");
  octx.drawImage(
    rotatedCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  );

  return await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop export failed"))),
      outMime,
      0.92
    );
  });
}

export async function urlToBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  return await res.blob();
}
