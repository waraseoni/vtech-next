import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaffWriter } from "@/lib/api-auth";
import { validateImageBuffer } from "@/lib/image-upload";
import { logger } from "@/lib/logger";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = getAdminSupabase();

const BUCKET = "supplier-photos";

export async function POST(request: NextRequest) {
  try {
    // Staff + office ke bahar + permit nahi → block. Ye route service_role se
    // storage likhta hai, isliye RLS par depend karna safe nahi tha.
    const session = await requireStaffWriter(request);
    if (session instanceof NextResponse) return session;
    if (!session)
      return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const supplierId = form.get("supplierId") as string | null;
    const deleteFlag = form.get("delete") === "1";

    if (!supplierId) {
      return NextResponse.json({ status: "failed", msg: "supplierId missing" }, { status: 400 });
    }

    // ── DELETE existing image ────────────────────────────────────────────────
    if (deleteFlag) {
      const { data: rows } = await supabase
        .from("suppliers")
        .select("photo_url")
        .eq("id", supplierId)
        .single();
      const old = rows?.photo_url as string | null;
      if (old && old.includes(`/${BUCKET}/`)) {
        const oldName = old.split(`/${BUCKET}/`).pop();
        await supabase.storage.from(BUCKET).remove([oldName as string]);
      }
      await supabase.from("suppliers").update({ photo_url: "" }).eq("id", supplierId);
      return NextResponse.json({ status: "success", msg: "Image removed", photo_url: "" });
    }

    if (!file) {
      return NextResponse.json({ status: "failed", msg: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const check = validateImageBuffer(buffer);
    if (!check.ok) {
      return NextResponse.json({ status: "failed", msg: check.error }, { status: 400 });
    }

    // Delete old image first, then upload new (keep bucket clean)
    const { data: rows } = await supabase
      .from("suppliers")
      .select("photo_url")
      .eq("id", supplierId)
      .single();
    const old = rows?.photo_url as string | null;
    if (old && old.includes(`/${BUCKET}/`)) {
      const oldName = old.split(`/${BUCKET}/`).pop();
      await supabase.storage.from(BUCKET).remove([oldName as string]);
    }

    const fileName = `supplier-${supplierId}-${Date.now()}.${check.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { upsert: true, contentType: check.mime });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    await supabase
      .from("suppliers")
      .update({ photo_url: urlData.publicUrl, date_updated: new Date().toISOString() })
      .eq("id", supplierId);

    return NextResponse.json({ status: "success", url: urlData.publicUrl });
  } catch (err: unknown) {
    logger.error("supplier-photo upload failed:", err);
    return NextResponse.json(
      { status: "failed", msg: "Photo upload fail hua — dobara try karein" },
      { status: 500 }
    );
  }
}
