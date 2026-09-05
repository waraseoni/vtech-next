import { Hourglass } from "lucide-react";

export default function WaitingPartsBadge({ count }: { count: number }) {
  if (!count || count < 1) return null;
  return (
    <span
      title="Required spare ka wait hai"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-black shrink-0"
    >
      <Hourglass size={9} /> {count}
    </span>
  );
}
