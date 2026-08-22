export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 flex gap-6">
          <div className="hidden w-[240px] shrink-0 lg:block">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="h-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
