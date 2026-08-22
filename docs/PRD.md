# Product Requirements Document

## 1. Product definition

**Product:** ModelAtlas — AI Infrastructure Advisor  
**Theme fit:** AI Marketplace  
**Primary outcome:** Help a non-specialist decide which AI approach and infrastructure is appropriate for a real workload, then provide transparent routes to obtain it.

ModelAtlas focuses on the parts of the AI marketplace problem that are most valuable before purchase: discovery, evaluation, trust, cost comparison, deployment planning, and procurement guidance.

## 2. Problem

AI choices are fragmented across model catalogs, benchmark sites, inference providers, local runtimes, hardware vendors, and cloud platforms. A user must understand model quality, context limits, privacy, hardware memory, electricity, API pricing, import costs, warranty, and deployment strategy before they can make a safe decision.

The problem is harder for non-technical users and small teams. They may know the work they want to improve but not whether they need an API, a private local model, RAG, fine-tuning, a GPU, a Mac, rented infrastructure, or a full server.

## 3. Target users

### Personal Explorer

An enthusiast, student, consultant, founder, or executive who wants to understand what AI setup fits their work and budget.

Needs:

- Plain-language intake
- Voice input
- Hardware identification without technical vocabulary
- Simple ranking presets
- Local and global purchase options
- Reusable personal profiles

### Team / Business User

A small or medium business, department, or corporate exploration team deciding whether and how to adopt AI.

Needs:

- Shared workspace
- Role-aware workflow discovery
- Privacy and approved-provider policies
- Hardware inventory
- Team-level opportunity aggregation
- Implementation plan with alternatives

## 4. Anchor scenario

An Indian manufacturing company has finance, operations, and support staff. They work with invoices, scanned paperwork, spreadsheets, product images, and internal documents. A finance user starts in Personal Explorer, gives a voice description, uploads a hardware screenshot, and receives a recommendation. They convert the profile into a team workspace. Other team members add their roles. ModelAtlas identifies a shared document workflow, recommends a private RAG-first approach, compares local hardware against API and rental options, and generates a plan with one primary recommendation and alternatives.

## 5. Goals

1. Make AI infrastructure selection understandable to non-technical users.
2. Map work context to model, strategy, hosting, hardware, and procurement recommendations.
3. Enforce privacy and workspace policies before ranking options.
4. Provide India-first purchase guidance with international alternatives and transparent landed-cost lines.
5. Turn individual role descriptions into team-level AI opportunities.
6. Produce an implementation plan that a decision-maker can understand and an implementation team can start from.
7. Demonstrate the complete value chain in a 5–7 minute CodeFury presentation.
8. Make the recommendation process feel guided without hiding how evidence and policy produced the result.
9. Refresh recommendations with bounded, cited research when current information matters.

## 6. Non-goals for V1

- Running the user’s private documents through recommended models or hosting a model service
- Provisioning clusters, installing runtimes, or executing remote deployment commands
- Autonomous purchasing, deployment, or unsupervised decisions
- Unrestricted crawling, logged-in social-media scraping, or continuous monitoring
- Evaluating models against private customer documents
- Building a creator marketplace
- Payments, checkout, carts, or affiliate settlement
- Hardware telemetry or a native device scanner
- Detailed OCR/vector database/runtime architecture
- Legal, regulatory, or financial advice
- Employee productivity scoring

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance signal |
| --- | --- | --- | --- |
| FR-01 | User can choose Personal Explorer or Team / Business | Must | Two distinct entry paths are visible |
| FR-02 | User can describe their goal with text or voice | Must | Transcript is editable before submission |
| FR-03 | System extracts a workload profile and asks adaptive clarifying questions | Must | User confirms the structured profile |
| FR-04 | System infers a privacy classification and requires confirmation | Must | Privacy classification is visible and editable |
| FR-05 | Privacy and workspace policies act as hard filters | Must | Non-compliant options never enter the ranked set |
| FR-06 | User can choose a simple ranking preset | Must | Preset changes recommendation order |
| FR-07 | System recommends models from existing catalogs across major modalities | Must | Results show modality, source, benchmark, cost, and fit |
| FR-08 | System recommends prompting, RAG, fine-tuning, continued pretraining, or pretraining | Must | Plan explains why the strategy is appropriate |
| FR-09 | User can upload a hardware photo, invoice, PDF, or screenshot | Must | System extracts a hardware profile with confidence |
| FR-10 | User can correct extracted hardware details | Must | Corrected values are used in later recommendations |
| FR-11 | Hardware inventory is reusable and editable by team members | Must | Inventory can be attached to multiple profiles |
| FR-12 | System compares complete systems and build-your-own configurations | Must | At least one complete-system and one component path appear |
| FR-13 | System compares new, refurbished, used, leased, rented, cloud, and API paths | Must | Options are separated by acquisition mode |
| FR-14 | Hardware listings are India-first with global alternatives | Must | Local and international sources are clearly differentiated |
| FR-15 | Listing costs show item, shipping, tax, duty, brokerage, and landed total separately | Must | Cost breakdown is visible on each option |
| FR-16 | Electricity and API/compute usage are separate direct-cost lines | Must | Excluded staff and maintenance costs are stated |
| FR-17 | User chooses the cost comparison horizon | Must | Horizon is shown in the recommendation assumptions |
| FR-18 | Listings show source, confidence, and last-checked time | Must | Stale listings are excluded from primary ranking |
| FR-19 | Team members can add role and daily-work context | Must | Individual inputs produce role-aware opportunities |
| FR-20 | System aggregates shared team opportunities | Must | Similar tasks are grouped with an explanation |
| FR-21 | System generates an implementation plan | Must | Plan includes primary recommendation and alternatives |
| FR-22 | Personal exploration can become a team workspace | Should | User selects what to share and invites collaborators |
| FR-23 | System provides outbound provider and purchase links | Must | No checkout or payment is attempted |
| FR-24 | Workspace administrators can maintain approved models, providers, marketplaces, and regions | Should | Policy filters are applied before ranking |
| FR-25 | Workspace administrators can require plan approval | Should | Approval behavior is configurable per workspace |
| FR-26 | System recommends a suitable topology when the user has multiple machines | Must | Result distinguishes single-node, replicas, sharded inference, distributed training/fine-tuning, and “not recommended” |
| FR-27 | A bounded AI Decision Copilot can ask questions and call approved decision tools | Must | The copilot produces structured actions, respects policy gates, shows uncertainty, and requires approval before saving or sharing |
| FR-28 | System can run bounded public web research and attach citations, timestamps, and source tiers to claims | Must | Research results identify what was checked and distinguish fact, reported experience, inference, and unverified lead |
| FR-29 | System can include X, Reddit, YouTube, forums, and social results as community signals when permitted | Should | Community signals are clearly labeled and cannot affect primary ranking without corroboration |

