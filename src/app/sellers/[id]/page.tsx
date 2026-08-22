import { Suspense } from "react";
import SellerProfileClient from "@/components/sellers/SellerProfileClient";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading profile…</div>}>
      <SellerProfileClient sellerId={id} demo={sp?.demo === "true"} />
    </Suspense>
  );
}
