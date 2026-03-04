# Forge

**Forge** is an AI-based onboarding platform that turns a production codebase into a sequenced, modular learning experience—like "lego blocks" in an interactive walkthrough. Instead of reading scattered docs or relying on tribal knowledge, developers progress through blocks that explain a system's modules, dependencies, and intent, with contextual file navigation and AI assistance.

*Built for the 10,000 AIdeas (AWS) competition.*

---

## What it's about

New engineers often spend weeks onboarding through linear, unstructured documentation and tribal knowledge.

That creates predictable pain:
- Slow time-to-first-contribution
- Heavy dependence on senior engineers
- Knowledge loss when experienced teammates leave
- "Vibe coding" risk from AI-assisted development (shipping without understanding *why* code works)

Forge addresses this with a **pedagogy-first** approach:
- Converts a repository into an interactive, step-by-step storyboard
- Explains each block with AI in context
- Links explanations directly to real code

---

## What it does

- **Ingest a repo**
  - Point Forge at a Git URL
  - Clone and store files
  - Reuse an existing parsed build for the same public GitHub commit (so you don't wait twice)
- **Parse & structure**
  - Build a module and dependency graph (AST-style)
  - Understand how the codebase is organized
- **Generate a storyboard**
  - Use AI (Amazon Bedrock) to produce 5–10 ordered blocks
  - Include a learning objective, explanation, key files/symbols, Mermaid diagrams, and suggested questions
  - Keep outputs grounded in the actual repo, not generic advice
- **Walk through & explore**
  - Use a VS Code–style workspace (file explorer, read-only code view, storyboard panel)
  - Move through blocks in order (or jump), open linked files, and view diagrams/explanations together
- **Chat in context**
  - Ask questions in a **block-scoped** chat for each block
  - Constrain AI to that block and its dependencies to reduce hallucinations
- **Role-based paths**
  - Choose frontend, backend, infra, or full-stack
  - Adapt storyboard order and emphasis to what matters first for that role
- **Track progress**
  - Track completion per block and time-on-block
  - Help learners and onboarding owners see progress and potential blockers

Ingest, parse, and storyboard generation run **asynchronously**:
- You can enter the workspace quickly
- Cloning, parsing, and AI generation continue in the background while you browse files
- The UI shows pipeline state (`cloning → parsing → storyboard → ready`) and stays usable throughout

---

## Who it's for

- **New hires & junior engineers** — A guided mental model of the system and safe, contextual Q&A instead of ad-hoc docs.
- **Cross-functional engineers** — A curated path that skips irrelevant depth and highlights the interfaces that matter.
- **Tech leads & onboarding owners** — Reusable onboarding assets and less repetitive mentoring.
- **Distributed teams** — Asynchronous onboarding that preserves architectural intent and stays in sync with the repo.

---

## Goals

- **Reduce onboarding time** by producing a structured, accurate learning path derived directly from the repository.
- **Increase comprehension and confidence** via block-scoped AI chat grounded in the current module and its dependencies.
- **Support role-based paths** (frontend, backend, infra, full-stack) so engineers see what's relevant first.
- **Stay cost-conscious for MVP** with serverless AWS, caching, and on-demand usage (e.g. Bedrock).

---

## Tech at a glance

- **Frontend:** Next.js 16, React 19, TypeScript — VS Code–style layout (file tree, editor, storyboard + chat panel).
- **Backend:** AWS SAM — API Gateway, Lambda (Node.js 20), DynamoDB, S3, Amazon Bedrock (Nova 2 Lite). Parsing uses tree-sitter; storyboard and chat use Bedrock with constrained context.

For **setup, run, and deploy** instructions, see [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md). Repo layout: `frontend/` (Next.js app), `backend/` (SAM template + Lambda handlers), and [PRD/Forge_PRD.md](PRD/Forge_PRD.md) for the full product requirements document.

---

## Team

**Damodar Kamani** · **Agastya Singh** · **Krishna Perla** · **Bowen Xia**
