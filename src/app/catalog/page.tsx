import { Suspense } from "react";
import CatalogPage from "@/components/catalog/CatalogPage";

export const dynamic = "force-dynamic";

function CatalogFallback() {
  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Page({ searchParams }: PageProps<"/catalog">) {
  // Await searchParams to opt into dynamic rendering per Next 16 (searchParams is Promise)
  await searchParams;
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogPage />
    </Suspense>
  );
}
