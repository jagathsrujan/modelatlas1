"use client";

export const WIZARD_STORAGE_KEY = "modelatlas:wizard:v1";

// 7-step wizard across 3 routes
// 1 intake (explore/new?step=1)
// 2 confirm workload (explore/new?step=2)
// 3 hardware (explore/profiles/[id]?step=3)
// 4 preference (explore/profiles/[id]?step=4)
// 5 primary (recommendations/[id]?step=5)
// 6 compare (recommendations/[id]?step=6)
// 7 final (recommendations/[id]?step=7)

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WizardDraft {
  rawInput: string;
  transcript: string;
  workloadId?: string;
  // steps completed up to N (e.g., 2 means steps 1 and 2 done)
  completedUpTo: number; // 0..7
  selectedCandidate?: string;
  // for hardware step we track that hardware was confirmed at least once
  hardwareConfirmed: boolean;
  presetConfirmed: boolean;
}

export function loadDraft(): WizardDraft {
  if (typeof window === "undefined") return { rawInput: "", transcript: "", completedUpTo: 0, hardwareConfirmed: false, presetConfirmed: false };
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return { rawInput: "", transcript: "", completedUpTo: 0, hardwareConfirmed: false, presetConfirmed: false };
    return JSON.parse(raw) as WizardDraft;
  } catch {
    return { rawInput: "", transcript: "", completedUpTo: 0, hardwareConfirmed: false, presetConfirmed: false };
  }
}

export function saveDraft(patch: Partial<WizardDraft>) {
  if (typeof window === "undefined") return;
  const cur = loadDraft();
  const next = { ...cur, ...patch };
  try { sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(next)); } catch {}
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(WIZARD_STORAGE_KEY); } catch {}
}

export function clampStep(requested: number, completedUpTo: number, fallback: WizardStep): WizardStep {
  // allow revisiting completed steps, but block future beyond completedUpTo+1
  if (requested <= completedUpTo + 1 && requested >= 1 && requested <= 7) return requested as WizardStep;
  // if requesting future locked, clamp to next allowed
  const maxAllowed = Math.min(7, completedUpTo + 1) as WizardStep;
  if (requested > maxAllowed) return maxAllowed;
  if (requested < 1) return 1 as WizardStep;
  return fallback;
}

export const STEP_META: Record<WizardStep, { label: string; route: string }> = {
  1: { label: "Describe the work", route: "/explore/new" },
  2: { label: "Confirm workload", route: "/explore/new" },
  3: { label: "Confirm hardware", route: "/explore/profiles/[id]" },
  4: { label: "Choose preference", route: "/explore/profiles/[id]" },
  5: { label: "Review primary", route: "/recommendations/[id]" },
  6: { label: "Compare alternatives", route: "/recommendations/[id]" },
  7: { label: "Final review", route: "/recommendations/[id]" },
};
