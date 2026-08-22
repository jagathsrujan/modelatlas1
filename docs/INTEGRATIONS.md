# Integration and Source Strategy

## 1. Integration principle

Integrations provide evidence and outbound paths. They do not become the product’s decision logic. The application normalizes source data, applies privacy and user constraints, then ranks candidates deterministically.

## 2. Model and benchmark sources

### Artificial Analysis

Use as a benchmark, pricing, performance, and model-metadata source. Its current API documentation describes structured model data and requires attribution; API keys must remain server-side. Confirm the permitted use and redistribution tier before exposing data in a public product.

Reference: [Artificial Analysis API documentation](https://artificialanalysis.ai/data-api/docs)

### OpenRouter

Use as a source for model/provider catalog metadata and cloud-provider route information. It already exposes a catalog and routing concepts, so ModelAtlas’s value is the workload-aware recommendation and explanation layer above it.

References: [OpenRouter models](https://openrouter.ai/docs/guides/overview/models), [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection)

### Hugging Face

Use as an open-model discovery and inference-provider metadata source. Normalize model identity, license, modality, runtime requirements, and provider availability before ranking.

Reference: [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/en/index)

### LM Studio

Treat as a local-runtime option for users who already have a compatible machine. Its local server and OpenAI-compatible endpoints inform the “run locally” hosting path, but V1 does not connect to or deploy a local model.

References: [LM Studio local server](https://lmstudio.ai/docs/developer/core/server), [LM Studio OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/openai-compat)

## 3.1 Distributed runtime and cluster evidence

### vLLM

Use vLLM documentation to identify whether a CUDA-based workload can use tensor parallelism, pipeline parallelism, or multi-node execution. The official guidance distinguishes single-node serving from multi-node TP/PP and calls out identical environments and fast interconnects as important assumptions. ModelAtlas uses this as compatibility evidence only; V1 does not install vLLM, launch Ray, or execute remote commands.

Reference: [vLLM parallelism and scaling](https://docs.vllm.ai/en/latest/serving/parallelism_scaling/)

### Apple Silicon and MLX

For multiple Mac mini, MacBook, or Mac Studio systems, evaluate an Apple-aware distributed path such as MLX. MLX documents multi-host communication and distributed data/tensor-parallel workflows, but the recommendation must account for the network, memory pressure, thermals, and hardware heterogeneity. vLLM on Apple Silicon is a separate backend path and must not be assumed to behave like CUDA vLLM.

References: [MLX distributed communication](https://ml-explore.github.io/mlx/build/html/usage/distributed.html), [MLX launching distributed jobs](https://ml-explore.github.io/mlx/build/html/usage/launching_distributed.html), [vLLM Metal](https://docs.vllm.ai/projects/vllm-metal/en/latest/)

### DGX Spark

Treat multiple DGX Spark systems as a specialized NVIDIA cluster candidate. NVIDIA’s current documentation describes connecting systems through ConnectX-7/QSFP networking and provides a clustering workflow. The planner must surface the supported node count, required network hardware, software stack, power, and cooling instead of promising that the devices automatically form one larger computer.

References: [NVIDIA DGX Spark clustering](https://docs.nvidia.com/dgx/dgx-spark/spark-clustering.html), [NVIDIA Sync](https://docs.nvidia.com/sync/latest/index.html)

## 3.2 Agent model provider

The Decision Copilot uses an `AgentModelProvider` adapter so the harness can route structured-output and tool-calling work to an approved model without changing the product workflow. Candidate routes include OpenRouter, Hugging Face Inference Providers, a local LM Studio server, or another approved private endpoint.

Routing inputs:

- confirmed privacy classification;
- workspace-approved providers and regions;
- task type: extraction, clarification, tool selection, or final explanation;
- latency and cost budget;
- model availability and structured-output/tool-calling support.

The provider adapter must enforce timeouts, schema validation, usage logging, and a deterministic fallback. The browser never receives provider secrets. For confidential or highly sensitive workloads, the harness should pass structured metadata rather than raw documents whenever possible, and it must block external model calls when policy disallows them.

## 3. Voice input

The voice experience is browser-first and sends audio to a self-hosted transcription backend. It uses a `TranscriptionProvider` abstraction so the backend can change without changing intake UX.

The referenced [Murmur YouTube repository](https://github.com/per-simmons/murmur-youtube) is an interaction and state-machine reference for push-to-talk, streaming transcript display, cleanup, and swappable transcription engines. It is not a browser dependency for V1. Confirm its license before reusing code; use the behavior as a design reference unless reuse is clearly permitted.

Voice rules:

- Push-to-talk or explicit record/stop action
- Visible recording state
- Editable transcript
- Raw audio deleted after transcription by default
- Typed fallback always available
- No audio is used for employee scoring

## 4. Hardware evidence sources

Accepted evidence:

- Photos of devices and boxes
- Invoices
- PDFs
- System-information screenshots
- User-entered model names

Extraction should produce candidate fields with confidence. The user confirms or edits the profile before the recommendation engine uses it.

## 5. Marketplace sources

The India-first/global-aware source layer may include:

- Indian computer retailers such as MD Computers and Vedant Computers
- Established US retailers and marketplaces such as Micro Center and Amazon US
- Chinese marketplaces with verifiable listings
- Other established regional e-commerce sources

These are source examples, not guarantees of direct shipping or seller quality. Each connector must preserve the original listing link and show whether the result is directly shippable, importable, a benchmark, or user-verification-required.

## 6. Retrieval hierarchy

Use this order:

1. Official API or affiliate/catalog feed
2. Public web search and static page extraction where permitted
3. Controlled browser fetch for public JavaScript-rendered pages where permitted
4. Cached source snapshot
5. Curated fallback listing or research brief for the demo

The UI must label API, fetched, browser-rendered, cached, and curated data separately. A source adapter should never silently turn an old snapshot into a current listing.

## 7. Marketplace trust policy

The system evaluates both marketplace and seller evidence:

- Marketplace buyer protection
- Seller verification
- Rating and review volume
- Authorized-reseller status where available
- Warranty details
- Return details
- Price anomaly
- Stock and shipping clarity

When evidence is incomplete, show **User verification required**. The user must manually verify seller, warranty, shipping, final price, and return conditions before purchasing.

## 8. Research Scout sources

Research Scout is a bounded public-information layer. It prefers official APIs, catalog feeds, and public product/documentation pages, then uses independent technical sources and community signals for discovery and real-world context.

Potential connectors:

- **X:** official API when the project has permitted access; use for recent announcements and practitioner signals, never as a standalone benchmark.
- **Reddit:** official API or permitted public pages; use for setup friction, failure reports, and community comparisons, with disagreement preserved.
- **YouTube:** official Data API for video/channel discovery and permitted metadata/transcript handling; use creator identity and publication date in evidence.
- **Forums/GitHub discussions:** public API or permitted page fetch; use as implementation leads and bug-signal sources.
- **Browser fetcher:** controlled read-only browser for public JavaScript-rendered pages when an API or static fetch is insufficient.

Recommended implementation: use Playwright with a pinned Chromium build inside an isolated worker. Use server-side `fetch` for static pages and reserve the browser for JavaScript-rendered pages. The `agent-browser` CLI is useful for local development and visual verification, but it is not the production evidence layer. Codex in-app browser controls are not part of the shipped product.

The connector layer must obey access terms, rate limits, robots directives, copyright limits, and authentication boundaries. It must not bypass CAPTCHA, paywalls, login, or access controls, and must not use a user’s logged-in social session by default.

Official references: [X API tools](https://developer.x.com/apitools/api), [Reddit API documentation](https://www.reddit.com/dev/api/), and [YouTube Search API](https://developers.google.com/youtube/v3/docs/search/list).

Community output is stored as a cited research claim with a source tier, retrieved time, publication time when available, corroboration count, and `user_verification_required`. Community claims go to **Community signals to investigate** unless corroborated by a primary or independent technical source.

## 9. Source adapter contract

Each adapter should return:

```text
source_id
source_type
canonical_id
title
seller
country
currency
price_fields
availability
warranty
returns
url
checked_at
confidence
attribution_requirements
```

The rest of the application should not depend on the shape of any individual provider response.
