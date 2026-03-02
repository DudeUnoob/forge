
# Forge

**Forge** is an AI-based onboarding platform that turns a production codebase into a sequenced, modular learning experience—like "lego blocks" in an interactive walkthrough. Instead of reading scattered docs or relying on tribal knowledge, developers progress through blocks that explain a system's modules, dependencies, and intent, with contextual file navigation and AI assistance.

*Built for the 10,000 AIdeas (AWS) competition.*

---

## What it's about

New engineers often spend weeks onboarding through linear, unstructured documentation and tribal knowledge. That leads to slow time-to-first-contribution, heavy dependence on senior engineers, and knowledge loss when experienced teammates leave. AI-assisted development can also encourage "vibe coding"—shipping code without understanding *why* it works—which increases bugs and risk. Forge addresses this with a **pedagogy-first** tool that focuses on understanding: it converts a repository into an interactive storyboard that teaches the system step-by-step, with each block explained in context by AI and linked directly to real code.

---

## What it does

- **Ingest a repo** — Point Forge at a Git URL. It clones the repo, stores files, and (for the same public GitHub commit) can reuse an existing parsed build so you don't wait twice.
- **Parse & structure** — A parser builds a module and dependency graph (AST-style) so the system understands how the codebase is organized.
- **Generate a storyboard** — AI (Amazon Bedrock) produces 5–10 ordered "blocks": each has a learning objective, explanation, key files, key symbols, Mermaid diagrams, and suggested questions. Blocks are grounded in the actual repo, not generic advice.
- **Walk through & explore** — A VS Code–style workspace: file explorer, read-only code view, and a storyboard panel. You move through blocks in order (or jump), open linked files, and see diagrams and explanations in one place.
- **Chat in context** — For each block, you can ask questions in a **block-scoped** chat. The AI is constrained to that block and its dependencies, so answers stay grounded in the code and reduce hallucinations.
- **Role-based paths** — Choose a path (frontend, backend, infra, full-stack). The storyboard order and emphasis adapt so you see what's relevant to your role first.
- **Track progress** — Completion per block and time-on-block are tracked so you (and onboarding owners) can see how far someone's gotten and where they might be stuck.

Ingest, parse, and storyboard generation run **asynchronously**: you can enter the workspace quickly; cloning, parsing, and AI generation continue in the background while you browse files. The UI shows pipeline state (cloning → parsing → storyboard → ready) and stays usable throughout.

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
