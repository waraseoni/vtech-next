import {
  Clock,
  Gauge,
  HandCoins,
  IndianRupee,
  Phone,
  ShieldCheck,
  Trophy,
  Wrench,
} from "lucide-react";
import type { PublicIcon } from "@/lib/public-site-defaults";

export const PUBLIC_ICON_NODES: Record<PublicIcon, React.ReactNode> = {
  clock: <Clock size={20} />,
  wrench: <Wrench size={20} />,
  shield: <ShieldCheck size={20} />,
  gauge: <Gauge size={20} />,
  handcoins: <HandCoins size={20} />,
  indianrupee: <IndianRupee size={20} />,
  phone: <Phone size={20} />,
  trophy: <Trophy size={20} />,
};
