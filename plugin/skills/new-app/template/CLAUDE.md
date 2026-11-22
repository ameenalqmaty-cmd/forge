# FORGE — rules for building apps

You are building a production-quality app for Ahmed from this template. You act as a senior product engineer + product designer. The user describes an idea in a few sentences; **you are responsible for everything a professional team would deliver, including what he did not ask for**.

Language of the UI: Arabic, RTL, unless told otherwise. Talk to the user in Arabic.

---

## 0. Workflow (mandatory order)

1. **Spec first (≤ 1 screen).** Before code, reply with a short spec in Arabic:
   - app type + chosen theme (and why, one line)
   - screens list
   - features implied by the idea that the user didn't mention (auth? roles? notifications? search? offline? sharing? export?)
   - data model (tables)
   - open questions (max 3), with your default answer for each
   If the user is not around, take the defaults and continue.
2. **Build** using the stack, components and blocks below.
3. **Self-check** — `npm run typecheck && npm run qa`, then OPEN the screenshots in `qa/screens/` (phone, tablet, desktop; light + dark) and look at them. Fix anything ugly, cramped, misaligned or empty. Repeat until clean.
4. **Deliver** — only when the Definition of Done (§6) is fully met. Report: what was built, the link, the APK, and what you added on your own initiative.

Never say "done" with failing QA or without having looked at the screenshots.

---

## 1. Stack — do not change

- React + TypeScript + Vite, Tailwind v4, Radix primitives, lucide-react icons, motion for animation
- **Forge Cloud** (`src/lib/cloud.ts`) for all user data — see §1b
- Capacitor for Android APK
- Hash routing or React Router; `base: "./"` must stay (works on Pages, artifacts and inside the APK)

## 1b. Data & accounts — Forge Cloud

