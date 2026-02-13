\# Forge — Product Requirements Document (PRD)  
\*\*Competition:\*\* 10,000 AIdeas (AWS) \[file:1\]    
\*\*Doc owner:\*\* Forge team \[file:1\]    
\*\*Last updated:\*\* 2026-02-12 \[file:1\]    
\*\*Status:\*\* Draft (MVP-focused) \[file:1\]

\#\# 1\) Overview  
Forge is an AI-based onboarding platform that turns a production codebase into a sequenced, modular learning experience presented as “lego blocks” in an interactive walkthrough. \[file:1\]    
Instead of reading scattered docs, a developer progresses through blocks that explain a system’s modules, dependencies, and intent, with contextual file navigation and AI assistance. \[file:1\]

\#\#\# Elevator pitch  
Forge converts a repository into an interactive storyboard that teaches a new engineer the system step-by-step, with each block explained in context by AI and linked directly to real code. \[file:1\]

\#\# 2\) Problem & opportunity  
New engineers often spend weeks onboarding via linear, unstructured documentation and tribal knowledge. \[file:1\]    
This creates slow time-to-first-contribution, heavy dependence on senior engineers, and knowledge loss when experienced teammates leave. \[file:1\]    
AI-assisted development can worsen “vibe coding” (implementation without comprehension), increasing bugs and security risk—so the opportunity is a pedagogy-first tool that pushes understanding of \*why\* the code works. \[file:1\]

\#\# 3\) Goals (what success looks like)  
\- Reduce onboarding time by producing a structured, accurate learning path derived directly from the repository. \[file:1\]  
\- Increase comprehension and confidence via contextual, block-scoped AI chat grounded in the current module and its dependencies. \[file:1\]  
\- Support role-based onboarding paths (frontend, backend, infra, full-stack) so engineers see what’s relevant first. \[file:1\]  
\- Stay within an AWS free-tier strategy for the MVP by limiting repo size, caching parse results, and using on-demand/serverless where possible. \[file:1\]\[web:8\]\[web:9\]

\#\# 4\) Non-goals (MVP)  
\- Full multi-language coverage for every ecosystem and build system (MVP targets a limited set like TS/JS \+ Python). \[file:1\]  
\- Automated code modification, PR creation, or “agentic refactors” (Forge is onboarding-first, not a coding copilot). \[file:1\]  
\- Enterprise-grade compliance certifications in MVP (SOC2/HIPAA, etc.). \[file:1\]

\#\# 5\) Target users & personas  
\- \*\*New hire / junior engineer:\*\* Needs a guided mental model of the system and safe, contextual Q\&A. \[file:1\]  
\- \*\*Cross-functional engineer:\*\* Needs a curated path that skips irrelevant depth and highlights interfaces. \[file:1\]  
\- \*\*Tech lead / onboarding owner:\*\* Needs reusable onboarding assets and reduced mentoring load. \[file:1\]  
\- \*\*Distributed teams:\*\* Need asynchronous onboarding that preserves architectural intent over time. \[file:1\]

\#\# 6\) Core user experience (VS Code-style)  
The frontend will feel like a \*\*\[VS Code\](navigational\_search:Visual Studio Code)\*\*-style IDE fork/application: file explorer on the left, editor in the center, and a panel for storyboard \+ chat \+ tasks. (User-provided context)    
The “Storyboard” is the primary navigation surface: developers scroll and complete blocks in order, while still being able to jump to linked files and references. \[file:1\]

\#\# 7\) Primary use cases  
\- UC1: Ingest a repository and generate a storyboard of 5–10 blocks for an MVP demo repo. \[file:1\]  
\- UC2: Walk through blocks sequentially; each block includes explanation, references, and diagram(s). \[file:1\]  
\- UC3: Ask questions in a block-scoped chat that is constrained to the module and its dependencies. \[file:1\]  
\- UC4: Follow role-based onboarding paths (frontend/backend/infra) that reorder and filter blocks. \[file:1\]  
\- UC5: Track progress, time-on-block, and knowledge gaps; recommend resources. \[file:1\]

