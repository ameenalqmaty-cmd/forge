---
name: publish-app
description: Publish or release a Forge app — web deploy to Cloudflare Pages, Android APK releases, custom domain, locking the app, and Google Play (AAB, signing, store listing). Use when the user asks to publish, deploy, release, get the APK, link a domain, or upload to Google Play.
---

# Publish a Forge app

All publishing runs in GitHub Actions on push (`.github/workflows/web.yml`, `android.yml`). Your job: make sure the pieces are configured, trigger a build, and give the user working links.

## Web (Cloudflare Pages) — free

One-time per repo (or once for all repos if they live in a GitHub **organization**: org secrets apply to every repo — recommend this to the user):
1. Cloudflare dashboard → My Profile → API Tokens → Create token → template **"Edit Cloudflare Workers"** (includes Pages) → copy.
2. Account ID: Cloudflare dashboard → Workers & Pages → right sidebar.
3. GitHub repo (or org) → Settings → Secrets and variables → Actions → add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Result: `main` → `https://<cloudflareProject>.pages.dev`; any other branch → preview URL `https://<branch>.<cloudflareProject>.pages.dev` (use branches for risky changes).

**Custom domain:** Cloudflare → Workers & Pages → project → Custom domains → add. Free SSL.
**Lock the app (password / allowed emails):** Cloudflare Zero Trust → Access → Applications → self-hosted → the Pages domain → policy (emails or one-time PIN). Free for up to 50 users.
**Visitors:** Cloudflare → Web Analytics → enable for the Pages project (no cookie banner needed).

## Android APK — direct install

APKs are built **on demand only** (previews are the web build, so edits never wait on Android). Trigger: Actions → "Android APK" → Run workflow (Forge Studio's "تثبيت مباشر" calls the same `workflow_dispatch`), or push a tag `vX.Y.Z`. Each run creates a GitHub Release `build-N` with `<app>-<version>-buildN.apk`. On the phone: repo → Releases → latest → download the APK → install (allow "install unknown apps" once). Bump `version` in `forge.config.json` for a visible version change; the build number becomes `versionCode` automatically.

## Google Play

Needs the user's Google Play developer account (one-time $25) — you cannot create it.
1. Release key (once, keep it forever — losing it means you can't update the app):
   `keytool -genkeypair -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000`
   Never commit it. Add secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
2. The next build also produces `<app>-<version>-play.aab` — that's what Play Console wants.
3. Store listing assets — generate them for the user:
   - icon 512×512: `public/icons/icon-512.png`
   - feature graphic 1024×500: render one with sharp/HTML in the app's theme
   - phone screenshots: from `qa/screens/*--phone--light.png` (crop to 1080×1920 / 9:16), tablet ones from `--tablet--`
   - short description (≤ 80 chars) + full description in Arabic
   - privacy policy: add a `privacy` route/page to the app and give its URL
4. Data safety form: list what the app collects (from the Supabase tables) — draft the answers for the user.

## Report

Give the links (web, Releases page), what you configured, and exactly what the user must still do himself.
