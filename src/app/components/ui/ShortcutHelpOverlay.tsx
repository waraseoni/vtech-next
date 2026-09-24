"use client";

export function ShortcutHelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-app rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-app">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-panel-2 hover:bg-muted flex items-center justify-center text-muted hover:text-app transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Dashboard</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              g d
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Jobs</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              g j
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Clients</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              g c
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Sales</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              g s
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Search (universal)</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              Ctrl K
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Close / Escape</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              Esc
            </kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">This help</span>
            <kbd className="px-2 py-0.5 rounded bg-muted text-app text-xs font-bold">
              ?
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
