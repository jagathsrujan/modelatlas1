import { Suspense } from "react";
import SellersClient from "@/components/sellers/SellersClient";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = sp?.q ?? "";
  const service_type = sp?.service_type ?? "";
  const region = sp?.region ?? "";
  const verifiedOnly = sp?.verifiedOnly ?? "true";
  // pass to client via searchParams reading client side, but also ensure server reads demo
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950 p-8 text-sm">Loading sellers…</div>}>
      <SellersClient initialFilters={{ q, service_type, region, verifiedOnly }} />
    </Suspense>
  );
}
