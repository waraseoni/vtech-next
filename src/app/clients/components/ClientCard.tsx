import { Phone, Edit3, Trash2, MessageCircle } from "lucide-react";
import Link from "next/link";
import { getBalanceMeta } from "./helpers";

type Client = {
  id: number; name: string; contact: string; address: string;
  balance: number; last_txn_date: string | null;
};
type ClientCardProps = {
  client: Client;
  userRole: string;
  handleDelete: (id: number, name: string) => void;
  openWaModal: (client: Client) => void;
};

export function ClientCard({ client, userRole, handleDelete, openWaModal }: ClientCardProps) {
  const meta = getBalanceMeta(client.balance, client.last_txn_date);
  return (
    <div key={client.id} className={`bg-[#161b27] rounded-2xl border border-[#21293d] overflow-hidden ${meta.rowCls}`}>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link href={`/clients/${client.id}/view`}
              className="font-black text-white text-base no-underline hover:text-blue-400 transition leading-tight block">
              {client.name}
            </Link>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-slate-600 text-[10px] font-bold">#{client.id}</span>
              {client.contact&&<span className="text-slate-400 text-[10px] font-bold flex items-center gap-0.5"><Phone size={9}/>{client.contact}</span>}
            </div>
          </div>
          <span className={`text-[9px] font-extrabold px-2 py-1 rounded border ${meta.badge} flex-shrink-0`}>{meta.label}</span>
        </div>
        {client.address&&<p className="text-slate-500 text-xs">{client.address}</p>}
      </div>
      <div className="bg-black/20 px-4 py-3 flex items-center justify-between">
        <div className="text-xs">
          <span className="text-slate-500">Balance: </span>
          <span className={`font-bold ${client.balance > 0 ? "text-red-400" : "text-emerald-400"}`}>{client.balance}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>openWaModal(client)} className="p-1.5 text-slate-500 hover:text-green-400 transition"><MessageCircle size={14}/></button>
          <Link href={`/clients/${client.id}/edit`} className="p-1.5 text-slate-500 hover:text-blue-400 transition"><Edit3 size={14}/></Link>
          {userRole === "admin" && <button onClick={()=>handleDelete(client.id, client.name)} className="p-1.5 text-slate-500 hover:text-red-400 transition"><Trash2 size={14}/></button>}
        </div>
      </div>
    </div>
  );
}