import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaffWriter } from "@/lib/api-auth";
import { validateImageBuffer } from "@/lib/image-upload";
import { logger } from "@/lib/logger";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = getAdminSupabase();

const BUCKET = "user-avatars";

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
    const userId = form.get("userId") as string | null;
    const deleteFlag = form.get("delete") === "1";

    if (!userId) {
      return NextResponse.json({ status: "failed", msg: "userId missing" }, { status: 400 });
    }

    // ── DELETE existing avatar ───────────────────────────────────────────────
    if (deleteFlag) {
      const { data: rows } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();
      const old = rows?.avatar_url as string | null;
      if (old && old.includes(`/${BUCKET}/`)) {
        const oldName = old.split(`/${BUCKET}/`).pop();
        await supabase.storage.from(BUCKET).remove([oldName as string]);
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      return NextResponse.json({ status: "success", msg: "Avatar removed", avatar_url: "" });
    }

    if (!file) {
      return NextResponse.json({ status: "failed", msg: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const check = validateImageBuffer(buffer);
    if (!check.ok) {
      return NextResponse.json({ status: "failed", msg: check.error }, { status: 400 });
    }

    // Delete old avatar first, then upload new (keep bucket clean)
    const { data: rows } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .single();
    const old = rows?.avatar_url as string | null;
    if (old && old.includes(`/${BUCKET}/`)) {
      const oldName = old.split(`/${BUCKET}/`).pop();
      await supabase.storage.from(BUCKET).remove([oldName as string]);
    }

    const fileName = `${userId}-${Date.now()}.${check.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { upsert: true, contentType: check.mime });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);

    return NextResponse.json({ status: "success", url: urlData.publicUrl });
  } catch (err: unknown) {
    logger.error("user-avatar upload failed:", err);
    return NextResponse.json(
      { status: "failed", msg: "Avatar upload fail hua — dobara try karein" },
      { status: 500 }
    );
  }
}
