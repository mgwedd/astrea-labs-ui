# Astrea Labs

The official web platform and research showcase for **Astrea Labs LLC**, an independent AI research laboratory dedicated to fundamental intelligence architectures, autonomous agency, and extreme computational efficiency.

Built as a high-performance **pnpm + Turborepo** monorepo in **100% TypeScript**, powered by **Next.js 15 App Router**, a centralized semantic CSS theme, **shadcn/ui** native components, and the **shadcn MCP server**.

---

## 🏛 Architecture Overview

```
astrea-labs/
├── apps/
│   └── web/                         # Next.js 15 App Router with Subdomain Middleware
│       ├── app/
│       │   ├── page.tsx             # Apex Lab Portal (astrealabs.com)
│       │   └── subdomains/[subdomain]/page.tsx  # Project Subdomains (sda.*, minima.*, studio.*)
│       ├── components/              # Lab navigation, footer, project cards
│       ├── middleware.ts            # Subdomain extraction & internal rewrites
│       └── tests/                   # Vitest unit tests & Playwright e2e suites
├── packages/
│   ├── ui/                          # Centralized theme tokens, globals.css, shadcn native components
│   │   ├── src/components/          # Button, Card, Trace, CodeBlock, Table, Progress, etc.
│   │   ├── src/globals.css          # Semantic CSS variables (:root, .dark, radius, charts)
│   │   ├── components.json          # shadcn configuration with cssVariables: true
│   │   └── registry.json            # Community registry specification
│   ├── research-registry/           # Single source of truth for all research initiatives
│   │   └── src/                     # Strongly typed projects (SDA, Minima, Studio), pillars, preprints
│   ├── config-typescript/           # Shared tsconfig definitions (base, nextjs, react-library)
│   └── config-eslint/               # Shared ESLint configuration
├── .cursor/
│   └── mcp.json                     # shadcn MCP Server configuration for Cursor
├── .vscode/
│   └── mcp.json                     # shadcn MCP Server configuration for VS Code
├── .github/workflows/
│   ├── ci.yml                       # GHA CI: Lint, Typecheck, Unit Tests, Build, Playwright, Gitleaks
│   ├── commitlint.yml               # Conventional Commit PR title enforcement
│   └── auto-release.yml             # Semantic version release pipeline
├── Makefile                         # Unified developer tasks (make setup, dev, build, test)
└── turbo.json                       # Turborepo task orchestration and caching
```

---

## 🌐 Subdomain Routing & Hosted Projects

Astrea Labs hosts dedicated subdomains for each research program:

| Subdomain | Project | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **`astrealabs.com`** | **Astrea Labs LLC** | Frontier intelligence lab introduction & research showcase | Active |
| **`sda.astrealabs.com`** | **SDA** | Synthetic Data & Autonomous Agency (Formal Sandbox Verification) | Active Research |
| **`minima.astrealabs.com`** | **MINIMA** | Sub-quadratic attention & structural model distillation | Preprint Available |
| **`studio.astrealabs.com`** | **STUDIO** | Mechanistic interpretability, activation probing & telemetry workbench | Research Workbench |

### Subdomain Middleware (`apps/web/middleware.ts`)
The edge middleware inspects incoming host headers:
1. `sda.astrealabs.com/*` → Rewrites transparently to `/subdomains/sda/*`
2. `minima.astrealabs.com/*` → Rewrites transparently to `/subdomains/minima/*`
3. `studio.astrealabs.com/*` → Rewrites transparently to `/subdomains/studio/*`
4. **Local Development Preview**: Supports `?subdomain=sda` query override and `/subdomains/<slug>` direct routes without needing to edit `/etc/hosts`.

---

## 🎨 Centralized Theming & shadcn Native Components

Following the [shadcn theming specification](https://ui.shadcn.com/docs/theming):
- **Semantic CSS Variables**: Tokens live in `packages/ui/src/globals.css` under `:root` and `.dark` (`background`, `foreground`, `primary`, `card`, `popover`, `accent`, `border`, `ring`, `radius`, `chart-1`...`chart-5`).
- **Research Lab Palette**: Deep obsidian (`hsl(222 47% 4%)`), radiant cyan (`hsl(199 89% 48%)`) and subtle violet (`hsl(262 83% 58%)`).
- **Native shadcn Components**:
  - `Trace` & `TraceItem`: Render agentic reasoning steps, execution states (`running`, `completed`), and tool calls.
  - `CodeBlock`: Formatted syntax display with line numbers and copy buttons.
  - `Card`, `Badge`, `Button`, `Tabs`, `Dialog`, `DropdownMenu`, `Sheet`, `Table`, `Progress`, `Breadcrumb`, `Kbd`, `Empty`.

---

## 🤖 shadcn MCP Server (`https://ui.shadcn.com/docs/mcp`)

The repository includes pre-configured Model Context Protocol (MCP) integrations:
- `.cursor/mcp.json`
- `.vscode/mcp.json`

### Usage with AI Assistants
With the MCP server active, assistants can search, inspect, and install components directly:
```bash
npx shadcn@latest mcp
```

---

## ⚡ Quickstart & Developer Workflow

Modeled after `KingMoonk/TRAINER` with a root `Makefile`:

```bash
# 1. Install dependencies
make setup          # or: pnpm install

# 2. Start local development server
make dev            # starts apps/web on http://localhost:3000

# 3. Run typecheck across all workspaces
make typecheck

# 4. Run linter
make lint

# 5. Run Vitest unit & component tests
make test

# 6. Build all workspaces with Turborepo
make build

# 7. Run Playwright end-to-end tests
make test-e2e
```

---

## 🔄 CI/CD Pipelines (GitHub Actions)

Derived from the battle-tested pipeline in `KingMoonk/TRAINER`:
- **`ci.yml`**:
  - **Lint & Typecheck**: Parallel verification with `pnpm lint` and `pnpm typecheck`.
  - **Unit Tests**: Fast Vitest execution with component DOM validation.
  - **Turborepo Build**: Monorepo compilation with remote/local task caching.
  - **Playwright E2E**: Headless Chromium testing across apex and subdomain routes; uploads HTML reports on failure.
  - **Gitleaks Scan**: Audits commit history to prevent accidental credential disclosure.
- **`commitlint.yml`**: Validates pull request titles against the Conventional Commits specification.
- **`auto-release.yml`**: Generates automated release notes on version tags (`v*.*.*`).

---

## ⚖️ Legal

© 2025 Astrea Labs LLC. All rights reserved.