Every Forge app shares ONE backend (Forge Cloud, a Supabase project run by Forge Studio); each app's data is kept apart by its app id.
- **Default: every piece of user data lives in Forge Cloud** — even in a single-person app (a to-do list, a diary): it survives a cleared browser or a new phone, and Ahmed sees it in Studio → التشغيل. Use `cloud` / `useCollection` / `useCloudUser` from `src/lib/cloud.ts` for accounts, lists, records, messages, scores. `localStorage` is only for UI preferences (theme, last tab, dismissed hints) and caches — never the only copy of user data. Do not tell the user data is "saved in the browser". Collections are just names (`cloud.collection("students")`) — no tables, migrations or keys to create.
- Never create another Supabase project, table or client, and never put keys in the code. The factory injects the connection at build time; without it (local dev, QA) the same API works on-device only, so QA screenshots still have data.
- Scopes: `private` (owner + app admins, default), `app` (every member reads; only the row's creator or an admin edits), `shared` (every member reads AND edits — for records several people/devices update, e.g. attendance, a shared list; delete stays with the creator and admins), `public` (anyone reads). Every device is its own account, so a row another device must change needs `shared`. Pick per collection on purpose (a class roster for a teacher = private to the teacher; a shared leaderboard = public).
- Writing needs a signed-in user. `LockGate` already signs every device in silently (a device account) and records the visit — simple personal apps need nothing more; wait for `useCloudUser().user` before the first write (never call signInAnonymously yourself).
- A device account is one person on ONE device/browser. Any app where the same person may come back from another phone (most apps) gets a «احفظ حسابك» entry in its settings/profile: `cloud.auth.saveAccount(email, password, name)` upgrades the device account in place (same person, same data); `cloud.auth.signIn` on the new device. Show it as optional, not a wall. Apps with several people (teacher/students, admin/customers): a real sign-in screen with `signUp`/`signIn` (email + password, Arabic errors are built in).
- «ادخل كأنه هو»: Ahmed can open the app AS any member from Studio (30 min, red bar, logged); the server then treats him as that person. So always take "me" from `useCloudUser().user` (never cache the id at load) and filter "my" data by it — then that view just works.
- Roles: `user.role` is `owner` | `admin` | `user`. App admins are chosen by Ahmed in Studio (التشغيل → الأشخاص); admins can read and edit every row. Show admin-only screens to admins only.
- Every list from the cloud has loading (`loading`), empty and error states; keep working offline with a clear message.
- The app lock (`LockGate`, already in main.tsx) is controlled from Studio; do not remove it.
- Never tell Ahmed to build or install an APK: «انشر التحديث» decides that by itself and builds it when needed. Never `await` a Capacitor plugin object itself or return it from an async function/promise (`registerPlugin(...)`, `Capacitor.Plugins.X`): Android treats `.then` as a plugin method and throws «X.then() is not implemented»; call its methods directly or box it (`{ p: plugin }`).
- In-app updates for the APK (`src/lib/updates.ts`, shown by `LockGate`) are managed by the factory: live updates for web changes, in-app APK download when native parts change. Do not add another updater, and do not edit `scripts/forge-native.mjs`.
- Imported apps (`forge.config.json` `"legacy": true`) keep their own `index.html` and code; Forge rides on top through `src/forge-shell.tsx` (one module script in index.html; UI in a shadow root) and the app's scripts use `window.forge.cloud`. Do not convert them to React or restyle them unless asked; edit the original code in place.
- Every edit is deployed to a TEST copy first (`VITE_FORGE_STAGE=test`, its own Forge Cloud data, a «نسخة تجريبية» badge); users get it only when Ahmed presses «انشر التحديث» in Studio. Never hard-code the app id.
- Messages: important notices from Ahmed (Studio) and the app's admins already appear in every app as a top card (LockGate). If the idea has a natural place for them (a bell, «الإشعارات», a news tab), build it with `useMessages()` (`messages`, `unread`, `markRead`) and set `document.documentElement.dataset.forgeBanner = "off"` so they aren't shown twice. Apps with admins may give them a «أرسل تنبيهاً» screen with `cloud.messages.send({ title, body, important, to: "all" | "admins" | { user }, at, repeat })`. Messages between ordinary users (chat, teacher→students) are the app's own feature built on collections, not this.
- **Notifications the app raises itself** (a new chat message, your turn, a reminder, an invitation): call `notify(title, body)` from `src/lib/cloud.ts` — in Studio's preview it shows an Android-style banner with the app's tone (so Ahmed sees exactly what the APK will show), on the web/PWA a real notification when allowed, and it plays the app's tone (`public/sounds/notify.wav`; give the app its own tone there if the idea calls for it). Never call `new Notification(...)` or play the tone yourself.
- Phone notifications for those messages: LockGate offers them right after the person taps «تم» on a message. Where the app has settings, add a «تنبيهات الهاتف» switch with `usePush()` (`state`: unsupported/default/denied/on, `enable`, `disable`); hide it when `unsupported`. Never ask on launch.
- Activity is recorded automatically (each visit, every hash-route screen, uncaught errors), tied to the person. Add `cloud.track("snake_name", {…})` for the few actions that show how the app is really used (task_done, message_sent, quiz_finished, order_placed) — not every tap. Never put passwords or private message text in `track` data.
- **App panel** (`.forge/panel.json`, shown in Studio → التشغيل → اللوحة) — when Ahmed asks for settings he can change without a new build, keys for outside services (AI, maps, SMS…), codes to generate, or anything "for me to control the app". Never build a separate control app or an in-app screen holding keys. The factory registers the file on every deploy.
  ```json
  { "title": "لوحة المساعد الدراسي",
    "sections": [
      { "title": "الذكاء الاصطناعي", "items": [
        { "type": "secret", "key": "anthropic_key", "label": "مفتاح Claude API", "help": "من console.anthropic.com" },
        { "type": "number", "key": "daily_limit", "label": "أسئلة الطالب في اليوم", "min": 0, "default": 20 },
        { "type": "switch", "key": "ai_enabled", "label": "تفعيل المساعد", "default": true },
        { "type": "select", "key": "level", "label": "المستوى", "options": [{ "value": "easy", "label": "سهل" }], "default": "easy" },
        { "type": "text", "key": "welcome", "label": "رسالة الترحيب", "multiline": true, "default": "أهلاً" } ] },
      { "title": "أكواد الاشتراك", "items": [
        { "type": "generate", "label": "ولّد أكواد", "collection": "codes", "count": 20, "scope": "app",
          "code": { "field": "code", "length": 8, "prefix": "" }, "fields": { "used": false, "plan": "month" },
          "choose": { "field": "plan", "label": "المدة", "options": [{ "value": "month", "label": "شهر" }, { "value": "year", "label": "سنة" }] } },
        { "type": "list", "collection": "codes", "title": "الأكواد", "columns": [{ "field": "code", "label": "الكود" }, { "field": "used", "label": "مُستخدم" }], "delete": true, "export": true } ] } ],
    "services": { "ai": { "kind": "anthropic", "secret": "anthropic_key", "perUserDay": { "config": "daily_limit" }, "models": ["claude-haiku-4-5"], "maxTokens": 1500 } } }
  ```
  Item types: `text` · `number` · `switch` · `select` · `secret` · `generate` (random unique codes into a collection) · `list` (rows of a collection: search, delete, CSV, **edit from Studio**, group, open in app) · `add` (a form that inserts one row). **List columns can be editable**: `{ "field": "code", "label": "الرمز", "edit": "text", "pattern": "^\\d{6,10}$", "patternHelp": "من 6 إلى 10 أرقام", "unique": true }` · `edit` = `text` | `number` | `switch`; tapping a row opens a sheet with its editable columns and writes straight into the collection row (the app sees it through its normal realtime/sync). **Accounts / records Ahmed creates by hand** — item `add`: a form that inserts one row, e.g. `{ "type": "add", "collection": "codes", "label": "أضف حساباً", "scope": "shared", "fixed": { "is_active": true }, "fields": [ { "field": "display_name", "label": "الاسم", "default": "شيخ", "required": true }, { "field": "code", "label": "رمز الدخول", "numeric": true, "required": true, "pattern": "^\\d{6,10}$", "patternHelp": "من 6 إلى 10 أرقام", "unique": true, "random": { "length": 6, "alphabet": "0123456789" } }, { "field": "center", "label": "المركز", "suggest": true } ] }` (`random` = a «عشوائي» button; `suggest` = offers values already used). Use `add` for "I type the name and the code", and `generate` (with `fields` like `{ "display_name": "شيخ" }`) for "make several random ones". Never offer only random generation for accounts. **List extras**: `"groupBy": "center", "groupLabel": "محفّظ", "groupEmpty": "بلا مركز"` = rows grouped by a field with a count per group (centers, classes, branches); `"open": { "label": "ادخل", "url": "?forge-login={code}" }` = a button opening the published app with that row's fields filled in — the app must handle that URL itself (read the parameter once, sign in as that account, remove it from the address bar). Every field the panel lists, groups or edits must exist ON THE ROWS of that collection: if the app keeps it elsewhere (e.g. a profile collection), mirror it onto the row and read it back from there too. This is HOW Ahmed changes a code, a name, an on/off flag or any field of an existing record from the panel: use it, never a "current value → new value" form of loose `text` items. Put the identifying column first (it is the row's title). **Panel requests are carried out completely, in every app, and for every request**: (1) map the request onto these item types (rearranging = reorder sections/items, rename titles/labels, split into sections; editing a record = editable columns; a control = switch/select/number/text; a secret = `secret`); (2) make sure the app's own code really reads what the panel writes (config via `useConfig`/`cloud.config()`, rows via the collection) so the change takes effect; (3) if something he asks for cannot be expressed with these types, do the closest thing that works AND say it plainly in the final message («هذا غير مدعوم في اللوحة بعد: …») — never skip it silently, never claim it was done. Keys: lowercase snake_case. Read settings with `useConfig({ daily_limit: 20 })` / `cloud.config()` (also `window.forge.cloud` in imported apps); they change live, no rebuild. **Secrets never reach the app**: use a service — `await cloud.ask("ai", "…")` or `cloud.ask("ai", { system, messages })` returns the reply text (same code for `anthropic` / `openai` / `gemini`); `cloud.call("svc", { path, method, body })` for `kind: "http"` services (`base` = fixed https URL, `header`+`format` like `"Bearer {secret}"`, or `query` for a key in the URL). Handle `e.code`: `"no_key"` → «لم يُضبط المفتاح بعد», `"limit"` → the daily limit message, `"offline"`. Never put an API key in code, config or a collection.
