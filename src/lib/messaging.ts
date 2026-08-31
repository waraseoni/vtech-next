import { supabase } from "@/lib/supabase";

// ─── Messaging helpers (1-on-1 staff chat) ────────────────────────────────
// `messages` table (id, sender_id, recipient_id, content, read_at, delivered_at,
// media_url, media_type, media_name, deleted_at, created_at)
// + Realtime par live. Presence `user_presence` se. Push `/api/messages/push`.
// ─────────────────────────────────────────────────────────────────────────────

export type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  delivered_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  media_name?: string | null;
  deleted_at?: string | null;
  created_at: string;
};

export type Presence = { status: string; last_seen: string };

export type ProfileLite = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
  mechanic_name?: string | null;
};

export type Conversation = {
  other: ProfileLite;
  lastMessage: Message | null;
  unread: number;
  presence: Presence | null;
};

const MSG_COLS = "id, sender_id, recipient_id, content, read_at, delivered_at, media_url, media_type, media_name, deleted_at, created_at";

// conversations — meri saari baat-cheetein (other-user + last msg + unread + presence).
export async function fetchConversations(
  me: string,
  profiles: ProfileLite[],
  presenceMap: Record<string, Presence>
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return [];

  const map = new Map<string, Conversation>();
  for (const m of (data as Message[]) || []) {
    const otherId = m.sender_id === me ? m.recipient_id : m.sender_id;
    let conv = map.get(otherId);
    if (!conv) {
      conv = {
        other: profiles.find((p) => p.id === otherId) || {
          id: otherId,
          full_name: otherId.slice(0, 8),
          role: null,
        },
        lastMessage: null,
        unread: 0,
        presence: presenceMap[otherId] || null,
      };
      map.set(otherId, conv);
    }
    if (!conv.lastMessage) conv.lastMessage = m;
    if (m.recipient_id === me && !m.read_at) conv.unread += 1;
  }

  // presence unread-profile me bhi dal do jo messages-khali hain
  for (const [id, p] of Object.entries(presenceMap)) {
    if (id === me) continue;
    if (map.has(id)) continue;
    const prof = profiles.find((x) => x.id === id);
    if (!prof) continue;
    map.set(id, { other: prof, lastMessage: null, unread: 0, presence: p });
  }

  return [...map.values()].sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
    return tb - ta;
  });
}

// message history between me and otherUser (ascending — oldest se newest).
export async function fetchMessages(me: string, other: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as Message[]) || [];
}

// supervise tool ke liye — kisi bhi do users ke beech messages fetch karo.
// (Admin/developer ke liye RLS select policy me exception hai; staff ise use nahi kar sakta.)
export async function fetchPairMessages(a: string, b: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .or(`and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as Message[]) || [];
}

// send — message insert + recipient ko push.
export async function sendMessage(
  me: string,
  other: string,
  myName: string,
  content: string,
  media?: { url: string; type: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  const text = content.trim();
  if (!text && !media) return { ok: false, error: "Message khali hai" };
  // DB me `content` not-null + non-empty check hai — media-only message me bhi
  // koi placeholder rakho taaki insert fail na ho (bubble me chhupa dete hain).
  const storedContent = text || media?.name || "Media attachment";
  const { error } = await supabase.from("messages").insert({
    sender_id: me,
    recipient_id: other,
    content: storedContent,
    media_url: media?.url || null,
    media_type: media?.type || null,
    media_name: media?.name || null,
  });
  if (error) return { ok: false, error: error.message };
  try {
    void fetch("/api/messages/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: other,
        senderName: myName,
        content: text || (media?.name ? "📎 " + media.name : "Media"),
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
  return { ok: true };
}

// delivered mark — recipient ne message receive kar liya (double tick).
export async function markDelivered(me: string, other: string): Promise<void> {
  await supabase
    .from("messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("recipient_id", me)
    .eq("sender_id", other)
    .is("delivered_at", null);
}

// markRead — delivered + read (blue double tick).
export async function markRead(me: string, other: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("messages")
    .update({ read_at: now, delivered_at: now })
    .eq("recipient_id", me)
    .eq("sender_id", other)
    .is("read_at", null);
}

// current user ka auth UUID (sidebar badge subscription ke liye).
export async function getMyId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// unread total (sidebar badge ke liye) — mere recipient, koi bhi sender se.
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return error ? 0 : count || 0;
}

// realtime: INCOMING (recipient=me) INSERT + delivery/read UPDATE on my sent msgs.
export function subscribeMessages(
  me: string,
  cb: (msg: Message, action: "insert" | "update") => void
): { unsubscribe: () => void } {
  let chan: ReturnType<typeof supabase.channel> | null = null;
  let removed = false;
  try {
    chan = supabase
      .channel("vtech-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${me}`,
        },
        (payload) => {
          if (!payload.new) return;
          cb(payload.new as Message, "insert");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${me}`,
        },
        (payload) => {
          if (!payload.new) return;
          cb(payload.new as Message, "update");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${me}`,
        },
        (payload) => {
          if (!payload.old) return;
          cb({ ...(payload.old as Message), deleted_at: new Date().toISOString() }, "update");
        }
      )
      .subscribe();
  } catch {
    chan = null;
  }
  return {
    unsubscribe: () => {
      if (chan && !removed) {
        removed = true;
        void supabase.removeChannel(chan);
        chan = null;
      }
    },
  };
}

