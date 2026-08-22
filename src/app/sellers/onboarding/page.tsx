import { Suspense } from "react";
import OnboardingClient from "@/components/sellers/OnboardingClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <OnboardingClient />
    </Suspense>
  );
}
