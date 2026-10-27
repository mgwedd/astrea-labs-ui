# Figma rules

These rules apply whenever you use the Figma MCP server (`figma` in `.mcp.json`, or the Figma plugin).

## Source of truth

- **The reference file is the shadcn/ui Design System Community file:** key `C1dgPNBse1KVonHFfnBDM4`, root node `2:287`. Convert node ids from URLs, so `2-287` becomes `2:287`.
- **On a mismatch, code tokens win** unless the user asks to sync from Figma. Tokens live in `packages/ui/src/globals.css`, with light in `:root` and dark in `.dark`. Figma only specifies light; dark is stock shadcn slate.
- **No Code Connect.** The account is on the Starter plan and the file is a Community file. Don't create `figma.config.json` or `*.figma.ts`, and don't call `add_code_connect_map` or `send_code_connect_mappings`.

## Reading (design → code)

1. **Start a session first.** Call `create_session` with the file key before any other file tool, and reuse the `sessionId` for the rest of the task.
2. **Fetch the node's context and a screenshot:** `get_design_context` and `get_screenshot` on that node. Use `get_metadata` first for large frames, then fetch only the children you need.
3. **Treat the generated code as a spec, not as code to paste.** Rebuild it with `@astrea/ui` components and semantic Tailwind tokens.
   - Translate raw colors, px values and absolute positioning into tokens and flex/grid with `gap-*`.
   - Map Figma variables (`get_variable_defs`) to the matching `--token`. If no token fits, ask before adding one. Never inline the value.
4. **Assets:** download real image assets into `apps/web/public/media/` and render them with `<Media>`.
   - Never ship `localhost:3845` or `figma.com` asset URLs.
   - Use lucide icons, never exported SVGs of the same icons.
5. **Check your build against the screenshot** at desktop and 375px, in both light and dark.

## Writing (code → Figma)

- **Read-only by default.** Use `use_figma`, `generate_figma_design`, `upload_assets`, `create_new_file` and other mutating tools only when the user explicitly asks for a change in Figma.
- **Never edit the Community source file.** Write to a file the user names, or to a duplicate in their drafts.
- **Load the plugin's skills before writing:** load `figma:figma-use` before any `use_figma` call, plus `figma:figma-generate-design` for visible design changes.

## Content

The no-fabrication rule in `AGENTS.md` applies to Figma too. Placeholder copy from a design ("Lorem ipsum", sample stats, fake names) never reaches the site. Use registry data, or omit the spot.
