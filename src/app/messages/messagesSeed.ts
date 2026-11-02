import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `/messages` ka neutral server seed — client ke session/profile +
 * `fetchDirectory` (profiles + presence + conversations) ka read-only mirror.
 * `@/lib/messaging` client-only module hai (browser singleton import karta hai),
 * isliye yahan wahi queries inline ki gayi hain. Caller cookie+RLS client
 * pass karta hai — koi write nahi.
 */

export type SeedMessage = {
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

export type SeedPresence = { status: string; last_seen: string };

export type SeedProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
  mechanic_name?: string | null;
};

export type SeedConversation = {
  other: SeedProfile;
  lastMessage: SeedMessage | null;
  unread: number;
  presence: SeedPresence | null;
};

export type MessagesSeed = {
  me: { id: string; name: string; role: string };
  profiles: SeedProfile[];
  presenceMap: Record<string, SeedPresence>;
  conversations: SeedConversation[];
};

const MSG_COLS =
  "id, sender_id, recipient_id, content, read_at, delivered_at, media_url, media_type, media_name, deleted_at, created_at";

export async function fetchMessagesSeed(supabase: SupabaseClient): Promise<MessagesSeed> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const me = user.id;

  const [{ data: myP }, { data: profs, error: profErr }, { data: pres, error: presErr }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", me).maybeSingle(),
      supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .neq("id", me)
        .in("role", ["admin", "staff", "developer"])
        .order("full_name", { ascending: true }),
      supabase.from("user_presence").select("user_id, status, last_seen"),
    ]);

  if (profErr) throw profErr;

  const profiles = (profs || []) as SeedProfile[];

  const presenceMap: Record<string, SeedPresence> = {};
  (pres || []).forEach((r) => {
    presenceMap[r.user_id] = { status: r.status, last_seen: r.last_seen };
  });

  let conversations: SeedConversation[] = [];
  // Client bhi presence query fail par conversation list skip karta hai.
  if (!presErr) {
    // Mirror `fetchConversations`: mere saare messages (newest first).
    const { data, error } = await supabase
      .from("messages")
      .select(MSG_COLS)
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error) {
      const map = new Map<string, SeedConversation>();
      for (const m of (data as SeedMessage[]) || []) {
        const otherId = m.sender_id === me ? m.recipient_id : m.sender_id;
        let conv = map.get(otherId);
        if (!conv) {
          conv = {
            other:
              profiles.find((p) => p.id === otherId) ||
              ({
                id: otherId,
                full_name: otherId.slice(0, 8),
                role: null,
              } as SeedProfile),
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

      conversations = [...map.values()].sort((a, b) => {
        const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return tb - ta;
      });
    }
  }

  return {
    me: {
      id: me,
      name: myP?.full_name || user.email?.split("@")[0] || "Me",
      role: myP?.role || "",
    },
    profiles,
    presenceMap,
    conversations,
  };
}
