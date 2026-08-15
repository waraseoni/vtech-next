import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/api-auth";

type BackupFile = {
  name: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  category: "mariadb-dump" | "schema-reference";
};

const rootDir = process.cwd();
const mariadbDir = path.join(rootDir, "php-ref", "db");
const extraFiles = [
  { fullPath: path.join(rootDir, "vikram_db_supabase.txt"), relativePath: "vikram_db_supabase.txt", category: "schema-reference" as const },
];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const files: BackupFile[] = [];

    try {
      const entries = await fs.readdir(mariadbDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".sql")) continue;
        const fullPath = path.join(mariadbDir, entry.name);
        const stat = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          relativePath: path.join("php-ref", "db", entry.name).replace(/\\/g, "/"),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          category: "mariadb-dump",
        });
      }
    } catch {
      // Ignore if folder is missing.
    }

    for (const item of extraFiles) {
      try {
        const stat = await fs.stat(/*turbopackIgnore: true*/ item.fullPath);
        files.push({
          name: path.basename(item.fullPath),
          relativePath: item.relativePath.replace(/\\/g, "/"),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          category: item.category,
        });
      } catch {
        // Ignore missing optional file.
      }
    }

    files.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));

    return NextResponse.json({
      ok: true,
      files,
      latestMariadbDump: files.find((file) => file.category === "mariadb-dump") || null,
    });
  } catch (error) {
    console.error("backup listing error:", error);
    return NextResponse.json({ ok: false, error: "Backup files list nahi ban paayi." }, { status: 500 });
  }
}
