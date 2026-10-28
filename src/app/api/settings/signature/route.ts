import { getAdminSupabase } from "@/lib/admin-supabase";
import { NextRequest, NextResponse } from "next/server";

import { requireStaffWriter } from "@/lib/api-auth";
import { isValidSignatureDataUrl, validateImageBuffer } from "@/lib/image-upload";
import { logger } from "@/lib/logger";

// Service-role: system_info ab RLS se closed hai, isliye staff-guarded route
// ko service-role key chahiye (session token anon hai, RLS select/insert/update
// block karega). requireStaffWriter() pehle hi auth + geofence guard hai.
const supabase = getAdminSupabase();

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
    // Staff + office ke bahar + permit nahi → block (system_info write, service_role).
    const session = await requireStaffWriter(request);
    if (session instanceof NextResponse) return session;
    if (!session)
      return NextResponse.json({ status: "unauthorized", msg: "Login required" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const canvasData = form.get("canvasData") as string | null;
    const deleteFlag = form.get("delete") === "1";

    if (deleteFlag) {
      await upsertField("signature", "");
      return NextResponse.json({ status: "success", msg: "Signature removed" });
    }

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const check = validateImageBuffer(buffer, 500 * 1024);
      if (!check.ok) {
        return NextResponse.json({ status: "failed", msg: check.error }, { status: 400 });
      }
      const fileName = `signature.${check.ext}`;
      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(fileName, buffer, { upsert: true, contentType: check.mime });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(fileName);
      await upsertField("signature", urlData.publicUrl);
      return NextResponse.json({ status: "success", url: urlData.publicUrl });
    }

    if (canvasData) {
      if (!isValidSignatureDataUrl(canvasData)) {
        return NextResponse.json(
          { status: "failed", msg: "Signature image invalid hai — dobara draw karein" },
          { status: 400 }
        );
      }
      await upsertField("signature", canvasData);
      return NextResponse.json({ status: "success", url: canvasData });
    }

    return NextResponse.json(
      { status: "failed", msg: "No file or canvas data provided" },
      { status: 400 }
    );
  } catch (err: unknown) {
    logger.error("signature save failed:", err);
    return NextResponse.json(
      { status: "failed", msg: "Signature save nahi hua — dobara try karein" },
      { status: 500 }
    );
  }
}