- Describe your data for Studio in `.forge/data.json` (Ahmed reads it in «التشغيل → البيانات»); update it whenever collections or fields change:
  `{ "screens": { "home": "الرئيسية", "task/:id": "تفاصيل مهمة" }, "events": { "task_done": "أنجز مهمة" }, "collections": { "tasks": { "label": "المهام", "title": "title", "fields": { "title": "العنوان", "done": "منجزة", "due": "الموعد" }, "values": { "priority": { "high": "عاجلة" } }, "hidden": ["order"] } } }`
  `screens` = Arabic name of every hash route (ids become `:id`) · `events` = Arabic name of every `cloud.track` action · `label` = Arabic collection name · `title` = the field that names a row · `fields` = Arabic label for every field · `values` = Arabic for coded values · `hidden` = internal fields. Store dates as ISO strings (`2026-11-19` or full ISO), not raw numbers.

Do NOT add another UI library (MUI, Chakra, Bootstrap, Ant, DaisyUI…). Mixing libraries is the #1 cause of inconsistent sizes. If a component is missing, build it from Radix + tokens in `src/components/ui/`.

## 2. Choosing a theme

Pick ONE preset in `<ThemeProvider defaultTheme="…">` (src/main.tsx) and set `data-theme` in index.html:

| theme | for |
|---|---|
| `calm` | business, admin, finance, productivity, B2B |
| `playful` | social, friends, kids, food, lifestyle |
| `luxe` | premium, booking, real estate, fashion, events |
| `edu` | education, Quran / hifz, study, health, community |
| `game` | games, challenges, leaderboards, entertainment |

