import { X, Send } from "lucide-react";

type WaType = "welcome" | "reminder" | "followup" | "offer" | "greeting" | "custom";

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

export function WhatsAppModal({
  waModal,
  setWaModal,
  waClient,
  waMsgType,
  handleWaTypeChange,
  waText,
  setWaText,
  sendWhatsApp,
}: WhatsAppModalProps) {
  if (!waModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-panel border border-app-2 dark:border-app rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-app-2 dark:border-app bg-slate-50 dark:bg-panel">
          <h3 className="font-bold text-app dark:text-white">
            Send WhatsApp to {waClient?.name}
          </h3>
          <button
            onClick={() => setWaModal(false)}
            className="p-1.5 rounded-lg text-muted hover:text-app dark:hover:text-white hover:bg-panel-2 dark:hover:bg-white/10 transition"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["welcome", "reminder", "followup", "offer", "greeting", "custom"] as const).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => handleWaTypeChange(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${waMsgType === type ? "bg-blue-600 border-blue-600 !text-white" : "border-app-2 dark:border-app text-muted-2 dark:text-muted hover:bg-panel-2 dark:hover:bg-panel-2"}`}
                >
                  {type}
                </button>
              )
            )}
          </div>
          <textarea
            value={waText}
            onChange={(e) => setWaText(e.target.value)}
            rows={8}
            className="w-full p-3 bg-slate-50 dark:bg-app border border-app-2 dark:border-app rounded-xl text-sm text-app dark:text-app-2 placeholder:text-muted dark:placeholder:text-muted-2 outline-none focus:border-blue-500 transition"
          />
        </div>
        <div className="p-4 border-t border-app-2 dark:border-app bg-slate-50 dark:bg-panel-2 flex justify-end">
          <button
            onClick={sendWhatsApp}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 !text-white rounded-xl font-bold text-sm transition shadow-sm"
          >
            <Send size={14} className="!text-white" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