## 8. Ranking presets

V1 uses presets rather than custom weights:

- **Best Value:** balances quality, total direct cost, availability, and risk.
- **Maximum Performance:** prioritizes capability, latency, memory headroom, and reliability.
- **Lowest Upfront Cost:** prioritizes initial purchase or first-period spend.
- **Privacy / Local-First:** prioritizes local or approved private hosting.
- **Fastest Deployment:** prioritizes availability, setup simplicity, and time to first use.

Hard constraints always run before preset scoring.

## 9. Privacy model

The system suggests one of four labels:

- Public
- Internal
- Confidential
- Highly sensitive

The user confirms the label. A workspace administrator can set a stricter maximum. The most restrictive rule wins. A private requirement excludes external APIs and unapproved providers rather than merely lowering their ranking.

## 10. Cost model

Included direct-cost lines:

- Hardware purchase price
- Shipping
- GST/VAT
- Import duty
- Brokerage/handling
- Electricity
- API or rented-compute usage

Explicitly excluded from V1’s headline comparison:

- Staff time
- Maintenance contracts
- Support
- Office space
- Opportunity cost

The user supplies the comparison horizon. If it is missing, the system asks for it.

## 11. Success criteria

- A non-technical user can create a workload profile without knowing model or hardware terminology.
- A recommendation explains its assumptions and why it ranked first.
- Privacy-invalid options are excluded.
- An Indian user sees a local recommendation and understandable global alternatives.
- A team can turn individual role inputs into one shared opportunity.
- The final plan includes one primary approach and alternatives.
- The entire hero flow can be demonstrated in 5–7 minutes.

## 12. Acceptance tests

### AT-1 — Personal recommendation

Given a user describes a private document workflow by voice, uploads a Mac or PC hardware screenshot, selects Privacy / Local-First, and provides a budget and time horizon, the system produces a confirmed workload profile and a ranked recommendation with cost lines, assumptions, sources, and outbound links.

### AT-2 — Team opportunity discovery

Given three team members submit role and daily-work descriptions, the system keeps detailed profiles private by default, aggregates shared patterns, and explains one team-level opportunity without employee performance scoring.

### AT-3 — Implementation plan and procurement

Given a selected team opportunity, the system generates a plan with a primary strategy, alternatives, model/hosting guidance, direct-cost comparison, hardware options, India-first listings, global alternatives, stale-data warnings, and explicit limitations.

If the workspace contains multiple compatible machines, the plan also states whether to use one node, independent replicas, a sharded model, distributed training/fine-tuning, or no cluster. It must state that hardware memory is not automatically pooled and list the network, runtime, power, cooling, and operational assumptions that the user must verify.

## 13. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Scope becomes a generic AI directory | Keep the workload-to-decision flow as the hero |
| Marketplace data is stale | Timestamp every listing; exclude stale listings from primary ranking |
| Trust claims are too strong | Show evidence and require manual verification |
| Hardware extraction is wrong | Show confidence; preserve source; require user confirmation |
| Privacy is treated as a label only | Apply privacy as a hard filter before ranking |
| The product becomes too technical | Use plain-language explanations and progressive disclosure |
| A technically possible cluster is operationally poor | Prefer one node or replicas when sharding adds network and setup complexity; show interconnect and compatibility assumptions |
| The AI agent hallucinates or overreaches | Restrict it to typed tools, validate every action, keep ranking/policy deterministic, cap steps, and require human approval |
| Uploaded content contains prompt injection | Treat documents and listings as untrusted evidence, never as instructions or authorization |
| Web and social sources are stale, blocked, or misleading | Prefer official sources, use bounded retrieval, show timestamps and citations, preserve conflicts, and treat community content as leads |
| Browser automation violates a site’s access rules | Use documented APIs or permitted public pages first; do not bypass login, CAPTCHA, paywalls, robots directives, or rate limits |
| Live integrations fail during demo | Use live data where available and clearly marked curated fallback data |
| Team inputs feel like surveillance | Private-by-default profiles; aggregated insights; no employee scoring |
