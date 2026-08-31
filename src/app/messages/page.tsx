"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase, getCachedUser } from "@/lib/supabase";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Loader2,
  Search,
  Inbox,
  CheckCheck,
} from "lucide-react";
import PageLoader from "@/components/PageLoader";
import {
  fetchConversations,
  fetchMessages,
  sendMessage,
  markRead,
  subscribeMessages,
  isOnline,
  lastSeenText,
  type Conversation,
  type Message,
  type ProfileLite,
  type Presence,
} from "@/lib/messaging";
import { subscribePresence } from "@/lib/presence";

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
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return fmtTime(s);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
  });
};
const avatarInitial = (n: string | null | undefined) =>
  (n || "?").trim().charAt(0).toUpperCase();

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meIdRef = useRef<string>("");
  const [meName, setMeName] = useState("Me");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, Presence>>({});

  const [activeId, setActiveId] = useState<string | null>(
    searchParams.get("to") || null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendErr, setSendErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const msgsRef = useRef<Message[]>([]);
  const convRef = useRef<Conversation[]>([]);
  const activeRef = useRef<string | null>(activeId);
  const subCleanup = useRef<{ unsubscribe: () => void } | null>(null);
  const presCleanup = useRef<{ unsubscribe: () => void } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const profileMapRef = useRef<Record<string, ProfileLite>>({});

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    const onR = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const mq = window.matchMedia("(max-width: 768px)");
    mq.addEventListener("change", onR);
    return () => mq.removeEventListener("change", onR);
  }, []);

  // session + profiles + presence bootstrap
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await getCachedUser();
        if (!user) {
          router.push("/login");
          return;
        }
        meIdRef.current = user.id;
        // my name for push + apna role check (staff/admin/developer hi messenger use kar sakta hai)
        const { data: myP } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .maybeSingle();
        setMeName(myP?.full_name || user.email?.split("@")[0] || "Me");
        const myRole = myP?.role || "";
        if (!["admin", "staff", "developer"].includes(myRole)) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        // staff/developer/admin profiles directory — messenger sirf staff ke liye
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .neq("id", user.id)
          .in("role", ["admin", "staff", "developer"])
          .order("full_name", { ascending: true });
        if (profErr) {
          // ek result par profile lookup fail (misleading "no users") se bachne ke liye
          // basic columns ke saath dubara try karo
          const { data: basic } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .neq("id", user.id)
            .in("role", ["admin", "staff", "developer"])
            .order("full_name", { ascending: true });
          if (cancelled) return;
          const plist0 = (basic || []) as ProfileLite[];
          setProfiles(plist0);
          const pm0: Record<string, ProfileLite> = {};
          plist0.forEach((p) => (pm0[p.id] = p));
          profileMapRef.current = pm0;
          setLoading(false);
          setNotFound(plist0.length === 0);
          return;
        }
        if (cancelled) return;
        const plist = (profs || []) as ProfileLite[];
        setProfiles(plist);
        const pm: Record<string, ProfileLite> = {};
        plist.forEach((p) => (pm[p.id] = p));
        profileMapRef.current = pm;

        // presence snapshot
        const { data: pres, error: presErr } = await supabase
          .from("user_presence")
          .select("user_id, status, last_seen");
        if (!presErr && !cancelled) {
          const pmap: Record<string, Presence> = {};
          (pres || []).forEach((r) => (pmap[r.user_id] = { status: r.status, last_seen: r.last_seen }));
          setPresenceMap(pmap);
          // conversations
          const convs = await fetchConversations(user.id, plist, pmap);
          if (cancelled) return;
          setConversations(convs);
          convRef.current = convs;
        }
        setLoading(false);
        setNotFound(plist.length === 0);
      } catch {
        if (!cancelled) {
          setLoadErr("Kuch gadbad hui — messenger load nahi hua");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live presence updates
  useEffect(() => {
    const sub = subscribePresence((userId, row) => {
      setPresenceMap((prev) => ({
        ...prev,
        [userId]: { status: row.status, last_seen: row.last_seen },
      }));
      // update conversation presence
      setConversations((prev) =>
        prev.map((c) => (c.other.id === userId ? { ...c, presence: row } : c))
      );
    });
    presCleanup.current = sub;
    return () => presCleanup.current?.unsubscribe();
  }, []);

  // live messages — update conversations (list) + active chat + clear unread
  const onIncoming = useCallback((msg: Message) => {
    const me = meIdRef.current;
    const otherId = msg.sender_id === me ? msg.recipient_id : msg.sender_id;
    const pm = profileMapRef.current;
    // conversation list
    setConversations((prev) => {
      const others = prev.map((c) => c.other.id);
      let list = [...prev];
      const existing = list.find((c) => c.other.id === otherId);
      const otherProf: ProfileLite =
        existing?.other || pm[otherId] || { id: otherId, full_name: otherId.slice(0, 8), role: null };
      if (existing) {
        list = list.map((c) =>
          c.other.id === otherId
            ? {
                ...c,
                lastMessage: msg,
                unread: msg.recipient_id === me && activeRef.current !== otherId ? c.unread + 1 : c.unread,
              }
            : c
        );
      } else {
        list = [
          { other: otherProf, lastMessage: msg, unread: msg.recipient_id === me ? 1 : 0, presence: null },
          ...list,
        ];
      }
      // re-sort by recency
      list.sort(
        (a, b) =>
          (b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0) -
          (a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0)
      );
      convRef.current = list;
      return list;
    });
    // active chat append + mark read
    if (activeRef.current === msg.sender_id) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        msgsRef.current = next;
        return next;
      });
      if (msg.recipient_id === me) {
        void markRead(me, msg.sender_id);
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, []);

  useEffect(() => {
    if (!meIdRef.current) return;
    const sub = subscribeMessages(meIdRef.current, onIncoming);
    subCleanup.current = sub;
    return () => subCleanup.current?.unsubscribe();
  }, [onIncoming]);

  // load active conversation messages
  const openConversation = useCallback(async (id: string, profiles: ProfileLite[]) => {
    activeRef.current = id;
    setActiveId(id);
    const me = meIdRef.current;
    // ensure target conversation exists (offline/new user bhi chat pane open kare)
    setConversations((prev) => {
      if (prev.some((c) => c.other.id === id)) return prev;
      const prof = profiles.find((p) => p.id === id);
      const entry: Conversation = {
        other:
          prof ||
          ({
            id,
            full_name: "User",
            role: null,
          } as ProfileLite),
        lastMessage: null,
        unread: 0,
        presence: presenceMap[id] || null,
      };
      const next = [entry, ...prev];
      convRef.current = next;
      return next;
    });
    setMessages([]);
    msgsRef.current = [];
    const history = await fetchMessages(me, id);
    setMessages(history);
    msgsRef.current = history;
    void markRead(me, id);
    // clear unread locally
    setConversations((prev) =>
      prev.map((c) => (c.other.id === id ? { ...c, unread: 0 } : c))
    );
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
    // URL sync (mobile back ke liye)
    try {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("to", id);
      window.history.replaceState(null, "", `/messages?${sp.toString()}`);
    } catch { /* ignore */ }
  }, [searchParams, presenceMap]);

  // todo: on first load if URL has ?to=, open it after profiles load
  useEffect(() => {
    const to = searchParams.get("to");
    if (to && profiles.length && meIdRef.current && !activeId) {
      if (profiles.some((p) => p.id === to)) {
        void openConversation(to, profiles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    const other = activeRef.current;
    if (!other) return;
    setSending(true);
    const text = draft;
    setDraft("");
    // optimistic append
    const temp: Message = {
      id: -Date.now(),
      sender_id: meIdRef.current,
      recipient_id: other,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => {
      const next = [...prev, temp];
      msgsRef.current = next;
      return next;
    });
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    const res = await sendMessage(meIdRef.current, other, meName, text);
    if (!res.ok) {
      // rollback + show inline error
      setMessages(msgsRef.current.filter((m) => m.id !== temp.id));
      setSendErr(res.error || "Message bhejna fail hua");
      setTimeout(() => setSendErr(null), 4000);
    }
    setSending(false);
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      !conversations.some((c) => c.other.id === p.id) &&
      (p.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeConv = conversations.find((c) => c.other.id === activeId);

  if (loading) return <PageLoader icon={MessageSquare} label="Loading Messages" />;
  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-rose-400 text-sm">
          <Inbox className="mx-auto mb-3" size={40} />
          {loadErr}
          <p className="mt-2 text-slate-500 text-xs">Thodi der baad dubara try karo.</p>
        </div>
      </div>
    );
  }
  if (notFound && !isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-slate-400 text-sm">
          <Inbox className="mx-auto mb-3" size={40} />
          Koi aur staff/admin registered nahi hai — messenger sirf staff/admin ke beech chat ke liye hai.
        </div>
      </div>
    );
  }

  // ── Chat pane ──────────────────────────────────────────────────────
  const chatPane = activeId && activeConv ? (
    <div className="flex-1 flex flex-col min-h-0 border-l border-white/5">
      {/* header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5 bg-white/[0.02]">
        {isMobile && (
          <button
            onClick={() => {
              activeRef.current = null;
              setActiveId(null);
              try {
                const sp = new URLSearchParams(searchParams.toString());
                sp.delete("to");
                window.history.replaceState(null, "", `/messages${sp.toString()}`);
              } catch { /* ignore */ }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/[0.06]"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="relative">
          <div
            className={`w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-sm`}
          >
            {avatarInitial(activeConv.other.full_name)}
          </div>
          {isOnline(activeConv.presence) && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0d1117]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-100 truncate">
            {activeConv.other.full_name || "User"}
          </p>
          <p
            className={`text-[10px] font-semibold ${
              isOnline(activeConv.presence) ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            {isOnline(activeConv.presence)
              ? "Online"
              : activeConv.presence
                ? `Last seen ${lastSeenText(activeConv.presence)}`
                : "Offline"}
          </p>
        </div>
      </div>
      {/* messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-slate-500 text-xs pt-10">
            Abhi koi message nahi — pehla message bhejo
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meIdRef.current;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                  mine
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white/[0.06] text-slate-100 rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div
                  className={`flex items-center gap-1 mt-1 text-[9px] ${
                    mine ? "text-blue-200" : "text-slate-500"
                  }`}
                >
                  {fmtDay(m.created_at)}
                  {mine && (
                    <span className="flex items-center">
                      {m.read_at ? (
                        <CheckCheck size={11} />
                      ) : (
                        <span className="opacity-60">✓</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* input */}
      <div className="p-3 border-t border-white/5 bg-white/[0.02]">
        {sendErr && (
          <p className="mb-2 text-[11px] font-semibold text-rose-400 px-1">{sendErr}</p>
        )}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={`${activeConv.other.full_name || "User"} ko message likho…`}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-[#21293d] text-sm text-white outline-none focus:border-blue-500/60 placeholder:text-slate-600"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-all"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Conversation list pane ─────────────────────────────────────────
  const listPane = (
    <div className={`${isMobile && chatPane ? "hidden" : "flex"} flex-col h-full min-h-0 flex-1`}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-black text-slate-100 flex items-center gap-2">
          <MessageSquare size={20} className="text-blue-400" />
          Messages
        </h1>
        <div className="relative mt-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1117] border border-[#21293d] text-sm text-white outline-none focus:border-blue-500/60 placeholder:text-slate-600"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-4">
        {conversations.map((c) => {
          const on = isOnline(c.presence);
          const active = c.other.id === activeId;
          return (
            <button
              key={c.other.id}
              onClick={() => void openConversation(c.other.id, profiles)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                active ? "bg-blue-600/15" : "hover:bg-white/[0.04]"
              }`}
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-sm">
                  {avatarInitial(c.other.full_name)}
                </div>
                {on && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0d1117]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {c.other.full_name || "User"}
                  </p>
                  {c.lastMessage && (
                    <span className="text-[9px] text-slate-500 flex-shrink-0 ml-2">
                      {fmtDay(c.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-slate-500 truncate flex-1">
                    {c.lastMessage
                      ? `${c.lastMessage.sender_id === meIdRef.current ? "You: " : ""}${c.lastMessage.content}`
                      : "Koi message nahi"}
                  </p>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* filtered user to start new chat */}
        {filteredProfiles.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
              New chat
            </div>
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => void openConversation(p.id, profiles)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm">
                  {avatarInitial(p.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-100 truncate">
                    {p.full_name || "User"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{p.role || "staff"} • Start chat</p>
                </div>
              </button>
            ))}
          </>
        )}

        {conversations.length === 0 && filteredProfiles.length === 0 && (
          <div className="px-6 py-16 text-center text-slate-500">
            <Inbox className="mx-auto mb-3" size={36} />
            <p className="text-sm">Koi user nahi mila</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Responsive layout ──────────────────────────────────────────────
  if (isMobile) {
    // mobile: list ya chat (ek time par ek)
    return (
      <div className="h-[calc(100vh-3.5rem)] flex">
        {chatPane ? chatPane : listPane}
      </div>
    );
  }
  // desktop: dono panes
  return (
    <div className="h-[calc(100vh-3.5rem)] max-w-6xl mx-auto w-full flex">
      <div className="w-80 flex-shrink-0 border-r border-white/5">{listPane}</div>
      {chatPane || (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          <div className="text-center">
            <MessageSquare className="mx-auto mb-3" size={40} />
            Baat-cheet shuru karne ke liye left me kisi user ko select karo
          </div>
        </div>
      )}
    </div>
  );
}
