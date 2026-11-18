---
name: new-app
description: Build a new app, website, management system or game from an idea, using Ahmed's Forge template (themed Arabic UI, responsive shell, visual QA, icons, APK, web deploy). Use whenever the user describes something new to build ("ابنِ لي تطبيق…", "موقع لـ…", "منظومة…", "لعبة…").
---

# New app with Forge

The user gives an idea in a few sentences. You deliver a finished, professional product — not a prototype — with as few follow-up edits as possible.

The template lives in the `template/` folder next to this SKILL.md. It contains the UI kit, five themes, the responsive `AppShell`, the visual QA script, the asset generator, Capacitor config and GitHub Actions for APK + web deploy. Its `CLAUDE.md` holds the design rules and Definition of Done — **read it fully before building; it is binding.**

## 1. Spec first (one screen, in Arabic)

Reply with: app type · chosen theme and why (one line) · screens · features the idea implies that the user didn't say · data tables · up to 3 questions, each with your default. If the user doesn't answer (or says "كمّل"), use the defaults. Do not start coding before the spec, but do not wait more than one exchange.

Kinds:
- **App** (mobile-first, APK + web) — default.
- **Website** (landing / content) — no bottom tabs: top nav + sections, still uses tokens/components; skip APK unless asked.
- **System** (admin / management) — `calm` theme usually, tables + filters + roles, desktop/tablet first but must work on phone.
- **Game** — `game` theme for menus/HUD/leaderboard; gameplay in a full-screen route with `phaser` (`npm i phaser`) or plain canvas; pause on `visibilitychange`; touch + keyboard controls; sound off by default with a toggle.

## 2. Create the project

Work in the current repository (usually a new empty repo the user created for this app).

```bash
SKILL_DIR="<the directory this SKILL.md is in>"
rsync -a --exclude node_modules --exclude dist --exclude qa/screens --exclude android "$SKILL_DIR/template/" ./
rm -rf src/showcase          # the showcase is a demo, not part of apps
npm install
```

Then:
- `forge.config.json` → `name` (Arabic), `shortName` (≤ 12 chars), `description`, `appId` (`com.ahmed.<english-slug>`), `theme`, `cloudflareProject` (`<english-slug>`, lowercase, hyphens).
- `src/main.tsx` → `<ThemeProvider defaultTheme="<theme>">`.
- Rewrite `src/App.tsx` for the real app (AppShell + real nav + screens in `src/screens/`). Remove the theme chips from the top bar.
- `qa.config.json` → every route you create. Remove `"themes"` (apps test their one theme).
- `assets/icon-foreground.svg` → design a real mark for THIS app (simple, bold, white, inside the central 66%; no text). Optionally `assets/icon.svg` for a fully custom icon. Then `npm run assets`.
- `README.md` → short Arabic description of the app.

## 3. Data (when the app stores anything)

- Use Supabase. If the Supabase MCP tools are available, use them: pick or create the project, `apply_migration` for tables **with Row Level Security and policies on every table**, then get the URL + publishable key.
- `npm i @supabase/supabase-js`, client in `src/lib/supabase.ts`, keys in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) + `.env.example`. Never a service key in the client.
- Seed realistic Arabic sample data so screenshots look real.
- If Supabase isn't available, build with a local store behind the same interface (`src/lib/data.ts`) and say so.

## 4. Build → check → fix (loop)

Follow `CLAUDE.md`: compose from `components/ui` + `blocks`, all states (loading/empty/error), tokens only, explicit grid columns. Then:

```bash
npm run typecheck && npm run qa
```

Open the screenshots in `qa/screens/` and look at them — phone, small phone, tablet portrait/landscape, desktop, light and dark. Fix what looks wrong even if QA passed. Repeat until clean.

## 5. Ship

```bash
git add -A && git commit -m "<app>: first version" && git push
```

Pushing triggers:
- **Web — QA & deploy**: QA in CI, then Cloudflare Pages (`https://<cloudflareProject>.pages.dev`) if the repo has `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets.
- **Android APK**: a GitHub Release `build-N` with the `.apk` to install directly on the phone. Every build is signed with the same key, so new builds install as updates.

If secrets are missing, tell the user exactly what to add (see the `publish-app` skill) — don't block on it.

## 6. Report (Arabic, short)

- What was built (screens, one line each)
- Links: web URL, the repo's Releases page for the APK
- **Added on my own initiative:** bullet list (so the user can remove anything)
- What's left / what needs the user (secrets, Play Store account…)
