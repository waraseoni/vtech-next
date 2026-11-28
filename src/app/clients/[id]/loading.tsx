import PageLoader from "@/components/PageLoader";
import { Users } from "lucide-react";

// PERF (nav audit): `[id]` ke saare sub-routes (view/edit/add-payment/give-loan/
// collect-emi/ledger-print/add-direct-sale) isi boundary se instant skeleton
// paate hain. Pehle yahan koi loading.tsx nahi tha, isliye click ke baad router
// ko pura RSC response (auth + profiles + seed) ka wait karna padta tha —
// "click kiya par kuch nahi hua" wahi symptom tha.
export default function ClientDetailLoading() {
  return <PageLoader icon={Users} label="Loading client..." tone="blue" />;
}
