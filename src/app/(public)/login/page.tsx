"use client";
import { useState, useEffect } from "react";
import { supabase, invalidateCachedUser } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  LogIn,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  Smartphone,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  UserRound,
  Fingerprint,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import {
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/browser";
import { usePublicSiteContent } from "../components/public-content-provider";
import { APP_VERSION_LABEL, APP_VERSION_FULL } from "@/lib/app-version";
import PullToRefresh from "@/components/PullToRefresh";
import { isNativeApp } from "@/lib/nativeApp";

type Tab = "staff" | "client";

// ── Passkey fetch helpers (server: /api/auth/login) ────────────────────────
// begin: challenge options laata hai. Email khaali → usernameless (discoverable).
async function beginPasskey(email: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "passkey-begin", email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Passkey login shuru nahi ho paaya");
  return data.options;
}

// verify: assertion bhejta hai, session set hota hai, phir full reload.
async function verifyAssertion(email: string, assertion: AuthenticationResponseJSON) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "passkey-verify", email, response: assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Passkey verify fail hua");
  if (email) {
    localStorage.setItem("vtech_email", email);
    localStorage.setItem("vtech_remember", "true");
  }
  // Intentional full reload: login ke baad RootClient session state fresh init hoti hai
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/dashboard";
}

function TabButton({
  t,
  icon,
  label,
  active,
  onSelect,
}: {
  t: Tab;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onSelect: (t: Tab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 flex-1 min-h-[44px] px-2 rounded-full text-[11px] font-black transition-all sm:text-xs ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
          : "text-muted hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function friendlyName(email: string) {
  const raw =
    email
      .split("@")[0]
      ?.replace(/[._-]+/g, " ")
      .trim() || "";
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "";
}

export default function LoginPage() {
  const content = usePublicSiteContent();
  useRouter();
  const [tab, setTab] = useState<Tab>("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyReady, setPasskeyReady] = useState(false);
  // Capacitor Android app me passkey button dikhane ke liye false rakhte hain
  // (WebView WebAuthn support karta nahi) — message alag dikhana hai isliye
  // alag state.
  const [inNativeApp, setInNativeApp] = useState(false);
  const [condNonce, setCondNonce] = useState(0);
  const [condActive, setCondActive] = useState(false);

  // Client OTP state
  const [clientEmail, setClientEmail] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState("");
  // Resend cooldown — OTP flood rokne ke liye (sirf UI gate, API pehle se throttle hai).
  const [resendIn, setResendIn] = useState(0);

  // ── Load saved email ───────────────────────────────────────────────────
  useEffect(() => {
    const savedEmail = localStorage.getItem("vtech_email");
    const savedRemember = localStorage.getItem("vtech_remember") === "true";
    if (savedRemember && savedEmail) {
      // localStorage SSR me exist nahi karta; mount-time init hi sahi hai
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // ── Passkey (biometric) support detect ─────────────────────────────────
  useEffect(() => {
    // `browserSupportsWebAuthn()` sirf `PublicKeyCredential` ki presence
    // check karta hai — PC par bina biometric device ke bhi true deta hai.
    // Isliye ASLI platform authenticator (fingerprint / Face / Hello) ka
    // availability check zaroori hai. WebAuthn secure-context (HTTPS ya
    // localhost) me hi chalega; LAN HTTP par browser API hi nahi deta.
    //
    // Android WebView me `PublicKeyCredential` defined hota hai par platform
    // authenticator wired nahi — tap karne par kuch nahi hota. Isliye native
    // app me passkey abhi ke liye band rakhte hain.
    let cancelled = false;
    (async () => {
      const native = isNativeApp();
      if (cancelled) return;
      setInNativeApp(native);
      if (native || !window.isSecureContext || !browserSupportsWebAuthn()) {
        setPasskeyReady(false);
        return;
      }
      try {
        const available =
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
            ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            : false;
        if (!cancelled) setPasskeyReady(available);
      } catch {
        // API block/permission denial = gracefully password-only.
        if (!cancelled) setPasskeyReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Auto-logoff reason (revoked access / idle timeout) ────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason === "revoked") {
      // URL params sirf browser me hote hain; render me read nahi kar sakte
      setTab("client");
      setError(
        "Aapki portal access band kar di gayi hai. Dobara access ke liye shop se sampark karein."
      );
    } else if (reason === "idle") {
      // Staff ya client — dono ke liye same message. Tab switch nahi karte
      // (staff tab pe default dikh jayega, client tab pe bhi same error dikhega).
      setError(
        "Kuchh der inactivity ki wajah se aap automatically logout ho gaye hain. Dobara login karein."
      );
    }
  }, []);

  // ── Staff login handler ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Login fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    if (rememberMe) {
      localStorage.setItem("vtech_email", email);
      localStorage.setItem("vtech_remember", "true");
    } else {
      localStorage.removeItem("vtech_email");
      localStorage.removeItem("vtech_remember");
    }

    // Intentional full reload: login ke baad RootClient session state fresh initialize hota hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/dashboard";
  };

  // ─── Passkey login handler (explicit button)
  // Email optional — khaali chhodo to browser device ka passkey picker dikhata hai.
  const handlePasskeyLogin = async () => {
    setError("");
    const em = email.trim().toLowerCase();
    setPasskeyLoading(true);
    try {
      const options = await beginPasskey(em);
      const assertion = await startAuthentication({ optionsJSON: options });
      await verifyAssertion(em, assertion);
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      setError(
        cancelled
          ? "Passkey cancel ho gaya ya timeout. Dobara try karein ya password se login karein."
          : "Passkey login fail hua. Password se try karein."
      );
      setPasskeyLoading(false);
    }
  };

  // ─── Conditional UI (browser autofill) ──
  // Email field ke upar browser passkey option dikhata hai; user sirf finger
  // rakh de to hi login ho jata hai. Challenge TTL 5 min — isliye har 4 min
  // naya challenge lete hain (nonce bump → effect re-run → abort + restart).
  useEffect(() => {
    if (!passkeyReady || tab !== "staff") return;
    let cancelled = false;
    (async () => {
      try {
        const supported = await browserSupportsWebAuthnAutofill();
        if (cancelled) return;
        if (!supported) {
          if (import.meta.env.DEV)
            console.info("[passkey] conditional UI unsupported — button fallback active");
          return;
        }
        const options = await beginPasskey("");
        if (cancelled) return;
        setCondActive(true);
        const assertion = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
        });
        if (cancelled) return;
        await verifyAssertion("", assertion);
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        // Abort (button/tab-switch/nonce-refresh) = normal, ignore.
        if (cancelled || name === "AbortError" || name === "NotAllowedError") return;
        console.warn("[passkey] conditional error:", name, err);
      } finally {
        if (!cancelled) setCondActive(false);
      }
    })();
    const timer = window.setTimeout(
      () => {
        if (!cancelled) setCondNonce((n) => n + 1);
      },
      4 * 60 * 1000
    );
    return () => {
      cancelled = true;
      setCondActive(false);
      window.clearTimeout(timer);
    };
  }, [passkeyReady, tab, condNonce]);

  // ── Client OTP: send code ──────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "otp", email: clientEmail.trim().toLowerCase() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "OTP bhejna fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    setInfo("OTP aapke email par bheja gaya hai — spam folder bhi check karlein.");
    setOtpStep("verify");
    setResendIn(30);
    setLoading(false);
  };

  // Resend countdown — 1s ticks, cleanup par timer band (StrictMode safe).
  useEffect(() => {
    if (otpStep !== "verify" || resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [otpStep, resendIn]);

  // ── Client OTP: verify → onboard → redirect ───────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "verify-otp",
        email: clientEmail.trim().toLowerCase(),
        token: otp.trim(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "OTP verify fail hua. Dobara try karein.");
      setLoading(false);
      return;
    }

    // Profile (role=client, client_id) service-role API se banao
    const onboardRes = await fetch("/api/client/onboard", { method: "POST" });
    const onboardData = await onboardRes.json();

    if (!onboardRes.ok) {
      setError(onboardData.error || "Account setup nahi hua.");
      await supabase.auth.signOut();
      invalidateCachedUser();
      setLoading(false);
      setOtpStep("request");
      return;
    }

    // Intentional full reload: onboarding ke baad RootClient session state fresh initialize hota hai
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/my-account";
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setInfo("");
    setOtpStep("request");
    setOtp("");
    setResendIn(0);
  };

  return (
    <PullToRefresh className="min-h-screen">
      <div className="min-h-screen bg-app flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Logo / Brand */}
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
            <p className="text-sm text-muted mt-3 font-semibold">
              Namaste! 👋 Apni dukan me aapka swagat hai.
            </p>
          </div>

          {/* Card */}
          <div className="bg-panel border border-app rounded-2xl p-6 sm:p-7 shadow-2xl">
            {/* Tabs */}
            <div className="flex gap-1 p-1 mb-6 rounded-full bg-panel-2 border border-app">
              <TabButton
                t="staff"
                icon={<UserRound size={14} />}
                label="Dukaan Staff"
                active={tab === "staff"}
                onSelect={switchTab}
              />
              <TabButton
                t="client"
                icon={<Smartphone size={14} />}
                label="Customer Portal"
                active={tab === "client"}
                onSelect={switchTab}
              />
            </div>

            <div className="mb-5">
              <h2 className="text-lg font-black text-white">
                {tab === "staff" ? "Staff Login" : "Customer Login"}
              </h2>
              <p className="text-muted-2 text-sm mt-0.5">
                {tab === "staff"
                  ? "Dukan chalane ke liye login karein"
                  : "Email OTP se apne repairs dekhein"}
              </p>
              {tab === "staff" && rememberMe && email && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 px-3 py-1.5 text-xs font-bold text-blue-300">
                  👋 Namaste {friendlyName(email)} — mujhe yaad hai!
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Info message */}
            {info && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold px-4 py-3 rounded-xl mb-5">
                <KeyRound size={15} className="flex-shrink-0 mt-0.5" />
                {info}
              </div>
            )}

            {tab === "staff" && (
              <div className="space-y-4">
                {passkeyReady && (
                  <>
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      disabled={passkeyLoading || loading}
                      className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-black text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/30"
                    >
                      {passkeyLoading ? (
                        <>
                          <Loader2 size={19} className="animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <Fingerprint size={20} className="flex-shrink-0" />
                          <span className="flex flex-col items-start leading-tight">
                            <span>Passkey se 1 tap me login</span>
                            <span className="text-[10px] font-semibold text-blue-100/80">
                              Fingerprint · Face · Device PIN
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-app" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-2">
                        ya password se login karein
                      </span>
                      <div className="h-px flex-1 bg-app" />
                    </div>
                  </>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                      />
                      <input
                        type="email"
                        placeholder="staff@vtech.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        // "webauthn" autocomplete = conditional UI (passkey autofill) ke liye zaroori
                        autoComplete="username webauthn"
                        className="w-full pl-10 pr-4 py-3 bg-panel-2 border border-app rounded-xl text-sm text-white font-medium placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                      />
                      <input
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-11 py-3 bg-panel-2 border border-app rounded-xl text-sm text-white font-medium placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-2 hover:text-muted transition-colors"
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRememberMe((v) => !v)}
                      className={`w-9 h-5 rounded-full transition-all duration-200 flex-shrink-0 relative ${
                        rememberMe ? "bg-blue-600" : "bg-panel-2"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                          rememberMe ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </button>
                    <label
                      onClick={() => setRememberMe((v) => !v)}
                      className="text-xs font-bold text-muted cursor-pointer select-none hover:text-muted transition-colors"
                    >
                      Remember My Email
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30 mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={17} className="animate-spin" /> Logging in...
                      </>
                    ) : (
                      <>
                        <LogIn size={17} /> Login to Dashboard
                      </>
                    )}
                  </button>

                  {passkeyReady && condActive && (
                    <p className="text-center text-[11px] font-semibold text-blue-300">
                      👆 Email field par passkey dikh gaya — finger rakhein.
                    </p>
                  )}
                  {inNativeApp && (
                    <p className="text-center text-[11px] text-muted-2">
                      Is app me biometric available nahi hai — password use karein.
                    </p>
                  )}
                </form>

                <a
                  href={content.contact.whatsappHref || content.contact.phoneHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 min-h-[44px] text-xs font-bold text-muted hover:text-white transition-colors"
                >
                  <HelpCircle size={14} />
                  Password bhool gaye? Admin se sampark karein
                  <MessageCircle size={13} className="text-muted-2" />
                </a>
              </div>
            )}

            {tab === "client" && (
              <div className="space-y-4">
                {otpStep === "request" ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                        Apna Register Email
                      </label>
                      <div className="relative">
                        <Mail
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                        />
                        <input
                          type="email"
                          placeholder="aapka@email.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          required
                          className="w-full pl-10 pr-4 py-3 bg-panel-2 border border-app rounded-xl text-sm text-white font-medium placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-muted-2 mt-2">
                        OTP usi email par jayega jo dukaan me register hai. Pehle shop se apna email
                        confirm karwayein.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={17} className="animate-spin" /> Sending OTP...
                        </>
                      ) : (
                        <>
                          <KeyRound size={17} /> Send OTP
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setOtpStep("request")}
                      className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-app-2 transition-colors"
                    >
                      <ArrowLeft size={13} /> {clientEmail} — change
                    </button>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-muted mb-1.5">
                        OTP Code
                      </label>
                      <div className="relative">
                        <KeyRound
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="••••••"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          required
                          className="w-full min-h-[48px] pl-10 pr-4 py-3 bg-panel-2 border border-app rounded-xl text-center text-lg font-black tracking-[0.35em] text-white placeholder:tracking-normal placeholder:text-app outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={17} className="animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <LogIn size={17} /> Verify & Login
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading || resendIn > 0}
                      className="w-full min-h-[44px] py-2.5 bg-panel-2 border border-app rounded-xl text-xs font-bold text-muted hover:text-white transition-all disabled:opacity-50"
                    >
                      {resendIn > 0 ? `OTP dobara bhejein (${resendIn}s)` : "OTP dobara bhejein"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Public Access Link */}
          <div className="mt-6">
            <a
              href="/job-status"
              className="flex items-center gap-3 w-full min-h-[52px] px-4 rounded-xl border border-blue-500/25 bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20 transition-all group"
            >
              <span className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Globe size={17} className="text-blue-400" />
              </span>
              <span className="flex-1 text-left">
                <span className="block text-xs font-black text-white">
                  Bina login job status track karein
                </span>
                <span className="block text-[10px] text-muted-2 font-semibold">
                  Customer portal · sirf job number chahiye
                </span>
              </span>
              <ArrowRight
                size={16}
                className="text-blue-400 group-hover:translate-x-0.5 transition-transform"
              />
            </a>
          </div>

          {/* Footer */}
          <p className="text-center text-app text-[11px] mt-5 font-medium">
            {content.brand.name} · {content.contact.phone}
          </p>
          <p className="text-center text-app text-[10px] mt-1 font-medium">
            <span
              className="px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.06]"
              title={APP_VERSION_FULL}
            >
              ver {APP_VERSION_LABEL}
            </span>
          </p>
        </div>
      </div>
    </PullToRefresh>
  );
}
