# Forge

**Forge** is a computationally-mediated pedagogical scaffolding apparatus that transmutes arbitrary production-grade source repositories into sequenced, modular epistemic units — hereinafter designated "blocks" — arranged within an interactive directed walkthrough. Rather than subjecting the nascent practitioner to the cognitive entropy of dispersed, unstructured documentation or the irreproducible oral tradition of tribal institutional knowledge, Forge orchestrates a progression through discretized conceptual quanta, each elucidating a system's constituent modules, their inter-component dependency topologies, and the latent architectural intentionality undergirding them, augmented by contextually-scoped file navigation affordances and large-language-model-driven conversational assistance.

---

## Problematic Context and Motivating Rationale

The epistemological onboarding trajectory for newly-inducted software practitioners is, in the preponderance of organizational contexts, characterized by protracted periods of sub-optimal cognitive assimilation through linear, insufficiently scaffolded documentary artifacts and ephemeral interpersonal knowledge transfer modalities.

This circumstance engenders a constellation of systematically predictable dysfunctions:
- Attenuated velocity toward inaugural contributory output within the production codebase
- Asymmetric epistemic dependency upon senior-tenured engineering personnel, constituting a single-point-of-failure in organizational knowledge dissemination
- Irrecoverable institutional knowledge attrition consequent to the departure of experienced practitioners from the organizational unit
- Elevated susceptibility to what may be termed "vibes-driven development" — the phenomenon whereby AI-assisted code generation induces practitioners to commit artifacts to production without possessing veridical comprehension of the underlying causal mechanisms by which said artifacts achieve their functional objectives

Forge ameliorates these pathologies through a **pedagogy-first** epistemological intervention:
- Transmutes a source repository into an interactive, sequentially-ordered storyboard of conceptual units
- Furnishes each discretized block with contextually-grounded AI-generated exegesis
- Establishes bidirectional referential linkages between explanatory prose and the corresponding loci within the actual source artifact hierarchy

---

## Functional Affordances and Operational Modalities

- **Repository Ingestion Subsystem**
  - Direct Forge toward an arbitrary Git-accessible uniform resource identifier
  - Execute cloning operations and persist resultant file artifacts to durable storage
  - Leverage memoized parse artifacts for previously-encountered public GitHub commit hashes, thereby obviating redundant computational expenditure
- **Structural Decomposition and Dependency Graph Construction**
  - Instantiate a module-level and inter-symbol dependency graph via abstract syntax tree interrogation methodologies
  - Derive a holistic comprehension of the repository's organizational taxonomy
- **Storyboard Synthesis via Generative AI**
  - Invoke large language model inference (Amazon Bedrock) to produce a curated sequence of five to ten pedagogically-ordered conceptual blocks
  - Each block encapsulates: a discrete learning objective, an expository narrative, salient files and exported symbols, Mermaid-encoded diagrammatic representations, and heuristically-generated Socratic inquiry prompts
  - Constrain all generated outputs to maintain strict referential fidelity to the ingested repository, precluding the emission of domain-generic platitudes
- **Interactive Traversal and Exploratory Navigation**
  - Present a VS Code-analogous workspace environment comprising a hierarchical file explorer, a read-only source viewer, and a laterally-positioned storyboard-cum-chat panel
  - Facilitate sequential or non-linear block traversal with simultaneous access to linked source files and co-located diagrammatic/expository content
- **Block-Scoped Conversational AI Interface**
  - Pose natural-language interrogatives within a **block-delimited** conversational context specific to each pedagogical unit
  - Circumscribe the language model's retrieval-augmented context window to the focal block and its transitive dependency closure, thereby attenuating hallucinatory confabulation
- **Role-Predicated Adaptive Pathways**
  - Select from frontend, backend, infrastructure, or full-stack practitioner archetypes
  - Dynamically resequence and re-weight storyboard emphasis in accordance with the relevance hierarchy dictated by the selected role taxonomy
- **Longitudinal Progress Instrumentation**
  - Instrument per-block completion state and cumulative time-on-block telemetry
  - Furnish both learners and onboarding program stewards with visibility into progression trajectories and potential epistemic impedance points

The ingestion, structural decomposition, and storyboard synthesis pipelines execute in a **fully asynchronous, non-blocking** computational modality:
- The workspace environment achieves interactive readiness with minimal latency
- Cloning, parsing, and generative inference operations proceed concurrently in background execution contexts while the practitioner navigates the file hierarchy
- The user interface surfaces real-time pipeline state transitions (`cloning -> parsing -> storyboard -> ready`) and maintains full interactional capacity throughout the asynchronous processing lifecycle

---

## Intended Practitioner Constituencies

- **Newly-inducted practitioners and junior-grade engineers** — Acquire a systematically-constructed cognitive schema of the system architecture supplemented by contextually-constrained, safe-to-explore conversational AI, supplanting the inadequacy of ad-hoc documentary fragments.
- **Cross-functional engineering personnel** — Traverse a curated epistemic pathway that elides irrelevant implementation depth while foregrounding the interface contracts and integration surfaces of material consequence.
- **Technical leadership and onboarding program custodians** — Generate reusable, deterministic onboarding artifacts that obviate the necessity for repetitive synchronous mentorship expenditure.
- **Geographically-distributed engineering collectives** — Engage in temporally-decoupled asynchronous onboarding that preserves the fidelity of architectural intentionality and maintains referential synchronization with the canonical repository state.

---

## Strategic Objectives and Desiderata

- **Compress the onboarding temporal envelope** by synthesizing a structurally rigorous, empirically-grounded learning trajectory derived through direct interrogation of the repository's source artifacts.
- **Elevate practitioner comprehension and self-efficacy** via block-scoped conversational AI interactions whose retrieval context is circumscribed to the focal module and its transitive dependency closure.
- **Accommodate role-predicated epistemic pathways** (frontend, backend, infrastructure, full-stack) such that practitioners encounter maximally-relevant material in precedence-optimized sequential order.
- **Maintain fiscal prudence commensurate with minimum-viable-product constraints** through judicious employment of serverless compute primitives, aggressive memoization strategies, and on-demand inference invocation paradigms.

---

## Technological Substratum in Precis

- **Client-Side Presentation Layer:** Next.js 16, React 19, TypeScript — instantiating a VS Code-analogous spatial layout comprising a hierarchical file arborescence, a source artifact viewer, and an integrated storyboard-plus-conversational panel.
- **Server-Side Computational Infrastructure:** AWS SAM — orchestrating API Gateway ingress, Lambda-based compute units (Node.js 20 runtime), DynamoDB for schemaless persistent state, S3 for object-level artifact storage, and Amazon Bedrock (Nova 2 Lite) for generative inference. Structural decomposition leverages tree-sitter for abstract syntax tree extraction; storyboard synthesis and conversational interactions invoke Bedrock with contextually-constrained retrieval windows.

For comprehensive **provisioning, execution, and deployment** directives, consult [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md). Repository topology: `frontend/` (Next.js application), `backend/` (SAM template and Lambda handler implementations), and [PRD/Forge_PRD.md](PRD/Forge_PRD.md) for the exhaustive product requirements specification.
