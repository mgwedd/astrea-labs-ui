@AGENTS.md

## Claude Code specifics

- **Rules** live in `.claude/rules/`. `figma.md` is always loaded and governs any Figma MCP use.
- **`.claude/hooks/guard.sh` blocks** edits to `.env*`, the lockfile and tsbuildinfo, plus force pushes, pushes to `main` and `--no-verify`. If it blocks you, change the approach. Don't work around it.
- **Before you report work as done, run the `verifier` subagent** (`.claude/agents/verifier.md`). It runs the checks in order and audits content integrity.
- **To preview the site, use `.claude/launch.json`** (`web`, which serves the production build). Build first with `pnpm build`.