// ─── Typing indicator (ephemeral realtime broadcast, koi table nahi) ────────
// Sender apni typing broadcast karta hai → recipient uske name ke saath
// "typing…" dikhata hai. Broadcast sirf DOOSRE clients ko milta hai (khud ko
// nahi), isliye sender ko khud ka filter karne ki zaroorat nahi. Par payload me
// kaun likh raha hai (from) bhejna zaroori hai — broadcast sender tag nahi karta.
function makeTypingChan(): ReturnType<typeof supabase.channel> {
  return supabase.channel("vtech-typing");
}

// Send ke liye ek persistent (ek-baar subscribe) typing channel.
// Har keystroke par naya throwaway channel banaane se `send()` REST par fallback
// ho jaata tha (deprecation warning) aur ab `httpSend()` broadcast receiver tak
// nahi pahuncha raha. Persistent joined channel websocket par hi broadcast karta
// hai — isliye delivery bhi hoti hai aur warning bhi nahi.
let sendChan: ReturnType<typeof supabase.channel> | null = null;
function typingSendChan(): ReturnType<typeof supabase.channel> {
  if (!sendChan) {
    sendChan = makeTypingChan();
    sendChan.subscribe();
  }
  return sendChan;
}

export function broadcastTyping(toUserId: string, fromUserId: string): void {
  try {
    void typingSendChan().send({
      type: "broadcast",
      event: "typing",
      payload: { to: toUserId, from: fromUserId },
    });
  } catch {
    // ignore
  }
}

export function subscribeTyping(
  me: string,
  cb: (fromUserId: string) => void
): () => void {
  let chan: ReturnType<typeof supabase.channel> | null = null;
  try {
    chan = makeTypingChan();
    chan.on("broadcast", { event: "typing" }, (payload) => {
      const to = payload.payload?.to as string | undefined;
      const from = payload.payload?.from as string | undefined;
      if (!to || !from) return;
      if (to === me) cb(from);
    });
    chan.subscribe();
  } catch {
    chan = null;
  }
  return () => {
    if (chan) {
      void supabase.removeChannel(chan);
      chan = null;
    }
  };
}

// ─── presence helpers ───────────────────────────────────────────────────────
export function isOnline(p: Presence | null | undefined, now = Date.now()): boolean {
  if (!p) return false;
  if (p.status !== "online") return false;
  const last = new Date(p.last_seen).getTime();
  return now - last <= 2 * 60 * 1000;
}

export function lastSeenText(p: Presence | null | undefined): string {
  if (!p) return "";
  const last = new Date(p.last_seen).getTime();
  const diff = Date.now() - last;
  if (diff < 60_000) return "abhi active";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min pehle`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)} hr pehle`;
  const d = new Date(p.last_seen);
  const day = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}
