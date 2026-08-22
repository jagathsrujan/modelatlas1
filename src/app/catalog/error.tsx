"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">Something went wrong loading the catalog</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error.message || "Unknown error"}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
          <a href="/catalog?demo=true" className="ml-3 text-sm text-red-700 underline dark:text-red-300">
            Show curated demo
          </a>
        </div>
      </div>
    </div>
  );
}
