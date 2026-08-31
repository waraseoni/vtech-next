import { supabase } from "@/lib/supabase";

// ─── Media share helpers ────────────────────────────────────────────────────
// Images ko CLIENT side par hi compress karke upload karte hain, taaki server
// (Storage) par jyada space na le — target ~50-100KB max. Non-image files par
// sirf size check + upload (compress possible nahi).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 100 * 1024; // ~100KB target ceiling
const MAX_IMAGE_SIDE = 1024; // max side px (phone screens ke liye kaafi)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // non-image file cap (5MB)

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
};

// image file → canvas resize + quality loop → ~100KB ke andar JPEG/WebP blob.
// JPG ekdam standard hai; WebP zyada compress deta hai par har jagah render nahi
// hota. Isliye JPEG default — ~100KB me acchi quality wali 1024px image aati hai.
async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  const { width: w, height: h } = bitmap;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, nw, nh);
  bitmap.close();

  // quality ko kam karte hue tab tak chhota karo jab tak 100KB ke andar aa jaye
  let quality = 0.8;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_IMAGE_SIZE && quality > 0.35) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, quality);
  }
  return { blob, width: nw, height: nh };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
}

export async function randomSuffix(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}`;
}

// File → upload → storage path. `url` = storage path (messages.media_url me
// yahi jaata hai) — delete ke liye path chahiye hota hai. Display ke liye
// `mediaPublicUrl(path)` use karo.
export async function uploadMedia(
  file: File,
  folderPath: string
): Promise<{
  url: string;
  path: string;
  type: string;
  name: string;
}> {
  const isImage = file.type.startsWith("image/") && file.type !== "image/svg+xml";
  let uploadFile: File;
  let type = file.type;
  let name = file.name;

  if (isImage) {
    const compressed = await compressImage(file);
    type = "image/jpeg";
    name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    uploadFile = new File([compressed.blob], name, { type });
  } else {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File 5MB se bada hai — chhota file select karo");
    }
    uploadFile = file;
  }

  const suffix = await randomSuffix();
  const path = `${folderPath}/${suffix}-${name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await supabase.storage.from("media").upload(path, uploadFile, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return { url: path, path, type, name };
}

export function mediaPublicUrl(path: string): string {
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// Storage me se media object delete. Service_role server route se karte hain
// (client RLS quirk se kabhi file bucket me orphan pad jati thi). @/lib/media
// client me hai, isliye fetch se API hit karte hain.
export async function deleteMedia(path: string): Promise<void> {
  const res = await fetch("/api/media/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: [path] }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string; msg?: string }).error || (json as { msg?: string }).msg || "Media delete fail hua");
  }
}
