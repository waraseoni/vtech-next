import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaff } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
const supabase = getAdminSupabase();

const BUCKET = "spare-photos";

// Required-spare photo upload/delete. URL caller set karta hai
// `job_required_parts.photo_url` par (M2 lib se). DB row nahi banate.
export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user)
      return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

    const form = await request.formData();
    const action = form.get("action") as string | null; // "upload" | "delete"

    if (action === "delete") {
      const imagePath = form.get("imagePath") as string | null;
      if (!imagePath)
        return NextResponse.json({ status: "failed", msg: "imagePath missing" }, { status: 400 });
      if (imagePath.includes(`/${BUCKET}/`)) {
        const name = imagePath.split(`/${BUCKET}/`).pop() as string;
        await supabase.storage.from(BUCKET).remove([name]);
      }
      return NextResponse.json({ status: "success", msg: "Image removed" });
    }

    const file = form.get("file") as File | null;
    if (!file)
      return NextResponse.json({ status: "failed", msg: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > 200 * 1024) {
      return NextResponse.json(
        { status: "failed", msg: `${file.name} > 200KB — compress karke dobara try karein` },
        { status: 400 }
      );
    }
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop() || "jpg"}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { upsert: true, contentType: file.type });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return NextResponse.json({ status: "success", url: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
