// Server-only helper: local migration filenames ko backup snapshot me store karo.
// Live DB me `supabase_migrations.schema_migrations` nahi hai (SQL Editor se apply),
// isliye source of truth repo ki `supabase/migrations/*.sql` list hai.
import fs from "node:fs";
import path from "node:path";

export function listMigrationIds(
  migrationsDir: string = path.join(process.cwd(), "supabase", "migrations")
): string[] {
  try {
    return (
      fs
        // Server bundle me poora project trace na ho (Turbopack hint).
        .readdirSync(/* turbopackIgnore: true */ migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => f.replace(/\.sql$/, ""))
    );
  } catch {
    return [];
  }
}
