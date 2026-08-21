# Product and UX Specification

## 1. Experience model

The product has two clearly separated entry points:

### Personal Explorer

Tone: calm, explanatory, non-technical.  
Primary action: **Describe what you want to do with AI.**

The user should be able to begin with a sentence such as:

> “I run a small factory and want to search invoices and scanned paperwork privately without sending them to an external company.”

### Team / Business

Tone: structured, collaborative, decision-oriented.  
Primary action: **Start a shared AI opportunity workspace.**

The user sees privacy policy, member roles, shared opportunities, hardware inventory, recommendation history, and implementation plans.

## 2.1 Decision Copilot surface

Decision Copilot appears as a guided panel inside Personal Explorer and as an optional assistant inside a team opportunity. It should show:

- the current step: intake, clarification, evidence, comparison, or approval;
- one concise next question when a required fact is missing;
- a compact **What the copilot checked** trace;
- source, freshness, assumptions, and uncertainty labels;
- a clear **Approve and save** action;
- a typed-input fallback when the agent model or voice service is unavailable.

The panel is not a generic chat window. It should keep the user on the decision path and progressively reveal technical detail only when requested.

### Research Scout surface

When the user asks for current or recent information, show a small research scope choice:

- Official and benchmark sources
- Official plus community signals
- Hardware and purchase research

The result surface shows:

- research checked time and scope;
- source tier and direct link;
- claim type: fact, reported experience, inference, or unverified lead;
- corroboration and conflicting claims;
- a **Community signals to investigate** section separate from ranked recommendations;
- a retry or cached-result state when a source is blocked or unavailable.

Browser fetching is invisible as infrastructure but visible as provenance: the user should know whether a claim came from an API, public page, browser-rendered page, cached snapshot, or curated demo fixture.

## 2. Suggested route map

| Route | Purpose |
| --- | --- |
| `/` | Mode selection and demo entry |
| `/explore/new` | Personal text/voice intake |
| `/explore/profiles/[id]` | Confirmed workload and hardware context |
| `/recommendations/[id]` | Ranked models, hosting, hardware, and listings |
| `/workspaces/[id]` | Team overview and shared opportunities |
| `/workspaces/[id]/members` | Role context and consent controls |
| `/workspaces/[id]/inventory` | Shared owned and planned hardware |
| `/workspaces/[id]/plans/[planId]` | Implementation plan and alternatives |
| `/settings/policies` | Privacy and approved-source policies |

Keep the implementation within the existing web-app route budget. The marketplace is a result surface, not a separate checkout product.

## 3. Personal Explorer flow

### Step 1 — Describe the work

Controls:

- Text area
- Push-to-talk microphone
- Live transcript
- Edit transcript
- Clear audio-status indicator

Copy:

> “You do not need to know the model name. Tell us about the work you want to improve.”

### Step 2 — Confirm the workload

Display the extracted facts as editable chips or cards:

- Goal
- Inputs: text, PDFs, images, audio, video, spreadsheets, or mixed
- Outputs
- Expected users
- Frequency and peak usage
- Privacy suggestion
- Budget and country
- Comparison horizon

Unknown values appear as **Not specified**, never as invented facts.

### Step 3 — Identify current hardware

Accept:

- Device photo
- Product-box photo
- Invoice
- Hardware specification PDF
- System-information screenshot
- Typed model name

Show each extracted field with a confidence indicator and an edit control. Preserve the source reference.

### Step 4 — Choose preference

Use a small set of clear presets:

- Best Value
- Maximum Performance
- Lowest Upfront Cost
- Privacy / Local-First
- Fastest Deployment

Do not expose weighted sliders in V1.

### Step 5 — Review recommendation

Top result card contains:

- Recommendation title
- Why it fits the workload
- Hosting mode
- Model family and modality
- Hardware or provider requirement
- Direct-cost summary
- Privacy result
- Confidence and assumptions

Secondary cards show alternatives and why they differ.

### Step 6 — Procurement options

Separate sections:

- Buy a complete system
- Build from components
- Use existing hardware and upgrade
- Lease or rent hardware
- Use cloud compute
- Use an API

Each listing shows source, condition, seller, cost lines, freshness, and manual-verification notice.

### Connect existing machines

When the inventory contains two or more usable machines, show a **Cluster recommendation** card beside the ordinary single-machine and hosted options. The card must state:

- Topology: one node, independent replicas, sharded inference, distributed training/fine-tuning, or not recommended
- Which machines are included and what role each one has
- Whether the model is copied to every machine or split across machines
- Required runtime, operating-system, accelerator, and network assumptions
- Expected benefit: model fit, throughput, availability, or training time
- Main bottleneck and why a simpler single-machine or API path may be better

Use plain language such as “three separate workers” or “one model split across two nodes.” Never present total system memory as usable model memory without a compatible runtime and topology.

## 4. Team / Business flow

1. Create or convert to a workspace.
2. Invite members.
3. Each member describes role, recurring tasks, tools, data, pain points, and intended AI use.
4. Profiles remain private by default.
5. The system aggregates shared patterns without exposing private details.
6. Team sees opportunities grouped by workflow.
7. Team selects an opportunity.
8. System generates an implementation plan.
9. Members review the primary recommendation and alternatives.
10. Workspace policy controls whether an administrator approval step is required.

## 5. Hardware inventory behavior

Inventory supports both existing and planned hardware. Status values:

- Owned and available
- Owned but in use
- Planned purchase
- Retired or unavailable

Members can view and edit shared inventory. V1 does not assign or reserve devices for workloads.

Members may group confirmed assets into a proposed cluster for analysis, but V1 does not provision, configure, monitor, or remotely control that cluster.

## 6. Listing trust and freshness

Every listing shows:

- Marketplace
- Seller
- Source URL
- Last checked
- Price timestamp
- Condition
- Warranty information
- Return information
- Shipping destination
- “User verification required” where information is incomplete

The product never guarantees a seller. Stale listings are visible only in a lower-confidence section and are excluded from the primary ranking.

## 7. Accessibility and usability

- Voice is optional; typed input is always available.
- Important information is not hover-only.
- Every recommendation has a plain-language explanation.
- Privacy and uncertainty use text labels, not color alone.
- The primary flow is usable on desktop and mobile browsers.
- Uploads show progress, failure, and retry states.

## 8. Empty, loading, and error states

The product must explain:

- “We need one more detail before we can rank options.”
- “This listing was last checked recently, but you should confirm final price and warranty.”
- “The live source is unavailable; this result uses curated demo data.”
- “We could not identify the hardware confidently. Please edit or skip this field.”