\#\# 8\) Functional requirements

\#\#\# 8.1 Repository ingestion & snapshotting  
\*\*FR-1\*\* Upload or connect a repo (MVP: upload zip or connect via Git URL) and create a snapshot. \[file:1\]    
\*\*FR-2\*\* Store snapshots and derived artifacts (AST JSON, storyboard JSON, diagrams) in \*\*\[Amazon S3\](navigational\_search:Amazon S3)\*\*. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- User can select a repo snapshot and see a deterministic “Parsed” status with artifact counts (files, modules, edges). \[file:1\]

\#\#\# 8.2 Repository parser (AST \+ module graph)  
\*\*FR-3\*\* Run a parser that produces an abstract syntax tree (AST) and module/dependency graph (functions/classes/modules \+ edges). \[file:1\]    
\*\*FR-4\*\* Persist module metadata and dependency edges to \*\*\[Amazon DynamoDB\](navigational\_search:Amazon DynamoDB)\*\*; store heavy artifacts (AST blobs) in S3. \[file:1\]    
\*\*FR-5\*\* Cache results so the same repo commit SHA is not re-parsed unless forced. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- For a test repo (e.g., Express/FastAPI-scale), parser outputs a module list and dependency graph that can be rendered as a simple diagram. \[file:1\]

\#\#\# 8.3 Storyboard generation (AI)  
\*\*FR-6\*\* Generate a storyboard: ordered “lego blocks” that teach the codebase from foundational to advanced concepts. \[file:1\]    
\*\*FR-7\*\* Each block includes: title, learning objective, explanation, key files, key symbols, dependency context, backward/forward references, and resource links. \[file:1\]    
\*\*FR-8\*\* Use \*\*\[Amazon Bedrock\](navigational\_search:Amazon Bedrock)\*\* for LLM generation in on-demand mode, with guardrails via constrained context (only relevant code/docs injected). \[file:1\]\[web:13\]    
\*\*FR-9\*\* Store storyboard JSON in DynamoDB and version it by repo snapshot \+ generation settings. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- Given a repo snapshot, Forge can generate 5–10 blocks in JSON with stable schema and render them in the UI. \[file:1\]

\#\#\# 8.4 Interactive walkthrough (Storyboard UI)  
\*\*FR-10\*\* Provide a “Storyboard View” that lists blocks, shows completion state, and opens block detail. \[file:1\]    
\*\*FR-11\*\* Block detail includes explanation, diagram(s), and deep links into repository files/lines. \[file:1\]    
\*\*FR-12\*\* Provide a file explorer \+ editor view to open linked files and view code read-only in MVP. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- User can complete a block, proceed to the next, and open all referenced files from the block detail. \[file:1\]

\#\#\# 8.5 Contextual, block-scoped AI chat  
\*\*FR-13\*\* Chat is scoped to the selected block \+ its dependencies (not the whole repo by default) to reduce hallucinations and irrelevant answers. \[file:1\]    
\*\*FR-14\*\* Chat prompts must include: block summary, key code snippets, symbol table, and relevant docs; responses must cite linked artifacts (file path \+ symbol). \[file:1\]    
\*\*FR-15\*\* Store chat history per user \+ repo \+ block for continuity. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- For 10 typical onboarding questions, at least 8 responses include correct file-level grounding (paths/symbols) and do not reference nonexistent APIs. \[file:1\]

\#\#\# 8.6 Role-based paths  
\*\*FR-16\*\* Support multiple onboarding roles that reorder/filter blocks (frontend/backend/infra/full-stack). \[file:1\]    
\*\*FR-17\*\* Role selection changes the default storyboard path and the chat scope emphasis (e.g., infra path highlights pipelines/services). \[file:1\]    
\*\*Acceptance criteria\*\*  
\- Switching roles changes block ordering and hides at least one irrelevant block category in MVP. \[file:1\]

