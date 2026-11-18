---
name: forge-extend
description: Improve or extend Forge itself — add a new theme, UI component, screen block, template type (website, game, dashboard), workflow, or a whole new skill; or update the design rules. Use when the user asks to add something to the forge tool/plugin/template rather than to one app ("أضف لـ forge…", "ثيم جديد", "واجهات أحدث").
---

# Extend Forge

Forge is a Claude Code plugin in the repo `ameenalqmaty-cmd/forge`:

```
.claude-plugin/marketplace.json      marketplace (lists the plugin)
plugin/.claude-plugin/plugin.json    plugin manifest — bump "version" on every change
plugin/skills/<skill>/SKILL.md       skills (new-app, publish-app, forge-extend, …)
plugin/skills/new-app/template/      the app template every new app is copied from
```

Changes to Forge reach **new** apps. Existing apps keep their copy; to upgrade one, copy the changed files into it deliberately.

## Recipes

**New theme** — `template/src/styles/themes.css`: copy the closest preset, new `[data-theme="id"]` + `.dark`, oklch only, text contrast ≥ 4.5:1 in both. Add it to `THEMES` in `src/lib/theme.tsx`, sample content in `src/showcase/content.ts`, the table in `template/CLAUDE.md` §2, and `themes` in `qa.config.json`.

**New component** (`src/components/ui/`) or **block** (`src/blocks/`) — Radix primitive + tokens only, RTL-correct (logical `start/end`, `ms/me`, `ps/pe`), ≥ 44px touch targets, works at 360px. Show it in the showcase (`src/showcase/screens.tsx`) so QA screenshots it. List it in `template/CLAUDE.md` §4.

**Bigger UI upgrade** (e.g. a richer component set, charts, animations library) — must sit on the same tokens. Don't add a second design system; adapt the new pieces to `--primary`, `--radius`, fonts. Add to the stack list in `template/CLAUDE.md` §1 only if it's a real dependency.

**New template type** (e.g. game starter, landing-page starter) — add screens/blocks to the template, or a new skill folder with its own `template/` if it's a different stack. Document when to use it in `new-app/SKILL.md` "Kinds".

**New skill** — `plugin/skills/<name>/SKILL.md` with frontmatter `name` + a `description` that says WHEN to use it (that's what triggers it). Put long reference material in files next to it and link them.

## Always finish with

```bash
cd plugin/skills/new-app/template && npm run typecheck && npm run qa   # if the template changed — then look at the screenshots
cd - && claude plugin validate . && claude plugin validate plugin        # manifests + skills
```

Bump `plugin/.claude-plugin/plugin.json` version, commit, push. Tell the user to update on each device: `/plugin marketplace update forge` (new app repos created from the template pick it up automatically through `.claude/settings.json`).
