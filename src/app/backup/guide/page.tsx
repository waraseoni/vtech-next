import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpen } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Backup & Restore Guide",
};

export default function BackupGuidePage() {
  let html = "";
  let missing = false;

  try {
    const file = path.join(process.cwd(), "docs", "BACKUP_GUIDE.md");
    html = renderMarkdown(fs.readFileSync(file, "utf8"));
  } catch {
    missing = true;
  }

  return (
    <div className="min-h-screen bg-app font-sans pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="bg-panel border border-app rounded-2xl px-5 py-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-indigo-700 rounded-xl flex items-center justify-center">
                <BookOpen size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">Backup & Restore Guide</h1>
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  Hindi · English · Hinglish
                </p>
              </div>
            </div>
            <Link
              href="/backup"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-panel-2 border border-app-2 hover:bg-panel-2 text-muted rounded-lg text-xs font-bold transition"
            >
              <ArrowLeft size={12} /> Back to Backup
            </Link>
          </div>
        </div>

        {missing ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-red-400 text-sm">
            Guide file nahi mili: <span className="font-mono">docs/BACKUP_GUIDE.md</span>
          </div>
        ) : (
          <article
            className="backup-guide bg-panel border border-app rounded-2xl px-5 py-5 sm:px-7 sm:py-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
