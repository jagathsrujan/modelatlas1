# ModelAtlas - CodeFury 9.0 Solution Document

## Theme: AI Marketplace

**Project / working team name:** ModelAtlas  
**Application:** Web application  
**Team:** LARP  
**Team member:** Jagath Srujan  
**Institution:** University of Visvesvaraya College of Engineering  
**Contact:** jagathsrujan@zohomail.in | +91 9483228266  
**Submission date:** 22 August 2026, before 5:59 PM  
**Final filename:** `LARP_Documentation.pdf`

## The idea in one sentence

ModelAtlas helps a person or a business decide what AI to use, where to run it, and what it will really cost - before they buy anything.

## Why we built it

Choosing AI is confusing. A business is often asked to choose a model, a cloud provider, a GPU, and a monthly budget before it has clearly described the work it wants AI to do. Different options also come with different privacy, hardware, cost, and setup requirements.

ModelAtlas puts those questions in a sensible order. It starts with the work, checks the boundaries, looks at what the team already has, and then compares the options that actually fit.

## The problem we are solving

Consider an Indian manufacturing company:

- Finance has invoices and scanned paperwork.
- Operations has spreadsheets and inventory information.
- Support has product images and internal documents.

The team wants a private document assistant, but it does not know whether to use an external API, a local model, a cloud GPU, or its existing machines. It needs more than a model catalogue. It needs a decision it can explain to a manager, check with its IT team, and turn into a practical plan.

That is the job of ModelAtlas.

## How ModelAtlas works

### 1. Start with the work

The user describes the job in normal language. ModelAtlas turns it into a simple profile: what kind of information is involved, how much work is expected, how many people will use it, the budget, the country, and the time horizon.

### 2. Set the boundaries

The user chooses how private the work is. Privacy is a real filter. If the work is confidential, ModelAtlas removes options that would send the data to an unsuitable external service.

### 3. Check what is already available

The user can add a screenshot, invoice, box photo, or specification for existing hardware. ModelAtlas shows which details are confirmed and which still need a human check.

### 4. Compare options that fit

ModelAtlas compares model families, hosting choices, hardware, and procurement routes. It explains why an option fits, what it costs, what assumptions were made, and what the risks are.

### 5. Leave with a plan

The result is not a shopping cart. It is a recommendation and an implementation plan that can be reviewed by a team.

## What the application includes

- **Personal Explorer:** a guided way to describe a workload without needing model or infrastructure knowledge.
- **Privacy filter:** public, internal, confidential, and highly sensitive classifications that affect eligibility.
- **Hardware verification:** evidence review with confidence on each extracted field.
- **Recommendation view:** a primary option, alternatives, trade-offs, risks, and verification tasks.
- **Research Scout:** source-backed information from official, benchmark, procurement, and community sources.
- **Cost comparison:** separate lines for hardware, shipping, tax, electricity, usage, and other assumptions.
- **Team workspace:** private role profiles can contribute to one shared opportunity without employee scoring.
- **Implementation plan:** architecture, delivery steps, risks, approvals, and success measures.
- **Ask ModelAtlas:** an assistant that explains the decision in plain language.
- **Secure access:** Google sign-in, magic link, and email/password authentication.
- **Seeded demo:** the full main journey can be shown without API keys or live scraping.

## The demo story

In the seeded demo, a Finance user describes a private document workflow for an Indian manufacturing company. They confirm that the data is confidential, verify a Mac Studio and RTX 4090 from hardware evidence, and choose the Privacy / Local-First preference.

ModelAtlas recommends a private document assistant, explains why it fits, shows the costs and alternatives, and links each important fact to its source and confidence. The user can then move the decision into a team workspace, combine the useful context from Finance, Operations, and Support, and create an implementation plan.

This gives the judges a complete story: from an unclear business need to a practical AI decision.

## Prompts implemented in the application

The competition asks teams to mention the prompts they implemented. ModelAtlas uses prompts in three focused places:

1. **Intake Copilot** - asks for the most important missing detail one question at a time and helps turn a plain-language description into a workload profile.
2. **ModelAtlas Assistant** - explains recommendations clearly, follows the privacy boundary, does not invent prices or benchmarks, and warns when hardware cannot be combined safely.
3. **Research Scout** - helps check current model, benchmark, availability, and price information and keeps the source, date, and confidence visible.

AI helps with questions, explanations, and research. The privacy filter, cost calculations, ranking rules, and hardware checks remain explicit so the assistant cannot quietly override them.

## Why this is an AI Marketplace solution

ModelAtlas covers the parts of an AI marketplace that are difficult for a non-specialist:

- **Discover:** find models and approaches by starting from the real workload.
- **Evaluate:** compare capability, privacy, hardware, setup effort, and cost.
- **Trust:** see the source, date, evidence type, and confidence behind important claims.
- **Plan:** turn the decision into an architecture and delivery plan.
- **Obtain:** follow outbound links to relevant products or services without pretending to be a checkout system.

## What makes the approach different

Most model catalogues begin with model names. ModelAtlas begins with the user's work and removes unsuitable choices before ranking the rest. It also treats privacy as a hard boundary, keeps cost assumptions visible, and avoids presenting a confident answer when the evidence still needs checking.

## Technology and responsible use

The application is built as a Next.js web application with TypeScript, Tailwind CSS, Zod, and Supabase. It supports secure authentication and private data access. In demo mode, it runs from seeded data so the judges can follow the complete flow reliably.

ModelAtlas does not provision servers, process a purchase, or send confidential documents to an external provider merely to answer a question. External pages and uploaded files are treated as evidence and checked before they influence a recommendation.

## Solution to the problem statement

ModelAtlas solves the AI Marketplace problem by helping people make a buying decision in the right order. A user starts with the work they want to improve, not with a model name. They describe the documents, images, request volume, users, budget, location, and privacy needs. ModelAtlas turns that description into a clear workload profile. It then removes options that do not meet the privacy or hardware requirements, checks the evidence for the equipment already available, and compares the remaining options on capability, hosting, cost, and setup effort. Each important claim is shown with its source and confidence. For an Indian manufacturing company, the platform also separates hardware price, shipping, tax, electricity, and usage costs instead of showing one vague number. A team can keep individual role details private, combine the useful parts into a shared opportunity, and produce an implementation plan. The built-in assistant explains the recommendation in simple language, while Research Scout helps check current facts. ModelAtlas does not pretend to be a checkout or provisioning tool; it gives the team a decision they can understand, discuss, and act on.

## Links to add before submission

- GitHub repository: https://github.com/jagathsrujan/modelatlas1
- Hosted website: https://modelatlas1.vercel.app/
- Demo video folder: https://drive.google.com/drive/folders/1IDePrOSCO3KlUjUc9gPjhMADEKS5Q7WO?usp=share_link (video file: `demo`)
- Team name and member: LARP - Jagath Srujan

## Final upload checklist

- Save this document as `LARP_Documentation.pdf`.
- Upload it to Google Drive and make the link public for judges.
- The submission is web-only; no Android APK is included.
- The website is hosted at https://modelatlas1.vercel.app/ - test it from a private browser window.
- Record the demo from the hosted website, upload it to YouTube or Google Drive, and test the public link.
- Confirm the GitHub repository is accessible.
- Confirm the final source-code deadline with the organizers because the supplied rules PDF contains a 2025 / 2026 date mismatch.
