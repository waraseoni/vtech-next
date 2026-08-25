import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 theme-body">
      <Loader2 size={28} className="animate-spin" style={{ color: "var(--app-muted)" }} />
      <p className="text-sm font-bold" style={{ color: "var(--app-muted)" }}>
        Loading...
      </p>
    </div>
  );
}
