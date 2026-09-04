"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SupplierRow = { id: number; name: string };

/**
 * Shared supplier list hook — har jagah same source of truth.
 *
 *  • Mount par active suppliers fetch hoti hain (delete_flag=0, status=1).
 *  • `refresh()` call karo naya supplier add karne ke baad — list re-fetch hogi.
 *  • ProductFormModal, StockModal, CreatePOModal — teeno isi hook ka use karte hain.
 */
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("delete_flag", 0)
      .eq("status", 1)
      .order("name");
    setSuppliers((data || []) as SupplierRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, loading, refresh: fetchSuppliers };
}
