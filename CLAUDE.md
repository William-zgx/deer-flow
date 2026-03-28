# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeerFlow is a LangGraph-based AI super agent system. The agent orchestrates sub-agents, memory, isolated sandbox execution, and extensible skills to handle complex tasks. DeerFlow 2.0 is a ground-up rewrite — it shares no code with v1 (which lives on the `1.x` branch).

**Services**:
- **LangGraph Server** (port 2024) — Agent runtime and workflow execution
- **Gateway API** (port 8001) — FastAPI REST API for models, MCP, skills, memory, uploads, artifacts, IM channels
- **Frontend** (port 3000) — Next.js web interface
- **Nginx** (port 2026) — Unified reverse proxy entry point (`/api/langgraph/*` → LangGraph, `/api/*` → Gateway, `/*` → Frontend)
- **Provisioner** (port 8002, optional) — Kubernetes sandbox provisioner; only starts when `sandbox.use` references a provisioner URL

## Commands

All commands are run from the **project root** unless noted.

```bash
make check          # Verify system requirements (Node.js 22+, pnpm, uv, nginx)
make install        # Install all dependencies (backend + frontend)
make config         # Generate config.yaml from config.example.yaml (one-time setup)
make config-upgrade # Merge new fields from config.example.yaml into existing config.yaml
make dev            # Start all services; app available at http://localhost:2026
make stop           # Stop all services
```

**Backend only** (from `backend/`):
```bash
make dev            # LangGraph server on port 2024
make gateway        # Gateway API on port 8001
make test           # Run all backend tests
make lint           # Lint with ruff
make format         # Format with ruff

# Run a single test file
PYTHONPATH=. uv run pytest tests/test_<feature>.py -v
```

**Frontend only** (from `frontend/`):
```bash
pnpm dev            # Dev server at http://localhost:3000 (Turbopack)
pnpm check          # Lint + typecheck (run before committing)
pnpm build          # Production build (requires BETTER_AUTH_SECRET env var)
```

## Architecture

### Backend Structure

```
backend/
├── packages/harness/deerflow/   # deerflow-harness package — publishable agent framework
│   ├── agents/                  # Lead agent, middlewares, memory
│   ├── sandbox/                 # Sandbox execution (Local or Docker)
│   ├── subagents/               # Sub-agent delegation and execution pool
│   ├── tools/                   # Tool aggregation (config, MCP, built-in, community)
│   ├── mcp/                     # Multi-server MCP client
│   ├── models/                  # LLM factory (OpenAI, Anthropic, Google, DeepSeek, etc.)
│   ├── skills/                  # Skills discovery and loading
│   ├── config/                  # YAML config system with env-var resolution
│   ├── community/               # Community tools (Tavily, Jina, Firecrawl, image search)
│   └── client.py                # DeerFlowClient — embedded in-process client (no HTTP needed)
└── app/                         # Unpublished application layer
    ├── gateway/                 # FastAPI Gateway API
    └── channels/                # IM integrations (Feishu, Slack, Telegram)
```

**Harness/App boundary**: `app.*` may import `deerflow.*`, but `deerflow.*` must never import `app.*`. Enforced by `tests/test_harness_boundary.py` in CI.

### Key Subsystems

**Middleware chain** (strict order, in `agents/lead_agent/agent.py`):
ThreadData → Uploads → Sandbox → DanglingToolCall → Guardrail → Summarization → TodoList → Title → Memory → ViewImage → SubagentLimit → Clarification

**Sandbox virtual paths** — the agent sees `/mnt/user-data/{workspace,uploads,outputs}` and `/mnt/skills`; physical paths are under `backend/.deer-flow/threads/{thread_id}/user-data/` and `skills/`. Translation is handled by `sandbox/tools.py`.

**Subagent concurrency** — max 3 concurrent sub-agents (`MAX_CONCURRENT_SUBAGENTS`), 15-minute timeout, dual thread pool.

**Memory** — stored in `backend/.deer-flow/memory.json`; LLM-based fact extraction with debouncing (30s default); top 15 facts injected into system prompt.

**Config loading priority** for both `config.yaml` and `extensions_config.json`:
1. Explicit `config_path` argument
2. Environment variable (`DEER_FLOW_CONFIG_PATH` / `DEER_FLOW_EXTENSIONS_CONFIG_PATH`)
3. File in current working directory
4. File in parent directory (project root — recommended location)

Config values starting with `$` are resolved as environment variables.

### Frontend Structure

```
frontend/src/
├── app/        # Next.js App Router (/, /workspace/chats/[thread_id])
├── components/ # UI primitives (ui/, ai-elements/ — generated, don't edit), workspace/, landing/
├── core/       # Business logic: threads, api, artifacts, i18n, settings, memory, skills, mcp
├── hooks/      # Shared React hooks
└── lib/        # Utilities (cn())
```

Server Components by default; `"use client"` only for interactive components. LangGraph client singleton is in `core/api/`. `ui/` and `ai-elements/` are auto-generated from Shadcn/MagicUI/Vercel AI SDK registries — do not manually edit them.

## Configuration

- Copy `config.example.yaml` → `config.yaml` in the project root (or run `make config`)
- Copy `extensions_config.example.json` → `extensions_config.json` for MCP servers and skills
- Copy `.env.example` → `.env` for API keys (OpenAI, Tavily, LangSmith, etc.)
- `config.yaml` has a `config_version` field; run `make config-upgrade` when the schema changes

## Development Guidelines

- **Tests are mandatory** for every new backend feature or bug fix (`make test` must pass)
- **Always update `README.md` and the relevant `CLAUDE.md`** after code changes
- Backend code style: `ruff`, line length 240, Python 3.12+, double quotes
- Frontend code style: ESLint, inline type imports (`import { type Foo }`), `cn()` for conditional Tailwind classes, `@/*` path alias maps to `src/*`

See [`backend/CLAUDE.md`](backend/CLAUDE.md) and [`frontend/CLAUDE.md`](frontend/CLAUDE.md) for detailed subsystem documentation.