\#\#\# 8.7 Progress & comprehension tracking  
\*\*FR-18\*\* Track per-user: blocks completed, time spent per block, and optional mini-checkpoint questions (MVP: lightweight). \[file:1\]    
\*\*FR-19\*\* Detect “stuck” signals (time threshold, repeated questions) and recommend: revisit prerequisite block, read doc link, or view example test. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- A user dashboard shows progress %, recent blocks, and “recommended next block.” \[file:1\]

\#\#\# 8.8 Semantic search (docs \+ code)  
\*\*FR-20\*\* Provide semantic search for docs/code to support chat and manual exploration (MVP: limited scope). \[file:1\]    
\*\*Implementation options (MVP)\*\*  
\- \*\*\[Amazon OpenSearch\](navigational\_search:Amazon OpenSearch Service)\*\* for semantic indexing, or a simpler vector search using embeddings and DynamoDB storage. \[file:1\]    
\*\*Acceptance criteria\*\*  
\- Searching “authentication flow” returns at least 3 relevant artifacts (files/blocks/docs) for the demo repo. \[file:1\]

\#\# 9\) Data model (MVP schemas)

\#\#\# 9.1 StoryboardBlock (JSON)  
\- blockId (string)  
\- title (string)  
\- roleTags (string\[\])  
\- objective (string)  
\- explanationMarkdown (string)  
\- prerequisites (blockId\[\])  
\- next (blockId\[\])  
\- keyFiles (path\[\])  
\- keySymbols (string\[\])  
\- dependencySummary (string)  
\- diagramRefs (s3Url\[\])  
\- resources (url\[\])  
\- generatedAt (timestamp)  
\- generatorConfig (object) \[file:1\]

\#\#\# 9.2 Progress  
\- userId  
\- repoSnapshotId  
\- role  
\- completedBlocks (blockId\[\])  
\- timeOnBlockSeconds (map)  
\- lastActiveAt  
\- quizResults (optional) \[file:1\]

\#\# 10\) Non-functional requirements

\#\#\# 10.1 Reliability & performance  
\- Parsing jobs must be asynchronous for repos above a size threshold; UI must show job state. \[file:1\]    
\- Lambda functions must respect AWS execution constraints such as max 15-minute timeout for a single invocation. \[web:12\]    
\- Target P95 block-open latency \< 2s for cached artifacts (storybook \+ metadata). \[file:1\]

\#\#\# 10.2 Security & privacy  
\- Use least-privilege \*\*\[AWS IAM\](navigational\_search:AWS IAM)\*\* roles for parser, generator, and API functions. \[file:1\]    
\- Store secrets (if any) in a managed secret store; do not hardcode keys. \[file:1\]    
\- Provide “redaction mode” for sensitive repos (MVP: basic patterns, e.g., env vars/keys). \[file:1\]

\#\#\# 10.3 Cost & free tier alignment (MVP)  
\- Prefer serverless: \*\*\[AWS Lambda\](navigational\_search:AWS Lambda)\*\* \+ \*\*\[Amazon API Gateway\](navigational\_search:Amazon API Gateway)\*\* \+ DynamoDB \+ S3, and cache aggressively. \[file:1\]    
\- Keep usage within commonly cited free-tier request budgets (e.g., Lambda and API Gateway \~1M requests/month in typical free-tier guidance) by limiting demo repo size and avoiding unnecessary regeneration. \[file:1\]\[web:8\]    
\- Bedrock is usage-priced and not “always free,” so MVP must rate-limit generation/chat and rely on the new-account credit structure when applicable. \[web:9\]\[web:13\]

\#\# 11\) AWS architecture (proposed)

\#\#\# 11.1 Frontend (VS Code-like app)  
\- Desktop-like web app or Electron-style shell (decision TBD) that renders: file explorer, editor, storyboard panel, and chat. (User-provided context)    
\- Auth \+ user identity (MVP can be simple, production can integrate managed auth). \[file:1\]

