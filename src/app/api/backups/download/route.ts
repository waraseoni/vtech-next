import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/api-auth";

const rootDir = process.cwd();
const mariadbDir = path.join(rootDir, "php-ref", "db");
const ALLOWED = ["vikram_db_supabase.txt"];

function safeResolve(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.resolve(rootDir, normalized);
  if (!fullPath.startsWith(rootDir)) {
    throw new Error("Invalid path");
  }
  return fullPath;
}

function isAllowed(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (ALLOWED.includes(normalized)) return true;
  const sqlPrefix = path.join("php-ref", "db", "").replace(/\\/g, "/");
  return normalized.startsWith(sqlPrefix) && normalized.endsWith(".sql");
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const relativePath = req.nextUrl.searchParams.get("file");
  if (!relativePath) {
    return new NextResponse("file query param required", { status: 400 });
  }
  if (!isAllowed(relativePath)) {
    return new NextResponse("Access denied", { status: 403 });
  }

  try {
    const fullPath = safeResolve(relativePath);
    const file = await fs.readFile(fullPath);
    const filename = path.basename(fullPath);
    const lower = filename.toLowerCase();
    const type = lower.endsWith(".sql")
      ? "application/sql; charset=utf-8"
      : lower.endsWith(".txt")
      ? "text/plain; charset=utf-8"
      : "application/octet-stream";

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("backup download error:", error);
    return new NextResponse("Requested backup file not found", { status: 404 });
  }
}
