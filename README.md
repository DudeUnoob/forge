# 🔨 Forge

**Forge** is an AI-powered onboarding platform that turns any production codebase into a structured, interactive learning experience — like guided "lego blocks" for understanding a system.

> *Built for the 10,000 AIdeas (AWS) competition.*

---

## 📖 Table of Contents

- [What's the Problem?](#-whats-the-problem)
- [What It Does](#-what-it-does)
- [Who It's For](#-who-its-for)
- [Goals](#-goals)
- [Getting Started](#-getting-started)
- [Tech Stack](#-tech-stack)
- [Team](#-team)

---

## 🤔 What's the Problem?

New engineers often spend weeks onboarding through scattered docs and tribal knowledge. This causes:

- 🐌 Slow time-to-first-contribution
- 🔗 Heavy dependence on senior engineers
- 📉 Knowledge loss when experienced teammates leave
- 🤖 "Vibe coding" — shipping code without understanding *why* it works

**Forge fixes this** with a pedagogy-first approach: it converts a repository into an interactive storyboard that teaches the system step-by-step, with each block explained in context by AI and linked directly to real code.

---

## ⚙️ What It Does

| Feature | Description |
|---|---|
| **Ingest a repo** | Point Forge at a Git URL — it clones, stores, and caches the build so you don't wait twice. |
| **Parse & structure** | Builds a module and dependency graph (AST-style) so the system understands the codebase layout. |
| **Generate a storyboard** | AI (Amazon Bedrock) produces 5–10 ordered learning blocks, each with objectives, diagrams, key files, and suggested questions. |
| **Walk through & explore** | A VS Code–style workspace with a file explorer, read-only code view, and storyboard panel. |
| **Chat in context** | Ask questions in a **block-scoped** chat — answers stay grounded in the code and reduce hallucinations. |
| **Role-based paths** | Choose frontend, backend, infra, or full-stack. The storyboard adapts to show what's most relevant. |
| **Track progress** | Completion per block and time-on-block are tracked for you and onboarding owners. |

> **Everything runs asynchronously.** Cloning, parsing, and AI generation happen in the background while you browse files. The UI shows live pipeline state: `cloning → parsing → storyboard → ready`.

---

## 👥 Who It's For

| Audience | Benefit |
|---|---|
| **New hires & junior engineers** | Guided mental model + safe, contextual Q&A |
| **Cross-functional engineers** | Curated paths that skip irrelevant depth |
| **Tech leads & onboarding owners** | Reusable assets and less repetitive mentoring |
| **Distributed teams** | Async onboarding that stays in sync with the repo |

---

## 🎯 Goals

- **⏱ Reduce onboarding time** — structured learning paths derived directly from the repository
- **💡 Increase comprehension** — block-scoped AI chat grounded in the current module
- **🛤 Role-based paths** — engineers see what's relevant to them first
- **💸 Stay cost-conscious** — serverless AWS, caching, and on-demand Bedrock usage

---

## 🚀 Getting Started

1. **Set up the backend** → [backend/README.md](backend/README.md)
2. **Set up the frontend** → [frontend/README.md](frontend/README.md)
3. **Read the full PRD** → [PRD/Forge_PRD.md](PRD/Forge_PRD.md)

### Repo Layout

```
forge/
├── frontend/     # Next.js app
├── backend/      # AWS SAM template + Lambda handlers
└── PRD/          # Product requirements document
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Backend** | AWS SAM, API Gateway, Lambda (Node.js 20) |
| **Database** | DynamoDB |
| **Storage** | S3 |
| **AI** | Amazon Bedrock (Nova 2 Lite) |
| **Parsing** | tree-sitter |

---

## 👨‍💻 Team

**Damodar Kamani** · **Agastya Singh** · **Krishna Perla** · **Bowen Xia**
