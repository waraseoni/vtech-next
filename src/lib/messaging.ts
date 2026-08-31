import { supabase } from "@/lib/supabase";

// ─── Messaging helpers (1-on-1 staff chat) ────────────────────────────────
// `messages` table (id, sender_id, recipient_id, content, read_at, created_at)
// + Realtime par live. Presence `user_presence` se. Push `/api/messages/push`.
// ─────────────────────────────────────────────────────────────────────────────

export type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
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

// conversations — meri saari baat-cheetein (other-user + last msg + unread + presence).
export async function fetchConversations(
  me: string,
  profiles: ProfileLite[],
  presenceMap: Record<string, Presence>
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, created_at, read_at")
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
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
  // sirf unhike liye jo profiles list me milte hain — apna (me) + unknown profile
  // skip (warna truncated-UUID gibberish name dikhta).
  for (const [id, p] of Object.entries(presenceMap)) {
    if (id === me) continue;
    if (map.has(id)) continue;
    const prof = profiles.find((x) => x.id === id);
    if (!prof) continue;
    map.set(id, {
      other: prof,
      lastMessage: null,
      unread: 0,
      presence: p,
    });
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
    .select("id, sender_id, recipient_id, content, created_at, read_at")
    .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as Message[]) || [];
}

// send — message insert + recipient ko push. sender bhi khud fire kare based on
// sender's own write policy (sender khud hi insert kar sakta hai).
export async function sendMessage(
  me: string,
  other: string,
  myName: string,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Message khali hai" };
  const { error } = await supabase.from("messages").insert({
    sender_id: me,
    recipient_id: other,
    content: text,
  });
  if (error) return { ok: false, error: error.message };
  // recipient ko push (best-effort, fail to ignore)
  try {
    void fetch("/api/messages/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: other, senderName: myName, content: text }),
    }).catch(() => {});
  } catch {
    // ignore
  }
  return { ok: true };
}

// markIncomingRead — me jo messages recipient hoon, unhe read kar do.
export async function markRead(me: string, other: string): Promise<void> {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", me)
    .eq("sender_id", other)
    .is("read_at", null);
}

// realtime messages subscription — naye message par cb(msg).
export function subscribeMessages(
  me: string,
  cb: (msg: Message) => void
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
          cb(payload.new as Message);
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

// presence helpers
export function isOnline(p: Presence | null | undefined, now = Date.now()): boolean {
  if (!p) return false;
  if (p.status !== "online") return false;
  const last = new Date(p.last_seen).getTime();
  // 2 min se zyada purana heartbeat = off reasoning
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
