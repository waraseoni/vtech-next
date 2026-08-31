"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, getCachedUser } from "@/lib/supabase";
import { safeImageSrc } from "@/lib/image-utils";
import { Users, Search, RefreshCw, ShieldAlert, Eye } from "lucide-react";
import PageLoader from "@/components/PageLoader";
import {
  fetchPairMessages,
  type Message,
  type ProfileLite,
} from "@/lib/messaging";
import { mediaPublicUrl } from "@/lib/media";

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const fmtDay = (s: string) => {
  const d = new Date(s);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(s);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
  });
};

const avatarInitial = (n: string | null | undefined) => (n || "?").trim().charAt(0).toUpperCase();

function Avatar({ name, url, size = 36 }: { name: string | null | undefined; url?: string | null; size?: number }) {
  if (url) {
    const src = safeImageSrc(url);
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || "avatar"}
        style={{ width: size, height: size }}
        className="rounded-full object-cover bg-slate-700 shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0"
    >
      {avatarInitial(name)}
    </div>
  );
}

export default function SupervisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [fetching, setFetching] = useState(false);
  const profileMapRef = useRef<Record<string, ProfileLite>>({});

  const nameOf = (id: string) => profileMap[id]?.full_name || "?";

  const loadProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .in("role", ["admin", "staff", "developer"])
      .order("full_name", { ascending: true });
    const list = (data as ProfileLite[]) || [];
    const map: Record<string, ProfileLite> = {};
    for (const p of list) map[p.id] = p;
    profileMapRef.current = map;
    setProfileMap(map);
    setProfiles(list);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await getCachedUser();
        if (!user) {
          router.push("/login");
          return;
        }
        const { data: myP } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const role = myP?.role || "";
        // sirf admin/developer is tool ko use kar sakte hain
        if (!["admin", "developer"].includes(role)) {
          if (!cancelled) setNotAllowed(true);
          return;
        }
        await loadProfiles();
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) setLoadErr("Load hone me dikkat aayi");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // jab dono users chun jayein to conversation fetch karo
  useEffect(() => {
    if (!selA || !selB || selA === selB) {
      setMsgs([]);
      return;
    }
    let cancelled = false;
    setFetching(true);
    fetchPairMessages(selA, selB).then((data) => {
      if (cancelled) return;
      setMsgs(data);
      setFetching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selA, selB]);

  if (loading) return <PageLoader icon={Users} label="Loading Supervise" tone="cyan" />;

  if (notAllowed)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <ShieldAlert size={40} className="text-rose-500/70" />
        <h1 className="text-lg font-bold text-slate-700">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          Ye tool sirf admin ya developer use kar sakta hai. Staff messages
          kaise dekhega yahan allowed nahi.
        </p>
      </div>
    );

  if (loadErr)
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-rose-600">{loadErr}</div>
    );

  const shownProfiles = (q: string) =>
    profiles.filter((p) => (p.full_name || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Eye size={20} className="text-cyan-500/80" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800">Message Supervision</h1>
          <p className="text-xs text-slate-500">
            Admin/Developer — kisi bhi do users ke beech private chat dekhne ka read-only tool.
          </p>
        </div>
      </div>

      {/* user pickers */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">User A</label>
          <div className="relative mt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchA}
              onChange={(e) => setSearchA(e.target.value)}
              placeholder="Search user A..."
              className="w-full rounded-xl bg-white border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400"
            />
          </div>
          <div className="mt-2 bg-white border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
            {shownProfiles(searchA).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelA(p.id);
                  setSearchA("");
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cyan-50/50 ${
                  selA === p.id ? "bg-cyan-50" : ""
                }`}
              >
                <Avatar name={p.full_name} url={p.avatar_url} size={30} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.full_name}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{p.role}</p>
                </div>
              </button>
            ))}
            {shownProfiles(searchA).length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400">Koi user nahi mila</p>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">User B</label>
          <div className="relative mt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchB}
              onChange={(e) => setSearchB(e.target.value)}
              placeholder="Search user B..."
              className="w-full rounded-xl bg-white border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400"
            />
          </div>
          <div className="mt-2 bg-white border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
            {shownProfiles(searchB).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelB(p.id);
                  setSearchB("");
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cyan-50/50 ${
                  selB === p.id ? "bg-cyan-50" : ""
                }`}
              >
                <Avatar name={p.full_name} url={p.avatar_url} size={30} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.full_name}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{p.role}</p>
                </div>
              </button>
            ))}
            {shownProfiles(searchB).length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400">Koi user nahi mila</p>
            )}
          </div>
        </div>
      </div>

      {/* conversation */}
      <div className="bg-slate-800/60 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <RefreshCw
              size={14}
              className={fetching ? "animate-spin text-cyan-400" : "text-slate-400"}
            />
            {selA && selB && selA !== selB ? (
              <span>
                {nameOf(selA)} <span className="text-slate-500">⟷</span> {nameOf(selB)}
              </span>
            ) : (
              <span className="text-slate-400">Dono users chunke chat dekho</span>
            )}
          </div>
          {selA && selB && selA !== selB && (
            <button
              onClick={() => fetchPairMessages(selA!, selB!).then(setMsgs)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Refresh
            </button>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {msgs.length === 0 && !fetching ? (
            <p className="text-center text-slate-400 text-xs py-6">
              {selA && selB && selA !== selB
                ? "In dono ke beech koi message nahi mila"
                : "Dono users select karo"}
            </p>
          ) : (
            msgs.map((m) => {
              const mine = m.sender_id === selA;
              const isMedia = !!m.media_url;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] flex flex-col gap-1">
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                        mine
                          ? "bg-cyan-600 text-white rounded-br-md"
                          : "bg-white/10 text-slate-100 rounded-bl-md"
                      }`}
                    >
                      {isMedia && (
                        <div className="mb-1.5">
                          {m.media_type?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaPublicUrl(m.media_url!)}
                              alt={m.media_name || "media"}
                              className="max-h-48 w-auto rounded-lg border border-black/20"
                              loading="lazy"
                            />
                          ) : (
                            <a
                              href={mediaPublicUrl(m.media_url!)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-cyan-200 underline underline-offset-2"
                            >
                              {m.media_name || "Attachment"}
                            </a>
                          )}
                        </div>
                      )}
                      {m.content !== m.media_name && <span>{m.content}</span>}
                    </div>
                    <span
                      className={`text-[10px] text-slate-500 ${mine ? "text-right" : ""}`}
                    >
                      {fmtDay(m.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
        Ye read-only supervision hai — messages ko edit/delete nahi kar sakte. RLS ki wajah se
        sirf admin/developer ke account ko database me sab chats dikhti hain.
      </p>
    </div>
  );
}
