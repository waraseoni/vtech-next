import { X, Send } from "lucide-react";

type WaType = "welcome" | "reminder" | "followup" | "offer" | "custom";

type WhatsAppModalProps = {
  waModal: boolean;
  setWaModal: (v: boolean) => void;
  waClient: { name: string } | null;
  waMsgType: WaType;
  handleWaTypeChange: (t: WaType) => void;
  waText: string;
  setWaText: (v: string) => void;
  sendWhatsApp: () => void;
};

export function WhatsAppModal({ waModal, setWaModal, waClient, waMsgType, handleWaTypeChange, waText, setWaText, sendWhatsApp }: WhatsAppModalProps) {
  if (!waModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
          <h3 className="font-bold text-white">Send WhatsApp to {waClient?.name}</h3>
          <button onClick={() => setWaModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"><X size={16}/></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["welcome","reminder","followup","offer","custom"] as const).map(type => (
              <button key={type} onClick={() => handleWaTypeChange(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${waMsgType === type ? "bg-blue-600 border-blue-600 text-white" : "border-[#21293d] text-slate-400 hover:bg-[#1e2637]"}`}>
                {type}
              </button>
            ))}
          </div>
          <textarea value={waText} onChange={(e) => setWaText(e.target.value)} rows={8}
            className="w-full p-3 bg-[#0d1117] border border-[#21293d] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500 transition"/>
        </div>
        <div className="p-4 border-t border-[#21293d] flex justify-end">
          <button onClick={sendWhatsApp} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm transition">
            <Send size={14}/> Send
          </button>
        </div>
      </div>
    </div>
  );
}