# Forge repository

This repo IS the Forge plugin (marketplace at the root, plugin in `plugin/`). Work here means improving Forge itself — follow the `forge-extend` skill (`plugin/skills/forge-extend/SKILL.md`).

- The app template is `plugin/skills/new-app/template/` and has its own `CLAUDE.md` (rules for building apps). Run commands inside that folder.
- After template changes: `npm run typecheck && npm run qa` there, and look at the screenshots.
- After any plugin change: bump `plugin/.claude-plugin/plugin.json` version; validate with `claude plugin validate .` and `claude plugin validate plugin`.
- Talk to the user in Arabic.