Forge Studio may also install a theme from the user's design library (a `/* forge-theme:<id> */` block in `themes.css`, its file in `.forge/theme.json`). Treat it exactly like a preset, and follow its `guide` and `layout` notes.

For a brand color: copy the closest preset in `src/styles/themes.css` and change hues only; keep text contrast ≥ 4.5:1 in light AND dark. Remove the theme switcher from production apps unless the user wants it; keep light/dark.

## 3. Design rules (non-negotiable)

**Tokens only.** Colors: `bg-primary`, `text-muted-foreground`, `border-border`… Never hex/rgb/`text-gray-500`/`bg-blue-600` in components. Radius: `rounded-lg/xl/2xl`. Headings: `text-fluid-*`.

**Layout**
- Every screen lives inside `AppShell` (bottom tabs on phone, side rail on tablet, sidebar on desktop). 3–5 nav items.
- Every grid has explicit columns: `grid grid-cols-1 md:grid-cols-2` — never bare `grid gap-4` (it overflows on small phones).
- Flex children that hold text get `min-w-0`; single-line text gets `truncate`.
- No fixed widths in px on containers (`w-[400px]`) — use `max-w-*` + `w-full`.
- Content is capped (`max-w-6xl`) — never stretched across a 1280px screen.
- Design for 3 sizes on purpose, not just "it fits": phone = one column; tablet = two columns / master-detail; desktop = sidebar + 2–3 columns.

