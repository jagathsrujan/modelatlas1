"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

const TASKS = [
  "text-generation",
  "image-text-to-text",
  "text-to-image",
  "image-classification",
  "automatic-speech-recognition",
  "text-to-speech",
  "object-detection",
  "fill-mask",
  "question-answering",
  "summarization",
  "translation",
  "feature-extraction",
  "sentence-similarity",
  "text-classification",
  "token-classification",
  "audio-classification",
  "image-segmentation",
  "depth-estimation",
];

const MORE_TASKS_COUNT = 44; // placeholder for HF's +44

const LIBRARIES: Array<{ id: string; label: string }> = [
  { id: "transformers", label: "Transformers" },
  { id: "pytorch", label: "PyTorch" },
  { id: "tensorflow", label: "TensorFlow" },
  { id: "jax", label: "JAX" },
  { id: "diffusers", label: "Diffusers" },
  { id: "gguf", label: "GGUF" },
  { id: "mlx", label: "MLX" },
  { id: "safetensors", label: "Safetensors" },
];

const LICENSES = [
  { id: "mit", label: "MIT" },
  { id: "apache-2.0", label: "Apache 2.0" },
  { id: "cc-by-4.0", label: "CC BY 4.0" },
  { id: "cc-by-nc-4.0", label: "CC BY-NC 4.0" },
  { id: "gpl-3.0", label: "GPL-3.0" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
  { id: "zh", label: "Chinese" },
  { id: "ja", label: "Japanese" },
  { id: "hi", label: "Hindi" },
];

const PARAM_BUCKETS = [
  { label: "<1B", value: "0-1B" },
  { label: "1B–6B", value: "1-6B" },
  { label: "6B–12B", value: "6-12B" },
  { label: "12B–32B", value: "12-32B" },
  { label: "32B–128B", value: "32-128B" },
  { label: ">500B", value: "500B+" },
];

function useFilterToggle(param: string) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get(param);

  const toggle = useCallback(
    (value: string) => {
      const next = new URLSearchParams(sp.toString());
      if (current === value) {
        next.delete(param);
      } else {
        next.set(param, value);
      }
      next.delete("page");
      const qs = next.toString();
      router.push(`/catalog${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [sp, router, param, current]
  );

  const setMulti = useCallback(
    (value: string) => {
      const next = new URLSearchParams(sp.toString());
      const existing = next.get(param);
      // library may be comma-separated; toggle inclusion
      const parts = existing ? existing.split(",") : [];
      const idx = parts.indexOf(value);
      if (idx >= 0) parts.splice(idx, 1);
      else parts.push(value);
      if (parts.length === 0) next.delete(param);
      else next.set(param, parts.join(","));
      next.delete("page");
      router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [sp, router, param]
  );

  return { current, toggle, setMulti };
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-200 py-4 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
        <span className="text-zinc-400 text-sm">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export function FilterSidebar() {
  const router = useRouter();
  const sp = useSearchParams();
  const { current: task } = useFilterToggle("task");
  const [showAllTasks, setShowAllTasks] = useState(false);
  const visibleTasks = showAllTasks ? TASKS : TASKS.slice(0, 6);

  const getMultiActive = (param: string, value: string) => {
    const v = sp.get(param);
    if (!v) return false;
    return v.split(",").includes(value);
  };

  const toggleMulti = (param: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    const existing = next.get(param);
    const parts = existing ? existing.split(",") : [];
    const idx = parts.indexOf(value);
    if (idx >= 0) parts.splice(idx, 1);
    else parts.push(value);
    if (parts.length === 0) next.delete(param);
    else next.set(param, parts.join(","));
    next.delete("page");
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const toggleTask = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (next.get("task") === value) next.delete("task");
    else next.set("task", value);
    next.delete("page");
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const clearAll = () => {
    router.push("/catalog", { scroll: false });
  };

  const hasActive = sp.toString().length > 0;

  return (
    <aside className="w-full shrink-0 lg:w-[240px] lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 lg:pr-4">
      <div className="flex items-center justify-between py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Filters</span>
        {hasActive && (
          <button onClick={clearAll} className="text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">
            Clear
          </button>
        )}
      </div>

      {/* Tasks */}
      <Section title="Tasks">
        <div className="space-y-1.5">
          {visibleTasks.map((t) => {
            const active = task === t;
            return (
              <label key={t} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm ${active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleTask(t)}
                  className="h-3.5 w-3.5 rounded border-zinc-300"
                />
                <span className="truncate text-[13px]">{t}</span>
              </label>
            );
          })}
        </div>
        {!showAllTasks && (
          <button onClick={() => setShowAllTasks(true)} className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
            +{MORE_TASKS_COUNT} more
          </button>
        )}
        {showAllTasks && (
          <button onClick={() => setShowAllTasks(false)} className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400">
            Show less
          </button>
        )}
      </Section>

      {/* Parameters slider */}
      <Section title="Parameters">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Filter by model size (safetensors.total)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PARAM_BUCKETS.map((b) => (
            <button
              key={b.value}
              onClick={() => {
                // client-side hint: we don't have server filter, but we push to URL for shareability
                const next = new URLSearchParams(sp.toString());
                if (next.get("params") === b.value) next.delete("params");
                else next.set("params", b.value);
                router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
              }}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${sp.get("params") === b.value ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Excludes models with unknown size.</p>
      </Section>

      {/* Libraries */}
      <Section title="Libraries">
        <div className="space-y-1.5">
          {LIBRARIES.map((lib) => {
            const active = getMultiActive("library", lib.id);
            return (
              <label key={lib.id} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm ${active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                <input type="checkbox" checked={active} onChange={() => toggleMulti("library", lib.id)} className="h-3.5 w-3.5 rounded border-zinc-300" />
                <span className="text-[13px]">{lib.label}</span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* Licenses */}
      <Section title="Licenses">
        <div className="space-y-1.5">
          {LICENSES.map((lic) => {
            const active = getMultiActive("license", lic.id);
            return (
              <label key={lic.id} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm ${active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                <input type="checkbox" checked={active} onChange={() => toggleMulti("license", lic.id)} className="h-3.5 w-3.5 rounded border-zinc-300" />
                <span className="text-[13px]">{lic.label}</span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* Languages */}
      <Section title="Languages">
        <div className="space-y-1.5">
          {LANGUAGES.map((l) => {
            const active = getMultiActive("language", l.id);
            return (
              <label key={l.id} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm ${active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                <input type="checkbox" checked={active} onChange={() => toggleMulti("language", l.id)} className="h-3.5 w-3.5 rounded border-zinc-300" />
                <span className="text-[13px]">{l.label}</span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* Apps */}
      <Section title="Apps" defaultOpen={false}>
        <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">vLLM</span> <span className="text-[11px] text-zinc-400">(soon)</span>
          </label>
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">llama.cpp</span> <span className="text-[11px] text-zinc-400">(soon)</span>
          </label>
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">MLX</span> <span className="text-[11px] text-zinc-400">(soon)</span>
          </label>
        </div>
      </Section>

      {/* Inference Providers */}
      <Section title="Inference Providers" defaultOpen={false}>
        <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">Groq</span>
          </label>
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">Together</span>
          </label>
          <label className="flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded px-1 py-1 text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" disabled className="h-3.5 w-3.5" /> <span className="text-[13px]">Fireworks</span>
          </label>
        </div>
      </Section>

      {/* Hardware */}
      <Section title="Hardware" defaultOpen={false}>
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          Hardware filters coming soon — use <span className="font-medium">Inventory</span> to check VRAM fit.
        </div>
      </Section>
    </aside>
  );
}