\#\#\# 11.2 Backend (serverless)  
\- \*\*API:\*\* API Gateway routes to Lambda for repo upload, job status, storyboard retrieval, chat, and progress updates. \[file:1\]\[web:8\]    
\- \*\*Parser:\*\* Lambda runs tree-sitter / language AST parsers; outputs metadata to DynamoDB and artifacts to S3. \[file:1\]    
\- \*\*Storyboard generator:\*\* Lambda orchestrates Bedrock calls, produces storyboard JSON, stores to DynamoDB, diagrams to S3. \[file:1\]\[web:13\]    
\- \*\*Search:\*\* OpenSearch or lightweight embeddings workflow for semantic retrieval. \[file:1\]

\#\# 12\) MVP scope (Phase 1–2 target)  
MVP is “working by Phase 2”: ingest a real repo, parse it, generate 5–10 blocks, render storyboard, and support block-scoped chat. \[file:1\]    
MVP limits: 1–2 medium open-source repos, limited languages, generation-on-demand, and caching to control cost. \[file:1\]

\#\# 13\) Roadmap & phases (2 weeks each)  
\- \*\*Phase 1 (Weeks 1–2):\*\* Repository Analysis & AST Parsing (Lambda parser, DynamoDB/S3 storage, test on 3–5 popular OSS repos). \[file:1\]    
\- \*\*Phase 2 (Weeks 3–4):\*\* AI Storyboard Generation (Bedrock prompts, JSON storyboard schema, store in DynamoDB, generate basic diagrams). \[file:1\]    
\- \*\*Phase 3 (Weeks 5–6):\*\* Interactive Walkthrough UI & Contextual Chat (React dashboard/UI, grounded prompts, file explorer, semantic search). \[file:1\]    
\- \*\*Phase 4 (Weeks 7–8):\*\* Role-Based Paths & Progress Tracking (personalized storyboards, analytics dashboards, knowledge-gap detection). \[file:1\]

\#\# 14\) Metrics & instrumentation  
\- Time-to-first-contribution proxy: time to complete core blocks \+ pass basic comprehension checks. \[file:1\]    
\- Engagement: blocks completed/session, average time-on-block, chat questions per block. \[file:1\]    
\- Quality: % chat responses with file/symbol grounding, user feedback ratings, hallucination reports. \[file:1\]    
\- Business impact targets (aspirational): 3–5x faster onboarding and reduced onboarding-related bugs (validate with pilots). \[file:1\]

\#\# 15\) Risks & mitigations  
\- \*\*Hallucinations / inaccurate explanations:\*\* mitigate via block-scoped context, retrieval grounding, and required citations to repo artifacts. \[file:1\]    
\- \*\*Parsing complexity across languages:\*\* start with 1–2 languages and expand with modular parsers and tests. \[file:1\]    
\- \*\*Cost creep from LLM usage:\*\* rate-limit, cache generated storyboards, and avoid re-generation for same snapshot/config. \[file:1\]\[web:13\]    
\- \*\*Large repos exceeding Lambda constraints:\*\* async jobs, chunking, and optional ECS/Fargate for heavy workloads in later phases. \[file:1\]\[web:12\]

\#\# 16\) Open questions (with decisions made)  
\- Web app: We will build a webapp that matches the “VS Code fork” expectations for our judges/users    
\- Auth approach for MVP: We will allow both, anonymous sessions vs Cognito vs GitHub OAuth   
\- Diagram generation: We will use Mermaid stored and rendered from S3
\- Search stack: OpenSearch vs embeddings-in-DynamoDB for MVP simplicity

\---  
\#\# Appendix A: Example “Block” (illustrative)  
\*\*Block:\*\* Request lifecycle (API Gateway → Lambda → DynamoDB)    
\*\*Objective:\*\* Understand how requests traverse the backend, where data is persisted, and what to read first    
\*\*Key files:\*\* \`src/api/routes.ts\`, \`src/handlers/storyboard.ts\`, \`src/storage/dynamo.ts\`    
\*\*Chat scope:\*\* This block \+ dependencies only

