# Astrea Labs — agent guide

This is the site for Astrea Labs LLC (astrealabs.com), a two-person lab: Michael Wedd (`mgwedd`) and Christopher Wedd (`KingMoonk`). The site covers the lab's projects, writing, research and downloads, and serves hosted project subdomains. It has no SaaS boilerplate and no pricing until a product actually ships.

## Layout

| Path                             | What it is                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web`                       | The site: Next.js 15 App Router, React 19, Tailwind v3                                              |
| `apps/web/middleware.ts`         | Rewrites a project subdomain's root to `/subdomains/<slug>`. Every other path redirects to the apex |
| `apps/web/content/writing/*.mdx` | Posts, rendered with `next-mdx-remote/rsc` and `components/media/mdx.tsx`                           |
| `apps/web/components/media/`     | The `Media` component: images, GIFs, self-hosted video, YouTube/Vimeo facades                       |
| `packages/ui` (`@astrea/ui`)     | shadcn components (radix base) and the design tokens in `src/globals.css`                           |
| `packages/research-registry`     | The single source of truth for projects, domains, publications and `PROJECT_SUBDOMAINS`             |
| `packages/config-*`              | Shared tsconfig and ESLint config                                                                   |

## Commands

The package manager is pnpm 11 and turbo runs the tasks. Node is version 24.

```bash
pnpm install --frozen-lockfile
pnpm dev                     # http://localhost:3000; ?subdomain=<slug> previews a subdomain
pnpm lint
pnpm typecheck
pnpm test                    # Vitest
pnpm build
pnpm test:e2e                # Playwright; needs a build first
pnpm --filter @astrea/web <script>
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, test, build, e2e and Gitleaks. A change is done when the checks you touched pass locally.

Known traps:

- **Run `typecheck` and `build` one after the other, never in parallel.** In parallel they race on `.next/types` and fail with TS6053.
- **`apps/web/tsconfig.tsbuildinfo` is tracked, and builds rewrite it.** Restore it with `git checkout apps/web/tsconfig.tsbuildinfo` unless you meant to change it.
- **Never edit `pnpm-lock.yaml` by hand.** Change dependencies with `pnpm add` or `pnpm remove` in the right workspace.

## Content integrity (hard rule)

This is a real company's public site. Every claim on it must be true.

- **Never invent facts.** That includes stats, benchmarks, papers, preprints, citations, customers, quotes, emails, team members, dates and project status.
- **If the content isn't known, omit it.** Never write plausible filler, and never leave `TODO:`, "pending counsel" or draft markers in the app, its copy or committed docs. Log open questions in a gitignored `*.local.md` file instead.
- **Projects, publications and status come only from `packages/research-registry`.** Don't hardcode them in pages.
- **Keep the copy short.** Cut subtitles, taglines and helper text that don't carry information.

## UI rules

- **Use `@astrea/ui` components first.** Add new shadcn components to `packages/ui` with the shadcn CLI, run from `packages/ui`. Follow `.claude/skills/shadcn` (also at `.agents/skills/shadcn`).
- **Colors come only from the semantic tokens:** `bg-background`, `text-muted-foreground`, `border` and so on. Don't use raw hex, `bg-blue-500` or manual `dark:` color overrides. To change a token, edit `packages/ui/src/globals.css`, in both `:root` and `.dark`.
- **Spacing:** use `flex` or `grid` with `gap-*`. Use `size-*` for squares and `cn()` for conditional classes.
- **Media:** go through `<Media src=…>` or markdown images. Don't use bare `<img>`, `<video>` or `<iframe>`. Self-hosted files go in `apps/web/public/media/` or Vercel Blob. Any new remote image host needs a `remotePatterns` entry in `next.config.ts`.
- **Accessibility:** Dialogs and Sheets need a title (it can be `sr-only`). Respect `prefers-reduced-motion`. Pages must have no horizontal overflow at 375px.

## Design source (Figma)

The design reference is the shadcn/ui Design System Community file: <https://www.figma.com/design/C1dgPNBse1KVonHFfnBDM4/-shadcn-ui---Design-System--Community-?node-id=2-287>. The light tokens in `globals.css` match it. Dark mode is stock shadcn slate.

The full Figma workflow is in `.claude/rules/figma.md`. In short: read Figma, write code with our tokens and components, and never write to Figma unless asked. Code Connect is unavailable: the account is on the Starter plan and the file is a Community file. So don't add `figma.config.json` or `*.figma.ts`.

## Git and PRs

- **Never commit, push or open a PR unless asked.**
- **Use a feature branch.** Never push to `main` and never force-push to `main`.
- **Commits and PR titles use Conventional Commits.** `commitlint.yml` enforces this on PR titles. Examples: `feat(web): …`, `fix(ui): …`, `chore: …`.
- **Never skip hooks** (`--no-verify`) and never commit secrets or `.env*` files. Gitleaks runs in CI.
- **Hosting is Vercel** (project `astrea-labs-ui`, team `astrea-software`). Storage is Vercel-backed (Blob or Edge Config), not Supabase.

## Boundaries

- **Read-only by default for anything outside this repo:** GitHub, Vercel, Figma, DNS. Change remote state only when asked.
- **Don't read or search for secrets or credential files**, whether in the repo or on the machine.
