# Technical Specification

## 1. Domain objects

### WorkloadProfile

Represents what the user wants to achieve.

Core fields:

- `id`
- `owner_id` or `workspace_id`
- `title`
- `description`
- `roles`
- `input_modalities`
- `output_modalities`
- `data_sensitivity`
- `expected_users`
- `requests_per_day`
- `average_input_size`
- `peak_concurrency`
- `hours_per_day`
- `growth_assumption`
- `budget`
- `country`
- `comparison_horizon`
- `ranking_preset`
- `confirmed_at`
- `assumptions`

### DecisionSession

Represents one bounded Decision Copilot interaction. Detailed harness behavior is defined in [AGENTIC_HARNESS.md](AGENTIC_HARNESS.md).

Core fields:

- `id`
- `owner_id` or `workspace_id`
- `mode`
- `status`
- `confirmed_profile_version`
- `privacy_classification`
- `selected_preset`
- `step_count`
- `started_at`
- `completed_at`

Each tool call is recorded as an `AgentTrace` with the model/provider, validated action, tool name, source/result reference, latency, usage metadata, and error code. Raw audio and sensitive document contents are not persisted by default.

### ResearchBrief

Represents one bounded current-information lookup. Detailed retrieval and source rules are defined in [RESEARCH_SCOUT.md](RESEARCH_SCOUT.md).

Core fields:

- `id`
- `scope`
- `query_groups`
- `claims`
- `source_snapshot_ids`
- `checked_at`
- `conflicts`
- `status`

Each claim carries its type, source tier, URL, publisher/author, publication and retrieval dates, extracted evidence, confidence, corroboration count, and `user_verification_required`.

### WorkspacePolicy

Represents the rules that the recommendation engine must enforce for a team.

Core fields:

- `workspace_id`
- `maximum_privacy_classification`
- `approved_model_creators`
- `approved_providers`
- `approved_marketplaces`
- `allowed_regions`
- `plan_approval_required`
- `updated_by`
- `updated_at`

An empty approved list means “no additional allowlist” only when the workspace owner explicitly selects that mode. A configured allowlist is restrictive.

### TeamOpportunity

Represents an aggregated workflow pattern without exposing private individual responses by default.

Core fields:

- `workspace_id`
- `title`
- `summary`
- `affected_roles`
- `contributing_profile_count`
- `shared_data_types`
- `shared_privacy_classification`
- `estimated_impact`
- `confidence`
- `source_profile_visibility`
- `selected_at`

### HardwareAsset

Represents owned, discovered, or planned hardware.

Core fields:

- `id`
- `workspace_id` or `owner_id`
- `name`
- `status`
- `manufacturer`
- `model`
- `cpu`
- `gpu`
- `vram_gb`
- `system_memory_gb`
- `memory_type`
- `storage_gb`
- `power_watts`
- `operating_system`
- `source_documents`
- `extraction_confidence`
- `user_confirmed`
- `last_verified_at`

### ClusterPlan

Represents an advisory plan for using zero or more existing machines together. It is not a deployment manifest.

Core fields:

- `topology_type`: `single_node`, `replicas`, `sharded_inference`, `distributed_training`, `staged_pipeline`, or `not_recommended`
- `selected_asset_ids`
- `node_roles`
- `model_placement`: `full_copy_per_node`, `split_across_nodes`, or `not_applicable`
- `runtime_family`
- `orchestration_requirement`
- `interconnect_requirement`
- `memory_fit_summary`
- `expected_benefit`
- `bottlenecks`
- `assumptions`
- `verification_tasks`
- `confidence`
- `source_snapshot_ids`

### CatalogModel

Represents a model from an existing catalog.

Core fields:

- `canonical_id`
- `name`
- `creator`
- `modality_family`
- `input_modalities`
- `output_modalities`
- `context_length`
- `license`
- `availability`
- `benchmark_summary`
- `price_metadata`
- `performance_metadata`
- `privacy_metadata`
- `source_provenance`
- `last_checked_at`

### ProviderOption

Represents a route to use a model:

- Hosted API
- Private cloud endpoint
- Local runtime
- Dedicated rented hardware
- Owned hardware

Fields include provider, region, data policy, availability, pricing, compatibility, and source freshness.

### MarketplaceListing

Represents a product or service link.

Core fields:

- `source_type`
- `marketplace`
- `seller`
- `product_name`
- `condition`
- `product_url`
- `country`
- `currency`
- `item_price`
- `shipping_cost`
- `tax_cost`
- `import_duty`
- `brokerage_cost`
- `landed_total`
- `warranty_summary`
- `return_summary`
- `trust_evidence`
- `freshness_status`
- `last_checked_at`
- `user_verification_required`

### Recommendation

Represents one ranked option and its explanation.

- `candidate_type`
- `candidate_id`
- `eligibility_result`
- `preset`
- `score_breakdown`
- `reasons_for`
- `reasons_against`
- `cost_breakdown`
- `privacy_result`
- `assumptions`
- `confidence`
- `source_snapshot_ids`

### ImplementationPlan

Contains:

- Problem summary
- Current workflow
- Proposed workflow
- Recommended strategy
- Primary architecture path
- Alternatives
- Hosting recommendation
- Model family recommendation
- Hardware/procurement options
- Direct-cost view
- Phases
- Success metrics
- Risks and limitations
- Approval status

## 2. Privacy and authorization model

Workspace roles:

