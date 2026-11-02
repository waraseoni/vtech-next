import { Suspense } from "react";
import { MessageSquare } from "lucide-react";
import MessagesClient from "./client";
import PageLoader from "@/components/PageLoader";
import { loadStaffSeed } from "@/lib/server-seed";
import { fetchMessagesSeed } from "./messagesSeed";

export const metadata = {
  title: "Messages",
};

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  // Conversation directory (profiles + presence + last messages) server par
  // seed hota hai; `?to=` wali chat history pehle jaise client fetch karta hai.
  const initial = await loadStaffSeed("Messages", (supabase) => fetchMessagesSeed(supabase));

  return (
    <Suspense fallback={<PageLoader icon={MessageSquare} label="Loading Messages" />}>
      <MessagesClient initial={initial} />
    </Suspense>
  );
}
