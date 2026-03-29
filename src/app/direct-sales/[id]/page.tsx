"use client";
import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function SaleRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    router.replace(`/direct-sales/${resolvedParams.id}/view`);
  }, [resolvedParams.id, router]);

  return null;
}
