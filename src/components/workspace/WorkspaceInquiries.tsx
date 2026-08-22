"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { BuyerInquiry } from "@/lib/domain/types";

export default function WorkspaceInquiries({ workspaceId }: { workspaceId: string }) {
  const [inquiries, setInquiries] = useState<BuyerInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
    const params = isDemo ? "?demo=true" : "";
    fetch(`/api/inquiries${params}`)
      .then(async r => {
        if (!r.ok) return { inquiries: [] };
        const j = await r.json();
        return j;
      })
      .then(j => {
        // filter to only those whose workload_id belongs to this workspace? For demo, just show all buyer inquiries
        setInquiries(j.inquiries ?? []);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800 text-xs text-zinc-500">Loading inquiries…</div>;

  return (
    <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Inquiries — buyer connect</h3>
        <Link href={typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo") ? "/sellers?demo=true" : "/sellers"} className="text-xs font-medium text-[#F97316] hover:underline">Sellers directory →</Link>
      </div>
      {inquiries.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No inquiries yet. Connect with verified sellers from the <Link href="/sellers" className="underline">directory</Link> — pick a workload and send a structured brief.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {inquiries.slice(0,5).map(i => (
            <li key={i.id} className="flex items-center gap-2 rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
              <span className={`rounded-full px-2 py-0.5 text-xs border ${i.status==="pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{i.status}</span>
              <span className="text-xs truncate">{i.message.slice(0,60)}</span>
              <span className="ml-auto text-xs text-zinc-500">{i.seller_id.slice(0,6)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/dashboard/seller" className="mt-3 inline-block text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400">Manage in seller dashboard →</Link>
    </div>
  );
}