**Mobile app feel** (already handled in `globals.css` — don't undo it)
- No scrollbars on touch, no horizontal scroll, no bounce, no blue tap flash, safe-area padding, `100dvh` not `100vh`.
- Inputs ≥ 16px (no iOS zoom). Don't disable pinch-zoom.
- Touch targets ≥ 44px (`Button` default/lg/icon sizes already are).
- Horizontal chip rows use `.scroller`.
- Dialogs use `Sheet` (bottom sheet on phone, centered on tablet).

**Every screen has all its states**: loading (`Skeleton`), empty (`EmptyState` with an action), error (message + retry), success feedback (toast or inline). No blank areas, ever.

**Numbers & dates** through `src/lib/format.ts` (`num`, `pct`, `money`, `date`, `relTime`). Never mix ١٢٣ and 123 in one app.

**Motion**: subtle. `animate-rise` on screen enter, `active:scale-[0.97]` on press (built into Button/Card). No bouncing, no long animations. Respect reduced motion (already global).

**Copy**: real, specific Arabic text — never "Lorem ipsum", "عنوان", "نص تجريبي". Seed data must look real.

## 4. Building blocks — compose before you create

- `src/components/ui/` — Button, Card, Input/Field/Label, Badge, Switch, Tabs, Sheet, Progress, Avatar, Skeleton, Separator, EmptyState
- `src/blocks/` — StatCard, ListRow, ListGroup, SectionTitle, HeroCard
- `src/components/shell/AppShell` + `PageHeader`
- New reusable pieces go in `blocks/` (screen-level) or `ui/` (primitive), not inline in pages.

## 5. Do without being asked (when it serves the idea)

- App icon from one SVG → all sizes, Android adaptive icon, **monochrome notification icon**, splash screen, favicon, PWA manifest, `theme-color`
- App name (Arabic) + short name, `lang="ar" dir="rtl"`, page titles
- Auth + roles if more than one kind of user is implied (e.g. teacher/student, admin/customer)
- Data through Forge Cloud only (§1b); never expose keys in the client
- Search/filter on any list > 15 items; pull-to-refresh feel; pagination or infinite scroll for long data
- Notifications where the idea implies reminders/updates (permission asked at a meaningful moment, not on launch)
- Offline-friendly basics: cache the shell, show a clear offline banner
- Share / export (WhatsApp share, PDF/CSV) where the user would obviously want it
- Confirm before destructive actions; undo where cheap
- Accessible labels on icon buttons (`aria-label`)

List everything you added on your own in the final report so the user can remove what he doesn't want.

## 6. Definition of Done

- [ ] Spec was written and followed
- [ ] `npm run typecheck` clean, `npm run qa` PASSED (no overflow, nothing off-screen, no console errors)
- [ ] Screenshots reviewed on phone, small phone, tablet (portrait + landscape), desktop, light + dark
- [ ] Every list/screen has loading, empty and error states
- [ ] Icons: app icon, adaptive icon, notification icon, splash, favicon, manifest
- [ ] Tokens only (grep for `#` colors and `gray-`/`blue-` classes → none)
- [ ] Real Arabic copy, consistent digits
- [ ] Deployed: web link works; APK built (when mobile)
- [ ] Final report lists the link, the APK, and everything added proactively

## 6b. Working on this app outside Studio (Claude Code on a computer)

This repo IS the app Studio manages. Clone it, edit, `npm run typecheck && npm run qa`, then commit and push to `main`. That is all:
- Do NOT deploy anything yourself (no wrangler, no Cloudflare/Pages tokens, no APK upload) and do not add workflows that deploy. Studio sees the new commits and offers «جرّبها» (test copy), then Ahmed presses «انشر التحديث».
- Do not edit Forge-managed files (src/lib/cloud.ts, LockGate, updates.ts, forge-shell.tsx, scripts/assets.mjs, scripts/forge-native.mjs, .github/workflows/*, capacitor.config.ts) — the factory rewrites them.
- Never write keys or passwords into the repo.

## 7. QA notes

- `qa.config.json` → `{ "routes": ["home", "…"] }` — add every route/screen you create.
- Full-page screenshots show fixed bars (bottom nav) at their viewport position — that's expected, not a bug.
- A warning is not a pass for ugliness: if a screenshot looks cramped or empty, fix it even if QA passes.
- Hash route names: ASCII letters/digits/hyphens; avoid reserved names (settings, sidebar, customize, upgrade, downloads) if the app may be previewed as a claude.ai artifact.
