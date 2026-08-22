import { Suspense } from "react";
import SellerDashboardClient from "@/components/sellers/SellerDashboardClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading dashboard…</div>}>
      <SellerDashboardClient />
    </Suspense>
  );
}
