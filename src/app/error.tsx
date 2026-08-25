"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-body">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black mb-2 theme-text">Page load nahi ho paya</h1>
        <p className="text-sm mb-2" style={{ color: "var(--app-muted)" }}>
          Kuch gadbad ho gayi. Try again karo.
        </p>
        {error.digest && (
          <p className="text-xs mb-4 font-mono" style={{ color: "var(--app-muted-2)" }}>
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
        >
          Dobara try karo
        </button>
      </div>
    </div>
  );
}
