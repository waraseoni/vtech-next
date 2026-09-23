// ============================================================================
// EmptyState — List/table khali ho to consistent empty placeholder + CTA
//
// Pehle har page alag-alag text likhta tha ("No records found", "Kuch nahi",
// etc.). Ab:
//   <EmptyState
//     icon={ClipboardList}
//     title="Koi job nahi"
//     hint="Naya job banao ya filter badlo"
//     action={{ label: "+ New Job", onClick: () => router.push("/jobs/new") }}
//   />
// ============================================================================

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  hint,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 rounded-2xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center mb-4">
      <Icon size={28} className="text-slate-500" />
    </div>
    <p className="text-sm font-bold text-slate-400">{title}</p>
    {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors min-h-[44px]"
      >
        {action.label}
      </button>
    )}
  </div>
);

export default EmptyState;
