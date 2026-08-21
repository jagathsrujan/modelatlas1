import type { HardwareAsset } from "./types";

export interface HardwareExtraction {
  partial: Partial<HardwareAsset>;
  confidence: Record<string, number>;
  source_reference: string;
  warnings: string[];
}

// Never treat uncertain field as confirmed. Low confidence => ask user to skip or provide another source.
export function inspectHardwareEvidence(
  evidenceId: string,
  // metadata hint: user may provide typed model name or file metadata
  hint?: { fileName?: string; typedModelName?: string; mimeType?: string }
): HardwareExtraction {
  const warnings: string[] = [];
  const confidence: Record<string, number> = {};
  const partial: Partial<HardwareAsset> = {
    source_documents: [evidenceId],
    extraction_confidence: confidence,
    user_confirmed: false,
    last_verified_at: new Date().toISOString(),
  };

  const nameHint = (hint?.typedModelName ?? hint?.fileName ?? evidenceId).toLowerCase();

  // Heuristic mapping based on filename / typed string
  if (nameHint.includes("mac studio") || nameHint.includes("m2 ultra") || nameHint.includes("finance-mac") || nameHint.includes("mac-studio")) {
    partial.name = "Mac Studio M2 Ultra";
    confidence["name"] = 0.94;
    partial.manufacturer = "Apple";
    confidence["manufacturer"] = 0.98;
    partial.model = "Mac Studio M2 Ultra 64GB";
    confidence["model"] = 0.90;
    partial.cpu = "Apple M2 Ultra (24-core)";
    confidence["cpu"] = 0.88;
    partial.gpu = "Apple M2 Ultra 76-core GPU";
    confidence["gpu"] = 0.87;
    partial.system_memory_gb = 64;
    confidence["system_memory_gb"] = 0.95;
    partial.memory_type = "Unified LPDDR5";
    partial.storage_gb = 1024;
    partial.power_watts = 150;
    partial.operating_system = "macOS Sonoma";
    confidence["operating_system"] = 0.90;
  } else if (nameHint.includes("rtx 4090") || nameHint.includes("4090") || nameHint.includes("cuda-pc") || nameHint.includes("ops-pc") || nameHint.includes("rtx4090")) {
    partial.name = "CUDA Workstation RTX 4090";
    confidence["name"] = 0.96;
    partial.manufacturer = "Custom Build";
    confidence["manufacturer"] = 0.75;
    partial.gpu = "NVIDIA GeForce RTX 4090 24GB";
    confidence["gpu"] = 0.97;
    partial.vram_gb = 24;
    confidence["vram_gb"] = 0.96;
    partial.cpu = "Intel Core i9-14900K";
    confidence["cpu"] = 0.70;
    partial.system_memory_gb = 64;
    confidence["system_memory_gb"] = 0.85;
    partial.memory_type = "DDR5";
    partial.storage_gb = 2048;
    partial.power_watts = 850;
    partial.operating_system = "Ubuntu 22.04 LTS";
    confidence["operating_system"] = 0.78;
  } else if (nameHint.includes("macbook") || nameHint.includes("m3 pro") || nameHint.includes("macbook-box") || nameHint.includes("support")) {
    partial.name = "MacBook Pro 14\" M3 Pro";
    confidence["name"] = 0.85;
    partial.manufacturer = "Apple";
    confidence["manufacturer"] = 0.99;
    partial.model = "MacBook Pro 14 M3 Pro 18GB";
    confidence["model"] = 0.82;
    partial.cpu = "Apple M3 Pro (12-core)";
    confidence["cpu"] = 0.80;
    partial.system_memory_gb = 18;
    confidence["system_memory_gb"] = 0.88;
    partial.memory_type = "Unified LPDDR5";
    partial.storage_gb = 512;
    partial.power_watts = 70;
    confidence["power_watts"] = 0.65;
    partial.operating_system = "macOS Sonoma";
    confidence["operating_system"] = 0.80;
  } else if (nameHint.includes("dgx spark") || nameHint.includes("dgx") || nameHint.includes("spark") || nameHint.includes("gb10")) {
    partial.name = "NVIDIA DGX Spark";
    confidence["name"] = 0.90;
    partial.manufacturer = "NVIDIA";
    confidence["manufacturer"] = 0.95;
    partial.model = "DGX Spark (GB10 Superchip)";
    confidence["model"] = 0.88;
    partial.cpu = "NVIDIA Grace + Blackwell Superchip";
    confidence["cpu"] = 0.80;
    partial.gpu = "NVIDIA Blackwell GPU";
    confidence["gpu"] = 0.78;
    partial.vram_gb = 128;
    confidence["vram_gb"] = 0.78;
    partial.system_memory_gb = 128;
    confidence["system_memory_gb"] = 0.80;
    partial.memory_type = "Unified LPDDR5X";
    partial.storage_gb = 4096;
    partial.power_watts = 1000;
    confidence["power_watts"] = 0.70;
    partial.operating_system = "NVIDIA DGX OS";
    confidence["operating_system"] = 0.88;
  } else {
    // Low confidence case
    partial.name = hint?.typedModelName ?? "Unknown Device";
    confidence["name"] = 0.45;
    warnings.push("Low confidence extraction — please edit fields or provide another source.");
    partial.manufacturer = null;
    partial.model = null;
  }

  // Mark low-confidence fields
  for (const k of Object.keys(confidence)) {
    if (confidence[k] < 0.7) warnings.push(`Field '${k}' has low confidence (${confidence[k].toFixed(2)}) — please verify.`);
  }

  return { partial, confidence, source_reference: evidenceId, warnings };
}

export function confirmHardware(
  existing: Partial<HardwareAsset>,
  correctedFields: Partial<HardwareAsset>
): HardwareAsset {
  const merged: HardwareAsset = {
    id: (existing.id as string) ?? `hw-${Date.now().toString(36)}`,
    name: (correctedFields.name ?? existing.name ?? "Unnamed Device") as string,
    status: (correctedFields.status ?? existing.status ?? "owned_available") as HardwareAsset["status"],
    manufacturer: correctedFields.manufacturer ?? existing.manufacturer ?? null,
    model: correctedFields.model ?? existing.model ?? null,
    cpu: correctedFields.cpu ?? existing.cpu ?? null,
    gpu: correctedFields.gpu ?? existing.gpu ?? null,
    vram_gb: correctedFields.vram_gb ?? existing.vram_gb ?? null,
    system_memory_gb: correctedFields.system_memory_gb ?? existing.system_memory_gb ?? null,
    memory_type: correctedFields.memory_type ?? existing.memory_type ?? null,
    storage_gb: correctedFields.storage_gb ?? existing.storage_gb ?? null,
    power_watts: correctedFields.power_watts ?? existing.power_watts ?? null,
    operating_system: correctedFields.operating_system ?? existing.operating_system ?? null,
    source_documents: correctedFields.source_documents ?? existing.source_documents ?? [],
    extraction_confidence: { ...existing.extraction_confidence, ...correctedFields.extraction_confidence } as Record<string, number>,
    user_confirmed: true,
    last_verified_at: new Date().toISOString(),
    workspace_id: (correctedFields.workspace_id ?? existing.workspace_id) as string | undefined,
    owner_id: (correctedFields.owner_id ?? existing.owner_id) as string | undefined,
  };
  return merged;
}
