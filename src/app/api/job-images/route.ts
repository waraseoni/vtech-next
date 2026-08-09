import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "job-images";

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

    const form = await request.formData();
    const action = form.get("action") as string | null; // "upload" | "delete"
    const transactionId = form.get("transactionId") as string | null;
    if (!transactionId) {
      return NextResponse.json({ status: "failed", msg: "transactionId missing" }, { status: 400 });
    }

    // ── DELETE one image ─────────────────────────────────────────────────────
    if (action === "delete") {
      const imageId = form.get("imageId") as string | null;
      const imagePath = form.get("imagePath") as string | null;
      if (!imageId || !imagePath) {
        return NextResponse.json({ status: "failed", msg: "imageId/imagePath missing" }, { status: 400 });
      }
      if (imagePath.includes(`/${BUCKET}/`)) {
        const name = imagePath.split(`/${BUCKET}/`).pop() as string;
        await supabase.storage.from(BUCKET).remove([name]);
      }
      await supabase.from("transaction_images").delete().eq("id", Number(imageId));
      return NextResponse.json({ status: "success", msg: "Image removed" });
    }

    // ── UPLOAD (single or multiple) ──────────────────────────────────────────
    const files = form.getAll("files") as File[];
    if (files.length === 0) {
      return NextResponse.json({ status: "failed", msg: "No files provided" }, { status: 400 });
    }

    const uploaded: { id: number; transaction_id: number; image_path: string; date_created: string }[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > 200 * 1024) {
        return NextResponse.json({ status: "failed", msg: `${file.name} > 200KB — compress karke dobara try karein` }, { status: 400 });
      }
      const fileName = `${transactionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop() || "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      const { data: inserted, error: insErr } = await supabase
        .from("transaction_images")
        .insert({ transaction_id: Number(transactionId), image_path: urlData.publicUrl })
        .select("id, transaction_id, image_path, date_created")
        .single();
      if (insErr) throw new Error(insErr.message);
      uploaded.push(inserted as { id: number; transaction_id: number; image_path: string; date_created: string });
    }

    return NextResponse.json({ status: "success", uploaded });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
