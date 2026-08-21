import type { HardwareAsset, WorkloadProfile, CatalogModel, ClusterPlan } from "./types";

export interface ClusterPlannerInput {
  assets: HardwareAsset[];
  workload: WorkloadProfile;
  catalogModel?: CatalogModel;
  objective?: "single_model_fit" | "higher_throughput" | "training" | "pipeline" | "general";
}

/** Hard warnings must be enforced in reasoning */
export function planClusterTopology(input: ClusterPlannerInput): ClusterPlan {
  const { assets, workload, catalogModel, objective } = input;
  const confirmed = assets.filter(a => a.user_confirmed || a.status === "owned_available");
  const assetIds = confirmed.map(a => a.id);

  const assumptions: string[] = [];
  const verification_tasks: string[] = [
    "Verify exact hardware model, driver versions, and available VRAM/system memory headroom",
    "Verify runtime support for chosen topology (vLLM / MLX / NCCL / Ray)",
    "Verify interconnect bandwidth and latency (Ethernet vs InfiniBand/NVLink/QSFP)",
    "Verify power, cooling, and physical placement",
    "Benchmark with expected workload before production",
  ];
  const source_snapshot_ids: string[] = ["snap-vllm","snap-mlx","snap-dgx-spark"];

  // Edge: 0-1 assets
  if (confirmed.length === 0) {
    return {
      topology_type: "not_recommended",
      selected_asset_ids: [],
      node_roles: {},
      model_placement: "not_applicable",
      runtime_family: null,
      orchestration_requirement: null,
      interconnect_requirement: null,
      memory_fit_summary: "No confirmed hardware available — cannot plan topology.",
      expected_benefit: "None — add hardware or choose cloud/API path.",
      bottlenecks: ["Missing hardware inventory"],
      assumptions,
      verification_tasks,
      confidence: 0.95,
      source_snapshot_ids,
    };
  }
  if (confirmed.length === 1) {
    const a = confirmed[0];
    const vram = a.vram_gb ?? (a.system_memory_gb ?? 0) / 2; // rough; unified memory case
    const need = (catalogModel?.performance_metadata?.vram_gb_min as number | undefined) ?? 16;
    const fits = vram >= need * 1.2; // safe headroom
    assumptions.push(`Single node: estimated available ${vram}GB vs model need ~${need}GB (+20% headroom)`);
    if (!a.user_confirmed) assumptions.push("Hardware not user-confirmed — specs are inferred");
    return {
      topology_type: "single_node",
      selected_asset_ids: [a.id],
      node_roles: { [a.id]: "single_worker" },
      model_placement: "full_copy_per_node",
      runtime_family: a.manufacturer === "Apple" ? "MLX" : a.gpu?.includes("NVIDIA") ? "vLLM" : "local_runtime",
      orchestration_requirement: null,
      interconnect_requirement: null,
      memory_fit_summary: fits ? `Fits with headroom (${vram}GB available, ${need}GB required)` : `Tight fit (${vram}GB available, ${need}GB required) — consider quantization or API`,
      expected_benefit: fits ? "Lowest ops complexity; model fits on one node" : "May need quantization/CPU offload or API/rental",
      bottlenecks: fits ? [] : ["Memory headroom"],
      assumptions,
      verification_tasks,
      confidence: fits ? 0.88 : 0.75,
      source_snapshot_ids,
    };
  }

  // Multi-machine analysis
  // Detect categories
  const appleCount = confirmed.filter(a => a.manufacturer === "Apple" || a.operating_system?.includes("macOS")).length;
  const nvidiaCount = confirmed.filter(a => a.gpu?.includes("NVIDIA") || a.gpu?.includes("RTX") || a.manufacturer === "NVIDIA").length;
  const isDGX = confirmed.filter(a => a.model?.includes("DGX Spark")).length;
  const mixedPC = confirmed.length >= 3 && confirmed.some(a=> a.manufacturer !== "Apple" && a.manufacturer !== "NVIDIA");

  // DGX Spark path
  if (isDGX >= 2) {
    assumptions.push(`DGX Spark cluster: ${isDGX} nodes, requires ConnectX-7/QSFP networking + NVIDIA Sync, identical DGX OS, fast interconnect`);
    assumptions.push("Power ~1000W per node, cooling must be planned; not cost-free to pool memory");
    verification_tasks.push("Confirm DGX Spark ConnectX-7/QSFP NIC presence and NVIDIA Sync compatibility per docs");
    // Only recommend sharded if benefit outweighs burden
    const need = (catalogModel?.performance_metadata?.vram_gb_min as number | undefined) ?? 24;
    const singleFits = confirmed.some(a => (a.vram_gb ?? 0) >= need * 1.2);
    if (singleFits && objective !== "training") {
      return {
        topology_type: "replicas",
        selected_asset_ids: assetIds,
        node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `replica_${i+1}`])),
        model_placement: "full_copy_per_node",
        runtime_family: "DGX / NVIDIA runtime",
        orchestration_requirement: "Optional: load balancer for replicas",
        interconnect_requirement: "Standard Ethernet sufficient for replicas (no sharding)",
        memory_fit_summary: `Each DGX node has ~128GB unified; model needs ~${need}GB → fits per node, no sharding needed`,
        expected_benefit: "Throughput and availability via replicas; no interconnect burden",
        bottlenecks: ["Operational complexity of managing multiple nodes"],
        assumptions,
        verification_tasks,
        confidence: 0.84,
        source_snapshot_ids,
      };
    }
    // Otherwise sharded or distributed_training
    if (objective === "training") {
      return {
        topology_type: "distributed_training",
        selected_asset_ids: assetIds,
        node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, i===0? "coordinator":"worker"])),
        model_placement: "split_across_nodes",
        runtime_family: "DGX / NCCL / PyTorch DDP",
        orchestration_requirement: "NCCL/Ray + NVIDIA Sync",
        interconnect_requirement: "ConnectX-7/QSFP, high bandwidth required",
        memory_fit_summary: `Distributed training shards model across ${isDGX} nodes; only justified when dataset + training duration warrant multi-node cost`,
        expected_benefit: "Reduced training time proportional to nodes; high engineering overhead",
        bottlenecks: ["Network", "Synchronization overhead", "Power/cooling"],
        assumptions: [...assumptions, "Training topology ≠ inference topology — evaluate separately"],
        verification_tasks,
        confidence: 0.72,
        source_snapshot_ids,
      };
    }
    return {
      topology_type: "sharded_inference",
      selected_asset_ids: assetIds,
      node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `shard_${i+1}`])),
      model_placement: "split_across_nodes",
      runtime_family: "DGX / tensor-parallel runtime",
      orchestration_requirement: "Distributed inference coordinator (e.g., vLLM multi-node)",
      interconnect_requirement: "ConnectX-7/QSFP + NVIDIA Sync required",
      memory_fit_summary: `Sharded: model split across ${isDGX} nodes pooled via interconnect — only when one node insufficient`,
      expected_benefit: "Single model that does not fit one node can run sharded",
      bottlenecks: ["Interconnect latency", "Power/cooling", "Operational complexity"],
      assumptions,
      verification_tasks,
      confidence: 0.76,
      source_snapshot_ids,
    };
  }

  const needVram = (catalogModel?.performance_metadata?.vram_gb_min as number | undefined) ?? 16;
  const singleMaxVram = Math.max(...confirmed.map(a => a.vram_gb ?? a.system_memory_gb ?? 0));
  const fitsOne = singleMaxVram >= needVram * 1.2;

  // 4-5 mixed consumer PCs on ordinary Ethernet → default to replicas/single/API, NOT sharded
  if (mixedPC || confirmed.length >= 4) {
    assumptions.push("4-5 mixed consumer PCs on ordinary Ethernet — NOT recommending sharded without verified interconnect/runtime");
    assumptions.push("VRAM/system memory is NOT pooled — each machine's memory is separate without compatible distributed runtime");
    if (fitsOne) {
      return {
        topology_type: "replicas",
        selected_asset_ids: assetIds,
        node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `replica_${i+1}`])),
        model_placement: "full_copy_per_node",
        runtime_family: "local_runtime / vLLM per node",
        orchestration_requirement: "Load balancer for replicas (optional)",
        interconnect_requirement: "Standard Ethernet sufficient (separate workers, no memory pooling)",
        memory_fit_summary: `Model needs ~${needVram}GB; largest node has ${singleMaxVram}GB → fits per-node with headroom. Three separate workers, NOT one pooled memory.`,
        expected_benefit: "Throughput/availability via replicas; no sharding ops burden",
        bottlenecks: ["Load balancing", "Data consistency if shared index"],
        assumptions,
        verification_tasks,
        confidence: 0.81,
        source_snapshot_ids,
      };
    }
    return {
      topology_type: "not_recommended",
      selected_asset_ids: [],
      node_roles: {},
      model_placement: "not_applicable",
      runtime_family: null,
      orchestration_requirement: null,
      interconnect_requirement: null,
      memory_fit_summary: `Model needs ~${needVram}GB; no node has sufficient headroom (${singleMaxVram}GB max). Sharded on consumer Ethernet not advised.`,
      expected_benefit: "None — recommend single stronger node, quantized model, or API/rented GPU instead",
      bottlenecks: ["Interconnect insufficient for sharding", "Heterogeneous hardware", "Memory not pooled"],
      assumptions,
      verification_tasks,
      confidence: 0.78,
      source_snapshot_ids,
    };
  }

  // Multiple Apple Silicon
  if (appleCount >= 2) {
    assumptions.push("Multiple Apple Silicon → evaluate Apple-aware path (MLX distributed); do NOT assume CUDA/vLLM path");
    assumptions.push("VRAM not pooled; Unified memory per machine is separate unless MLX distributed collective ops are used");
    // Mixed Macs default to replicas unless runtime+interconnect verified
    const allApple = appleCount === confirmed.length;
    if (!allApple || fitsOne) {
      return {
        topology_type: "replicas",
        selected_asset_ids: assetIds,
        node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `replica_${i+1}`])),
        model_placement: "full_copy_per_node",
        runtime_family: allApple ? "MLX" : "mixed — MLX + vLLM per host",
        orchestration_requirement: allApple ? "MLX distributed via mpirun (if sharding) — otherwise load balancer" : "Per-host local runtime",
        interconnect_requirement: allApple ? "Thunderbolt/Ethernet sufficient for replicas; MLX collective requires MPI for sharding" : "Ethernet for replicas",
        memory_fit_summary: `Model needs ~${needVram}GB; Mac unified ${singleMaxVram}GB max → ${fitsOne ? "fits per-node, replicas preferred" : "may be tight, consider API or stronger Mac"}`,
        expected_benefit: "Replicas improve throughput without interconnect complexity",
        bottlenecks: allApple ? ["MLX sharding requires verified interconnect"] : ["Heterogeneous accelerators"],
        assumptions,
        verification_tasks,
        confidence: 0.79,
        source_snapshot_ids,
      };
    }
    // All Apple and doesn't fit → MLX sharded
    return {
      topology_type: "sharded_inference",
      selected_asset_ids: assetIds,
      node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `shard_${i+1}`])),
      model_placement: "split_across_nodes",
      runtime_family: "MLX distributed",
      orchestration_requirement: "MLX mpirun + distributed ops",
      interconnect_requirement: "High-bandwidth interconnect (Thunderbolt bridge or 10GbE+), verified",
      memory_fit_summary: `Sharded via MLX: model split across ${appleCount} Apple nodes; validated only with proper interconnect`,
      expected_benefit: "Run larger model than single Mac can fit",
      bottlenecks: ["Interconnect", "Thermals", "MLX maturity for selected model"],
      assumptions,
      verification_tasks,
      confidence: 0.70,
      source_snapshot_ids,
    };
  }

  // 2-3 mixed/NVIDIA PCs
  if (confirmed.length >= 2) {
    // Single node vs replicas
    if (fitsOne) {
      // Compare benefit vs burden: for small workload, not_recommended vs replicas
      const reqPerDay = workload.requests_per_day ?? 500;
      const highThroughput = (objective === "higher_throughput") || reqPerDay > 800;
      if (!highThroughput && confirmed.length === 2) {
        // Might be simpler to use one node
        return {
          topology_type: "single_node",
          selected_asset_ids: [confirmed.reduce((best, cur) => ((cur.vram_gb ?? 0) > (best.vram_gb ?? 0) ? cur : best)).id],
          node_roles: { [confirmed.reduce((best, cur) => ((cur.vram_gb ?? 0) > (best.vram_gb ?? 0) ? cur : best)).id]: "primary" },
          model_placement: "full_copy_per_node",
          runtime_family: nvidiaCount > 0 ? "vLLM" : "local_runtime",
          orchestration_requirement: null,
          interconnect_requirement: null,
          memory_fit_summary: `Model needs ~${needVram}GB; fits on one node (${singleMaxVram}GB) with headroom — lowest complexity`,
          expected_benefit: "Lowest networking and maintenance complexity; replicas only if throughput needed",
          bottlenecks: [],
          assumptions: [...assumptions, `VRAM is NOT pooled — sharding would require vLLM TP/PP + fast interconnect`],
          verification_tasks,
          confidence: 0.86,
          source_snapshot_ids,
        };
      }
      return {
        topology_type: "replicas",
        selected_asset_ids: assetIds,
        node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `replica_${i+1}`])),
        model_placement: "full_copy_per_node",
        runtime_family: nvidiaCount > 0 ? "vLLM" : "local_runtime",
        orchestration_requirement: "Load balancer",
        interconnect_requirement: "Standard Ethernet (no memory pooling)",
        memory_fit_summary: `Model needs ~${needVram}GB; each of ${confirmed.length} nodes can host full copy — separate workers improve throughput/availability`,
        expected_benefit: "Higher throughput/availability, no pooled memory needed",
        bottlenecks: ["Networking for load balancing"],
        assumptions: [...assumptions, "Memory is NOT pooled across machines"],
        verification_tasks,
        confidence: 0.82,
        source_snapshot_ids,
      };
    } else {
      // Does not fit one node — can we shard?
      if (nvidiaCount >= 2) {
        assumptions.push("Sharded inference via vLLM TP/PP requires identical GPU environments + fast interconnect (NVLink/InfiniBand)");
        verification_tasks.push("Confirm vLLM multi-node TP/PP compatibility for this GPU family per docs");
        return {
          topology_type: "sharded_inference",
          selected_asset_ids: assetIds,
          node_roles: Object.fromEntries(assetIds.map((id,i)=>[id, `shard_${i+1}`])),
          model_placement: "split_across_nodes",
          runtime_family: "vLLM",
          orchestration_requirement: "Ray + vLLM distributed",
          interconnect_requirement: "High-bandwidth interconnect required (not ordinary Ethernet)",
          memory_fit_summary: `Model needs ~${needVram}GB > single node ${singleMaxVram}GB → sharded only with compatible runtime + interconnect`,
          expected_benefit: "Enables model that does not fit one node — high ops cost",
          bottlenecks: ["Interconnect", "Operational complexity", "Power/cooling"],
          assumptions,
          verification_tasks,
          confidence: 0.71,
          source_snapshot_ids,
        };
      }
      return {
        topology_type: "not_recommended",
        selected_asset_ids: [],
        node_roles: {},
        model_placement: "not_applicable",
        runtime_family: null,
        orchestration_requirement: null,
        interconnect_requirement: null,
        memory_fit_summary: `Model needs ~${needVram}GB > ${singleMaxVram}GB max single node; heterogeneous hardware without verified sharding path`,
        expected_benefit: "None — choose quantized model, API, or rented cloud GPU",
        bottlenecks: ["Insufficient single-node memory", "No compatible sharding runtime verified"],
        assumptions,
        verification_tasks,
        confidence: 0.80,
        source_snapshot_ids,
      };
    }
  }

  // Fallback
  return {
    topology_type: "not_recommended",
    selected_asset_ids: [],
    node_roles: {},
    model_placement: "not_applicable",
    runtime_family: null,
    orchestration_requirement: null,
    interconnect_requirement: null,
    memory_fit_summary: "No topology recommended — insufficient data or benefit < burden",
    expected_benefit: "None",
    bottlenecks: ["Unknown"],
    assumptions,
    verification_tasks,
    confidence: 0.6,
    source_snapshot_ids,
  };
}
