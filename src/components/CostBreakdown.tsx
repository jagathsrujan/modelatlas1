"use client";

export function CostBreakdown({ lines, total, horizonNote }: { lines: Array<{ label: string; amount: number; currency: string }>; total?: number; horizonNote?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="bg-zinc-900 px-4 py-2 text-xs font-semibold text-white">Direct-cost breakdown</div>
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="pb-2 font-medium">Line item</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-t border-dashed">
                <td className="py-2.5 pr-3 text-xs leading-4 text-zinc-700">{l.label}</td>
                <td className="py-2.5 text-right text-xs font-medium text-zinc-900">
                  {l.currency} {l.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {total !== undefined && (
              <tr className="border-t bg-zinc-50">
                <td className="py-3 text-sm font-semibold text-zinc-900">Landed / total direct (horizon)</td>
                <td className="py-3 text-right text-sm font-bold text-zinc-900">
                  {lines[0]?.currency ?? "INR"} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {horizonNote && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{horizonNote}</div>}
        <div className="mt-2 text-xs leading-5 text-zinc-500">Staff, maintenance, support, office space and opportunity cost are <span className="font-medium text-zinc-700">EXCLUDED</span> — see risks & limitations.</div>
        <div className="mt-1 text-[11px] leading-4 text-zinc-400">landed_total = item_price + shipping + tax + import_duty + brokerage — kept separate in UI per spec.</div>
      </div>
    </div>
  );
}
