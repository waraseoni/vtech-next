import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-body">
      <div className="text-center max-w-sm">
        <div className="text-7xl font-black text-blue-400 mb-4">404</div>
        <h1 className="text-2xl font-black mb-2 theme-text">Page nahi mila!</h1>
        <p className="text-sm mb-6" style={{ color: "var(--app-muted)" }}>
          Ye page exist nahi karta ya hata diya gaya hai.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95 no-underline"
        >
          Dashboard pe jao
        </Link>
      </div>
    </div>
  );
}
