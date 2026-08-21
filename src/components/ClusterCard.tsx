"use client";
import type { ClusterPlan } from "@/lib/domain/types";

const phrase: Record<string, string> = {
  single_node: "One machine handles it — lowest complexity",
  replicas: "Separate workers — full copy per machine (replicas)",
  sharded_inference: "One model split across nodes — sharded inference",
  distributed_training: "Distributed training / fine-tuning",
  staged_pipeline: "Staged pipeline — separate machines per stage",
  not_recommended: "Not recommended — benefit < burden",
};

const tone: Record<string, string> = {
  single_node: "bg-emerald-600",
  replicas: "bg-sky-600",
  sharded_inference: "bg-indigo-600",
  distributed_training: "bg-amber-600",
  staged_pipeline: "bg-zinc-700",
  not_recommended: "bg-zinc-500",
};

export function ClusterCard({ plan }: { plan: ClusterPlan }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className={`px-4 py-2 text-xs font-semibold text-white ${tone[plan.topology_type] ?? "bg-zinc-900"}`}>
        Cluster recommendation · <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[11px]">{plan.topology_type}</span>
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-zinc-900">{phrase[plan.topology_type] ?? plan.topology_type}</div>
        <p className="mt-1 text-sm leading-5 text-zinc-700">{plan.expected_benefit}</p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border bg-zinc-50 p-3 text-xs leading-5">
            <div className="font-semibold text-zinc-900">Machines & placement</div>
            <div className="mt-1 text-zinc-700">
              {plan.selected_asset_ids.length === 0 ? "— (see reasoning)" : plan.selected_asset_ids.join(" · ")}{" "}
              {plan.model_placement !== "not_applicable" && (
                <span className="rounded-full bg-white px-2 py-0.5 text-zinc-700 border">· {plan.model_placement === "full_copy_per_node" ? "full copy per node" : "split across nodes"}</span>
              )}
            </div>
            <div className="mt-2 grid gap-1 text-zinc-600">
              <div><span className="font-medium text-zinc-900">Runtime:</span> {plan.runtime_family ?? "—"}</div>
              <div><span className="font-medium text-zinc-900">Interconnect:</span> {plan.interconnect_requirement ?? "—"}</div>
              <div><span className="font-medium text-zinc-900">Orchestration:</span> {plan.orchestration_requirement ?? "—"}</div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-3 text-xs leading-5">
            <div className="font-semibold text-zinc-900">Memory fit</div>
            <p className="mt-1 text-zinc-700">{plan.memory_fit_summary}</p>
            {plan.bottlenecks.length > 0 && <p className="mt-1 text-zinc-600"><span className="font-medium">Bottlenecks:</span> {plan.bottlenecks.join(" · ")}</p>}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <span className="font-semibold">Important:</span> VRAM / system memory is NOT pooled across unrelated machines without a compatible runtime + topology. You must verify network, runtime, power, cooling and workload yourself.
          </div>

          <div className="rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
            <span className="font-semibold text-zinc-900">Why simpler may be better:</span>{" "}
            {plan.topology_type === "replicas"
              ? "Replicas avoid sharding complexity when throughput — not single-model memory — is the goal."
              : plan.topology_type === "single_node"
                ? "One node has the lowest ops overhead — prefer it when it fits with headroom."
                : plan.topology_type === "not_recommended"
                  ? "A single stronger node or API / rented GPU is simpler and safer here."
                  : "Compare added networking + power + ops cost vs the benefit."}
          </div>

          <details className="rounded-xl border bg-white p-3 text-xs" open>
            <summary className="cursor-pointer font-semibold text-zinc-900">Assumptions & verification</summary>
            <p className="mt-2 leading-5 text-zinc-600"><span className="font-medium">Assumptions:</span> {plan.assumptions.join(" · ") || "—"}</p>
            <p className="mt-1 leading-5 text-zinc-600"><span className="font-medium">Verification tasks:</span> {plan.verification_tasks.join(" · ")}</p>
            <p className="mt-2 text-[11px] text-zinc-500">Confidence {(plan.confidence * 100).toFixed(0)}% · sources: {plan.source_snapshot_ids.join(", ")} — see vLLM, MLX, DGX Spark docs.</p>
          </details>
        </div>
      </div>
    </div>
  );
}
