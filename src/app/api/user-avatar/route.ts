import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "user-avatars";

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

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
    if (buffer.byteLength > 200 * 1024) {
      return NextResponse.json({ status: "failed", msg: "Image > 200KB — compress karke dobara try karein" }, { status: 400 });
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

    const fileName = `${userId}-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", userId);

    return NextResponse.json({ status: "success", url: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
