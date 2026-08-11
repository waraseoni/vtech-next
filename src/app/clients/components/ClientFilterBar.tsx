import { Search, SlidersHorizontal, RotateCcw, ArrowUp, ArrowDown } from "lucide-react";

type SortField = "name" | "balance" | "total_paid" | "date_created";
type TabFilter = "all" | "due" | "high" | "clear" | "followup";
type SortDir = "asc" | "desc";
type Client = {
  id: number; name: string; contact: string; email: string; address: string;
  balance: number; last_txn_date: string | null; total_paid: number; date_created: string;
};
type ClientFilterBarProps = {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  showFilter: boolean;
  setShowFilter: (v: boolean) => void;
  minBal: string;
  setMinBal: (v: string) => void;
  maxBal: string;
  setMaxBal: (v: string) => void;
  tabFilter: TabFilter;
  setTabFilter: (v: TabFilter) => void;
  sortField: SortField;
  toggleSort: (f: SortField) => void;
  sortDir: SortDir;
  filteredSortedClients: Client[];
  clients: Client[];
  TABS: { id: TabFilter; label: string; count: number; ac: string }[];
};

export function ClientFilterBar({ searchTerm, setSearchTerm, showFilter, setShowFilter, minBal, setMinBal, maxBal, setMaxBal, tabFilter, setTabFilter, sortField, toggleSort, sortDir, filteredSortedClients, clients, TABS }: ClientFilterBarProps) {
  return (
    <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4 space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab)=>( 
          <button key={tab.id} onClick={()=>setTabFilter(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wide border transition cursor-pointer ${
              tabFilter===tab.id?tab.ac:"border-[#21293d] text-slate-600 hover:bg-[#1e2637] hover:text-slate-400"
            }`}>
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${tabFilter===tab.id?"bg-white/10":"bg-[#1e2637] text-slate-600"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      {/* Search row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
          <input placeholder="Search name, mobile, email…" value={searchTerm}
            onChange={(e)=>setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl outline-none focus:border-blue-500 transition text-sm text-slate-200 placeholder:text-slate-700 font-medium"/>
        </div>
        <button onClick={()=>setShowFilter(!showFilter)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${showFilter?"bg-blue-600 border-blue-600 text-white":"bg-[#0d1117] border-[#21293d] text-slate-500 hover:bg-[#1e2637]"}`}>
          <SlidersHorizontal size={13}/> Filters
        </button>
        {(searchTerm||minBal||maxBal||tabFilter!=="all")&&(
          <button onClick={()=>{setSearchTerm("");setMinBal("");setMaxBal("");setTabFilter("all");}}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs border border-[#21293d] text-slate-600 hover:bg-[#1e2637] transition cursor-pointer">
            <RotateCcw size={11}/> Reset
          </button>
        )}
        {filteredSortedClients.length!==clients.length&&(
          <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-extrabold px-3 py-1.5 rounded-lg">
            {filteredSortedClients.length} results
          </span>
        )}
      </div>
      {/* Extended filters */}
      {showFilter&&(
        <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-[#21293d]">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Balance:</span>
          <input type="number" placeholder="Min ₹" value={minBal} onChange={(e)=>setMinBal(e.target.value)}
            className="w-24 px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold outline-none focus:border-blue-500 text-slate-300"/>
          <span className="text-slate-700">—</span>
          <input type="number" placeholder="Max ₹" value={maxBal} onChange={(e)=>setMaxBal(e.target.value)}
            className="w-24 px-3 py-2 bg-[#0d1117] border border-[#21293d] rounded-xl text-xs font-bold outline-none focus:border-blue-500 text-slate-300"/>
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-2">Sort:</span>
          {(["balance","name","total_paid","date_created"] as const).map(f=>(
            <button key={f} onClick={()=>toggleSort(f)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold border transition cursor-pointer ${sortField===f?"bg-blue-600 border-blue-600 text-white":"border-[#21293d] text-slate-500 hover:bg-[#1e2637]"}`}>
              {f==="balance"?"Balance":f==="name"?"Name":f==="total_paid"?"Paid":"Date"}
              {sortField===f&&(sortDir==="asc"?<ArrowUp size={9}/>:<ArrowDown size={9}/>)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}