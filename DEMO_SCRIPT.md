# CodeFury Demo Script

## Demo objective

Show that ModelAtlas can move from an everyday work problem to a privacy-aware AI strategy, hardware/procurement recommendation, shared team opportunity, and implementation plan in 5–7 minutes.

The demo is scripted, but the interface remains interactive after the hero path. Live source data is used where reliable; curated fallback data is clearly labeled.

## Anchor story

“A small Indian manufacturing company wants to use AI on invoices, scanned paperwork, spreadsheets, product images, and internal documents. The company does not want sensitive documents sent to an unapproved external API.”

## Run of show

### 0:00–0:30 — Start in Personal Explorer

Narration:

> “The user does not start by choosing an AI model. They start by describing their work.”

Action:

- Choose Personal Explorer.
- Hold the microphone button.
- Say the seeded finance/operations scenario.
- Show editable live transcript.

Evidence:

- Voice intake
- Typed fallback exists
- No model terminology required
- Decision Copilot visibly guides the session instead of returning an unstructured chatbot answer

### 0:30–1:15 — Confirm workload

Action:

- Show extracted inputs: PDFs, images, spreadsheets, scanned paperwork.
- Confirm expected users, usage, location, budget, and comparison horizon.
- Accept the suggested **Confidential** privacy classification.

Narration:

> “Privacy is a gate. It will not merely make an external API less attractive; it removes it from the eligible set.”

### 1:15–1:50 — Identify hardware

Action:

- Upload a seeded system-information screenshot or invoice.
- Show extracted device fields and confidence.
- Edit one field.
- Save it to the reusable hardware inventory.

Evidence:

- Hardware discovery
- User correction
- Reusable inventory

Optional cluster variant: add two or three seeded machines to the inventory and show that ModelAtlas evaluates them as a topology rather than simply adding their memory together.

### 1:50–2:40 — Show recommendation

Action:

- Select **Privacy / Local-First**.
- Show the recommended existing model family and hosting approach.
- Show why a simpler RAG approach is recommended before fine-tuning or pretraining.
- Show primary recommendation and alternatives.
- If multiple machines are in inventory, expand the cluster card and show whether the answer is one node, replicas, sharded inference, distributed training/fine-tuning, or no cluster.
- Expand “What the copilot checked” to show workload normalization, privacy gate, catalog lookup, cost calculation, and ranking.
- Click **Refresh with Research Scout** and show one official source, one technical/benchmark source, and one clearly labeled Reddit/X/YouTube signal under **Community signals to investigate**.

Narration:

> “ModelAtlas recommends the simplest sufficient strategy and explains the more expensive options it rejected.”

### 2:40–3:30 — Show procurement options

Action:

- Compare local complete system, build-your-own upgrade, rented/cloud option, and API option.
- Show item price, shipping, GST/VAT, duty, brokerage, landed total, electricity, and API/compute lines separately.
- Switch between **Best Value** and **Maximum Performance**.
- Show India-first listings and one global alternative.
- Point to last-checked time and manual-verification notice.

Evidence:

- International marketplace layer
- Ranking presets
- Cost transparency
- No checkout claim

### 3:30–4:15 — Convert to team workspace

Action:

- Click **Turn into team workspace**.
- Invite seeded finance, operations, and support members.
- Show that profiles are private by default.

### 4:15–4:55 — Aggregate team opportunities

Action:

- Open role inputs.
- Show one shared pattern: repeated document processing across multiple roles.
- Display the aggregated opportunity card with roles affected and data sensitivity.

Narration:

> “The product finds shared workflow opportunities without turning employee answers into performance scores.”

### 4:55–5:50 — Generate implementation plan

Action:

- Select the shared document opportunity.
- Generate the plan.
- Show primary recommendation plus two alternatives.
- Expand sections for strategy, hosting, hardware, direct cost, risks, phases, and success metrics.

Evidence:

- Architecture-and-execution plan
- RAG/fine-tuning/pretraining guidance
- Team decision support

### 5:50–6:30 — Show all model families and limitations

Action:

- Briefly switch the catalog filter through language, vision, speech, audio, video, embedding, code, and multimodal families.
- Show benchmark-based metadata cards.
- Point out that V1 does not run user data through models.

Closing line:

> “ModelAtlas helps people choose and plan before they spend money or expose data. It is a decision layer across models, hosting, hardware, and procurement.”

## Demo fallback rules

- If a marketplace source fails, show curated data with a visible label.
- If speech-to-text fails, use the prefilled transcript and type fallback.
- If authentication fails, use seeded demo workspace.
- If a model source fails, use the last verified snapshot.
- If research sources fail or are blocked, use the curated research fixture and show the limitation.
- Never claim a fallback result is live.

## Judge questions to prepare for

### “Is this just a wrapper?”

Answer:

> “The model helps ask questions and orchestrate the workflow, but it cannot override our policy, cost, compatibility, or ranking logic. The recommendation comes from validated tools and evidence, with a trace of what was checked.”

### “Can the agent make a purchase or deploy the system?”

Answer:

> “No. It can compare options and prepare outbound links or a team plan, but saving, sharing, purchasing, and deployment remain explicit user actions.”

### “Why not simply use a frontier model?”

Answer:

> “The system can recommend one when it fits, but it first checks whether a smaller or local model is sufficient and safer for the workload.”

### “Can I buy directly?”

Answer:

> “V1 provides outbound links and transparent cost/risk information. It does not handle checkout.”

### “Can I connect several PCs, Macs, or DGX Spark systems?”

Answer:

> “Yes, but the recommendation depends on the goal. Several machines can run independent replicas for more throughput, or a compatible runtime can split one model across nodes when one machine cannot fit it. The product checks the interconnect and software path, and it can recommend one stronger machine when clustering would add complexity without enough benefit. It never assumes that the machines’ memory automatically pools.”

### “How do you stop social media misinformation from changing the recommendation?”

Answer:

> “Social posts are discovery signals, not authoritative specifications or benchmarks. We show their source and date, preserve disagreement, and require corroboration before a community claim can affect the primary recommendation. Otherwise it stays in a separate investigation section.”

### “Are the prices guaranteed?”

Answer:

> “No. Every listing has a source and last-checked time, and the user is told to manually verify the final price, stock, warranty, and return policy.”
