import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function upsertField(field: string, value: string) {
  const { data: existing } = await supabase
    .from("system_info")
    .select("id")
    .eq("meta_field", field)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("system_info").update({ meta_value: value }).eq("meta_field", field);
  } else {
    await supabase.from("system_info").insert({ meta_field: field, meta_value: value });
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const canvasData = form.get("canvasData") as string | null;
    const deleteFlag = form.get("delete") === "1";

    if (deleteFlag) {
      await upsertField("signature", "");
      return NextResponse.json({ status: "success", msg: "Signature removed" });
    }

    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `signature.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(fileName, buffer, { upsert: true, contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(fileName);
      await upsertField("signature", urlData.publicUrl);
      return NextResponse.json({ status: "success", url: urlData.publicUrl });
    }

    if (canvasData) {
      await upsertField("signature", canvasData);
      return NextResponse.json({ status: "success", url: canvasData });
    }

    return NextResponse.json({ status: "failed", msg: "No file or canvas data provided" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "failed", msg }, { status: 500 });
  }
}
