"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PullToRefresh from "@/components/PullToRefresh";
import { usePublicSiteContent } from "../components/public-content-provider";

type SessionState = "checking" | "valid" | "invalid";

function friendlyUpdateError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("weak") ||
    lower.includes("at least 6") ||
    lower.includes("password should be")
  ) {
    return "Password thoda strong karein — kam se kam 6 characters daalein.";
  }
  if (lower.includes("same") || lower.includes("recently used")) {
    return "Ye password purane password jaisa hai. Koi naya password chunein.";
  }
  if (
    lower.includes("expired") ||
    lower.includes("invalid") ||
    lower.includes("token") ||
    lower.includes("session")
  ) {
    return "Reset link expire ho gaya ya invalid hai. Dobara reset link maangein.";
  }
  return "Password update nahi ho paya. Dobara try karein ya naya reset link maangein.";
}

export default function ResetPasswordPage() {
  const content = usePublicSiteContent();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (cancelled) return;
        setSessionState(sessionError || !data.session ? "invalid" : "valid");
      } catch {
        if (!cancelled) setSessionState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Dono password match nahi kar rahe. Dobara check karein.");
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(friendlyUpdateError(err instanceof Error ? err.message : ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PullToRefresh className="min-h-screen">
      <div className="min-h-screen bg-app flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-900/50">
              <ShieldCheck size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              V-TECH <span className="text-blue-400 font-light">PRO</span>
            </h1>
            <p className="text-muted-2 text-xs font-bold uppercase tracking-[0.2em] mt-1">
              Management System
            </p>
          </div>

          <div className="bg-panel border border-app rounded-2xl p-6 sm:p-7 shadow-2xl text-white">
            {sessionState === "checking" && (
              <div className="flex flex-col items-center justify-center py-10 gap-3" role="status">
                <Loader2 size={26} className="animate-spin text-blue-400" />
                <p className="text-sm font-semibold text-muted">Reset link verify ho raha hai...</p>
              </div>
            )}

            {sessionState === "invalid" && (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertCircle size={22} className="text-red-400" />
                </div>
                <h2 className="text-lg font-black text-white mt-4">
                  Reset link expire ho gaya ya invalid hai.
                </h2>
                <p className="text-sm text-muted mt-2">
                  Naya reset link maang kar dobara try karein.
                </p>
                <Link
                  href="/login"
                  className="mt-6 w-full min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  <ArrowLeft size={16} /> Login par wapas jayein
                </Link>
              </div>
            )}

            {sessionState === "valid" && !success && (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-black text-white">Naya Password Set Karein</h2>
                  <p className="text-muted-2 text-sm mt-0.5">
                    Apne account ke liye naya password chunein.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5"
                  >
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5"
                    >
                      Naya Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                      />
                      <input
                        id="new-password"
                        name="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                        autoComplete="new-password"
                        aria-describedby="new-password-hint"
                        disabled={saving}
                        required
                        className="w-full pl-10 pr-11 py-3 bg-panel-2 border border-app rounded-xl text-sm text-white font-medium placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword ? "Naya password chhupayein" : "Naya password dikhayein"
                        }
                        aria-pressed={showNewPassword}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-2 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p id="new-password-hint" className="text-[11px] text-muted-2 mt-1.5">
                      Kam se kam 6 characters.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5"
                    >
                      Password Confirm Karein
                    </label>
                    <div className="relative">
                      <KeyRound
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                      />
                      <input
                        id="confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={6}
                        autoComplete="new-password"
                        disabled={saving}
                        required
                        className="w-full pl-10 pr-11 py-3 bg-panel-2 border border-app rounded-xl text-sm text-white font-medium placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? "Confirm password chhupayein"
                            : "Confirm password dikhayein"
                        }
                        aria-pressed={showConfirmPassword}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-2 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={17} className="animate-spin" /> Password update ho raha
                        hai...
                      </>
                    ) : (
                      <>
                        <KeyRound size={17} /> Password Update Karein
                      </>
                    )}
                  </button>
                </form>

                <Link
                  href="/login"
                  className="mt-4 w-full min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-bold text-muted hover:text-white transition-colors"
                >
                  <ArrowLeft size={13} /> Login par wapas jayein
                </Link>
              </>
            )}

            {sessionState === "valid" && success && (
              <div className="text-center" role="status">
                <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
                <h2 className="text-lg font-black text-white mt-4">
                  Password update ho gaya. Ab login karein.
                </h2>
                <p className="text-sm text-muted mt-2">
                  Apne naye password se account me login karein.
                </p>
                <Link
                  href="/login"
                  className="mt-6 w-full min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  Login karein <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>

          <p className="text-center text-app text-[11px] mt-5 font-medium">
            {content.brand.name} · {content.contact.phone}
          </p>
        </div>
      </div>
    </PullToRefresh>
  );
}