- Owner
- Editor
- Viewer
- Commenter, if needed after the core flow works

Workspace administrators can maintain approved model creators, providers, marketplaces, and regions. These lists are policy inputs, not ranking preferences.

Privacy policy precedence:

```text
workspace maximum restriction
    > workload classification
    > user preference
```

The policy engine returns an explicit allow/deny reason. A denied candidate is not merely scored low; it is excluded.

## 3. Recommendation pipeline

```text
raw user input
  -> bounded agent action
  -> normalized workload
  -> user confirmation
  -> privacy and workspace gate
  -> candidate retrieval
  -> bounded research, when current information is requested
  -> hardware/provider compatibility filter
  -> cluster topology assessment
  -> direct cost calculation
  -> preset scoring
  -> explanation and alternatives
  -> persisted recommendation
```

The agent may choose the next question or read-only tool call, but server-side schemas, authorization, privacy policy, cost calculation, eligibility, ranking, and persistence remain authoritative. Writes require explicit user action.

### Candidate eligibility checks

1. Supports required input and output modalities.
2. Meets privacy and workspace policy.
3. Meets country/region and availability requirements.
4. Fits hardware memory and runtime requirements when local.
5. Fits the user’s budget or is clearly labeled as an over-budget alternative.
6. Has enough source data to explain cost and trust.
7. For a multi-machine plan, the topology is compatible with the selected model, runtime, accelerator family, operating systems, interconnect, and workload objective.

### Cluster topology decision rules

The planner must compare these options in order of operational simplicity:

1. **One node:** prefer this when the model and expected workload fit with safe memory headroom. It usually has the lowest networking and maintenance complexity.
2. **Independent replicas:** place a complete model copy on each compatible machine and distribute separate requests. This improves throughput or availability, but it does not pool memory for one model.
3. **Sharded inference:** split one model across nodes using a compatible tensor-, pipeline-, or expert-parallel runtime. Recommend this only when one node cannot fit the model or the required latency/throughput justifies the interconnect and operations cost.
4. **Distributed training or fine-tuning:** recommend only when the dataset, training duration, budget, and engineering capability justify multi-node coordination. Training topology is not automatically an inference topology.
5. **Staged pipeline:** use separate machines for separate stages, such as ingestion, retrieval, OCR, or inference, when the workflow benefits from isolation rather than shared model memory.

Hard warnings:

- Do not add VRAM or system memory across machines and present the sum as usable model memory.
- Four or five mixed consumer PCs on ordinary Ethernet should normally become separate workers, a single stronger node, or an API/rented option—not a sharded model—unless compatibility and network evidence is present.
- Multiple Apple Silicon machines should use an Apple-aware distributed path such as MLX when the workload justifies it. Do not assume the CUDA/vLLM path applies to Macs; mixed Macs default to replicas unless the runtime and interconnect are verified.
- Multiple DGX Spark systems are a valid cluster candidate when the required NVIDIA networking and software stack are present, but the plan must show the network requirement, node count, power, and expected benefit.
- If the cluster’s expected benefit is smaller than its added networking, power, setup, and operational burden, return `not_recommended` and explain why.

### Preset scoring

The exact weights remain configuration, but the dimensions are stable:

- Performance and quality
- Direct cost over the chosen horizon
- Privacy fit
- Availability and time to deployment
- Power consumption
- Hardware headroom
- Warranty and seller risk
- Operational complexity

The UI shows the winning dimensions in plain language rather than exposing a numeric formula by default.

## 4. Cost calculations

### Hardware landed cost

```text
landed_cost = item_price
            + shipping_cost
            + tax_cost
            + import_duty
            + brokerage_cost
```

These lines remain separate in the UI.

### Electricity

```text
electricity_cost = (watts / 1000)
                 * hours_per_day
                 * days_in_horizon
                 * local_tariff
```

### API or rented compute

```text
usage_cost = input_units * input_rate
           + output_units * output_rate
           + fixed_usage_fees
```

For cloud GPU or rented hardware:

```text
compute_cost = hourly_rate * expected_hours
```

Staff and maintenance costs are excluded and shown in the limitations section.

## 5. Listing freshness

V1 freshness policy:

- Less than 24 hours: current
- 24–72 hours: aging and lower-ranked
- More than 72 hours: stale and excluded from primary ranking

Curated fallback data is always labeled separately from live source data.

## 6. Training-strategy decision rules

- Recommend prompting or structured workflow when the task is simple and knowledge changes frequently.
- Recommend RAG when the user needs private or changing documents.
- Recommend fine-tuning when the task is stable and behavior/style consistency matters.
- Recommend continued pretraining only when domain language and dataset scale justify it.
- Recommend full pretraining only as an exceptional, high-budget path.

The plan must explain the reason and list the simpler alternative that was rejected.

## 7. Source provenance

Every external fact should carry:

- Source provider
- Source URL or source identifier
- Retrieved/checked timestamp
- Data type
- Confidence
- Attribution requirement, if any

The system must preserve a source snapshot identifier on each recommendation so the user can understand what was known at recommendation time.

## 8. Validation and fallback

Validate at four boundaries:

1. Browser form and upload metadata
2. Server action payload
3. External source normalization
4. Domain result before rendering or persistence

If an external source fails:

- Use cached or curated data
- Mark the result as fallback
- Keep the recommendation explainable
- Do not fabricate current price, stock, warranty, or benchmark values
