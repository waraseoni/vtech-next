// ============================================================================
// ConfirmDialog — window.confirm / alert("Sure?") replacement
//
// Blocking native dialogs (alert/confirm) Sprint 1 me kill ho rahe hain.
// Destructive actions ke liye:
//
//   const [confirm, setConfirm] = useState<{...} | null>(null);
//   <ConfirmDialog
//     open={!!confirm}
//     title="Job delete karein?"
//     message={`Job #${confirm?.jobId} permanently delete ho jayega.`}
//     confirmLabel="Delete"
//     danger
//     onConfirm={() => doDelete()}
//     onCancel={() => setConfirm(null)}
//   />
//
// Mobile-friendly: full-width buttons, 44px min targets, backdrop click = cancel.
// ============================================================================

"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm bg-[#161b27] border border-[#21293d] rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              danger ? "bg-red-500/10 border border-red-500/20" : "bg-amber-500/10 border border-amber-500/20"
            }`}
          >
            <AlertTriangle
              size={18}
              className={danger ? "text-red-400" : "text-amber-400"}
            />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl border border-[#21293d] bg-[#0d1117] text-slate-300 text-xs font-bold hover:bg-[#1a2030] transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 min-h-[44px] rounded-xl text-white text-xs font-bold transition-colors disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
