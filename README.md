# Forge

**Forge** is an AI-powered onboarding platform that turns a codebase into a guided, step-by-step learning experience — like building with lego blocks in an interactive walkthrough. Instead of reading scattered docs or relying on knowledge that only lives in people's heads, developers progress through bite-sized blocks that explain how a system is built, how its pieces connect, and why things work the way they do — with built-in code navigation and AI assistance.

*Built for the 10,000 AIdeas (AWS) competition.*

---

## What it's about

New engineers often spend weeks onboarding through messy documentation and unwritten knowledge passed down by word of mouth. That leads to a slow ramp-up, heavy dependence on senior engineers, and knowledge gaps when experienced teammates leave. AI-assisted development can also encourage "vibe coding" — shipping code without understanding *why* it works — which increases bugs and risk. Forge addresses this with a **learning-first** tool that focuses on real understanding: it turns a repository into an interactive storyboard that teaches the system step-by-step, with each block explained by AI and linked directly to the actual code.

---

## What it does

- **Import a repo** — Point Forge at a GitHub link. It downloads the repo, stores the files, and can reuse a previous analysis of the same version so you don't wait twice.

- **Analyze & organize** — Forge automatically maps out the codebase's structure — its folders, files, and how different pieces depend on each other — so it understands how everything fits together.

- **Generate a storyboard** — AI produces 5–10 ordered "blocks," each with a learning goal, a plain-language explanation, the key files involved, visual diagrams, and suggested questions. Every block is grounded in the actual code, not generic advice.

- **Walk through & explore** — A code-editor-style workspace with a file browser, a read-only code viewer, and a storyboard panel. You move through blocks in order (or jump around), open the referenced files, and see diagrams and explanations all in one place.

- **Chat in context** — For each block, you can ask questions in a focused chat. The AI only has access to that block's scope and related code, so answers stay accurate and relevant.

- **Role-based paths** — Choose a learning path (frontend, backend, infrastructure, or full-stack). The storyboard reorders and adjusts emphasis so you see what matters most for your role first.

- **Track progress** — Completion and time spent per block are tracked, so you (and whoever manages onboarding) can see how far someone has gotten and where they might be stuck.

Import, analysis, and storyboard generation all happen **in the background**: you can start exploring the workspace right away while Forge finishes processing. The UI shows the current stage (downloading → analyzing → generating storyboard → ready) and stays usable throughout.

---

## Who it's for

- **New hires & junior engineers** — A guided tour of the system with safe, focused Q&A instead of scattered docs.

- **Engineers switching teams** — A tailored path that skips what you don't need and highlights the parts that matter for your role.

- **Tech leads & onboarding owners** — Reusable onboarding content and less time spent answering the same questions.

- **Distributed teams** — Self-serve onboarding that captures how the system is designed and stays up to date with the repo.

---

## Goals

- **Reduce onboarding time** by generating a structured, accurate learning path directly from the repository.

- **Increase comprehension and confidence** through focused AI chat that's grounded in the code you're learning about.

- **Support role-based paths** (frontend, backend, infrastructure, full-stack) so engineers see what's relevant first.

- **Stay cost-conscious** with serverless cloud infrastructure, caching, and pay-as-you-go AI usage.

---

## Tech at a glance

- **Frontend:** Next.js 16, React 19, TypeScript — a code-editor-style layout with a file tree, code viewer, and storyboard + chat panel.
- **Backend:** AWS (serverless) — API Gateway, Lambda, DynamoDB, S3, and Amazon Bedrock for AI. Code analysis uses tree-sitter; storyboard and chat are powered by Bedrock with focused context windows.

For **setup, run, and deploy** instructions, see [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md). Repo layout: `frontend/` (Next.js app), `backend/` (SAM template + Lambda handlers), and [PRD/Forge_PRD.md](PRD/Forge_PRD.md) for the full product requirements document.

---

## Team

**Damodar Kamani** · **Agastya Singh** · **Krishna Perla** · **Bowen Xia**
