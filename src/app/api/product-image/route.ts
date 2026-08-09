import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/api-auth";

// ─── Supabase Admin Client (service_role) ────────────────────────────────────
// IMPORTANT: service_role key sirf server-side use karo — client-side kabhi nahi
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "product-images";

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const productId = form.get("productId") as string | null;
    const deleteFlag = form.get("delete") === "1";

    if (!productId) {
      return NextResponse.json({ status: "failed", msg: "productId missing" }, { status: 400 });
    }

    // ── DELETE existing image ────────────────────────────────────────────────
    if (deleteFlag) {
      const { data: rows } = await supabase
        .from("product_list")
        .select("image_path")
        .eq("id", productId)
        .single();
      const old = rows?.image_path as string | null;
      if (old && old.includes(`/${BUCKET}/`)) {
        const oldName = old.split(`/${BUCKET}/`).pop();
        await supabase.storage.from(BUCKET).remove([oldName as string]);
      }
      await supabase.from("product_list").update({ image_path: null }).eq("id", productId);
      return NextResponse.json({ status: "success", msg: "Image removed", image_path: "" });
    }

    if (!file) {
      return NextResponse.json({ status: "failed", msg: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > 200 * 1024) {
      return NextResponse.json({ status: "failed", msg: "Image > 200KB — compress karke dobara try karein" }, { status: 400 });
    }

    // Delete old image first, then upload new (keep bucket clean)
    const { data: rows } = await supabase
      .from("product_list")
      .select("image_path")
      .eq("id", productId)
      .single();
    const old = rows?.image_path as string | null;
    if (old && old.includes(`/${BUCKET}/`)) {
      const oldName = old.split(`/${BUCKET}/`).pop();
      await supabase.storage.from(BUCKET).remove([oldName as string]);
    }

    const fileName = `${productId}-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    await supabase.from("product_list").update({ image_path: urlData.publicUrl }).eq("id", productId);

    return NextResponse.json({ status: "success", url: urlData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
