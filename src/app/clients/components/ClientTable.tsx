import { Edit3, Trash2, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBalanceMeta, inr } from "./helpers";

type SortField = "name" | "balance" | "total_paid" | "date_created";
type Client = {
  id: number; name: string; contact: string; email: string; address: string;
  balance: number; last_txn_date: string | null; total_paid: number; date_created: string;
};
type ClientTableProps = {
  paginatedClients: Client[];
  sortField: string;
  toggleSort: (f: SortField) => void;
  SortIcon: (props: { field: SortField }) => ReactNode;
  userRole: string;
  handleDelete: (id: number, name: string) => void;
  openWaModal: (client: Client) => void;
};

export function ClientTable({ paginatedClients, toggleSort, SortIcon, userRole, handleDelete, openWaModal }: ClientTableProps) {
  return (
    <div className="hidden md:block bg-[#161b27] border border-[#21293d] rounded-2xl overflow-x-auto">
      <table className="w-full min-w-[1200px]">
        <thead>
          <tr className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-[#21293d]">
            <th className="px-4 py-3 text-left flex items-center cursor-pointer" onClick={()=>toggleSort("name")}>Name <SortIcon field="name"/></th>
            <th className="px-4 py-3 text-left">Contact</th>
            <th className="px-4 py-3 text-right cursor-pointer" onClick={()=>toggleSort("balance")}>Balance <SortIcon field="balance"/></th>
            <th className="px-4 py-3 text-right cursor-pointer" onClick={()=>toggleSort("total_paid")}>Total Paid <SortIcon field="total_paid"/></th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-left cursor-pointer" onClick={()=>toggleSort("date_created")}>Created <SortIcon field="date_created"/></th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#21293d]">
          {paginatedClients.map((client) => {
            const meta = getBalanceMeta(client.balance, client.last_txn_date);
            return (
              <tr key={client.id} className={`hover:bg-white/5 transition-colors ${meta.rowCls}`}>
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}/view`} className="font-bold text-white hover:text-blue-400 transition no-underline">
                    {client.name}
                  </Link>
                  <p className="text-slate-500 text-xs mt-0.5">ID: {client.id}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-300 font-medium">{client.contact}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{client.email}</p>
                </td>
                <td className={`px-4 py-3 text-right font-bold ${client.balance > 0 ? "text-red-400" : "text-emerald-400"}`}>{inr(client.balance)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-300">{inr(client.total_paid)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-extrabold px-2 py-1 rounded border ${meta.badge}`}>{meta.label}</span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm">{new Date(client.date_created).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={()=>openWaModal(client)} className="p-1.5 text-slate-500 hover:text-green-400 transition"><MessageCircle size={14}/></button>
                    <Link href={`/clients/${client.id}/edit`} className="p-1.5 text-slate-500 hover:text-blue-400 transition"><Edit3 size={14}/></Link>
                    {userRole === "admin" && <button onClick={()=>handleDelete(client.id, client.name)} className="p-1.5 text-slate-500 hover:text-red-400 transition"><Trash2 size={14}/></button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}