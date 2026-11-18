#!/usr/bin/env node
/**
 * FORGE visual QA — run after every change:  npm run qa
 * Builds, serves, then for every route × [phone, tablet, desktop] (light + dark):
 *   ✗ FAIL  horizontal overflow (the "scrollbar appears" bug)
 *   ✗ FAIL  element sticking out of the screen
 *   ✗ FAIL  console errors / uncaught exceptions
 *   ⚠ WARN  tap targets smaller than 40px, text clipped
 * Screenshots → qa/screens/  (Claude MUST look at them before saying "done").
 * Routes come from qa.config.json → { "routes": ["home", "settings"] } (hash routes).
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const cfg = existsSync("qa.config.json") ? JSON.parse(readFileSync("qa.config.json", "utf8")) : {};
const ROUTES = cfg.routes ?? ["home"];
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "phone-small", width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "tablet", width: 820, height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "tablet-landscape", width: 1180, height: 820, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { name: "desktop", width: 1280, height: 800, deviceScaleFactor: 1 },
];
const MODES = cfg.modes ?? ["light", "dark"];
const THEMES = cfg.themes ?? [null]; // null = app default theme
const PORT = 4321;
const OUT = "qa/screens";

const run = (cmd, args) => new Promise((ok, bad) => {
  const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  p.on("exit", (c) => (c === 0 ? ok() : bad(new Error(`${cmd} ${args.join(" ")} failed`))));
});

if (!process.argv.includes("--no-build")) await run("npx", ["vite", "build", "--logLevel", "warn"]);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1800));

const launch = { args: ["--font-render-hinting=none"] };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
else if (existsSync("/usr/bin/google-chrome") && !process.env.CI) launch.executablePath = "/usr/bin/google-chrome";
const browser = await chromium.launch(launch);

const fails = [];
const warns = [];

try {
  for (const theme of THEMES) for (const vp of VIEWPORTS) {
    for (const mode of MODES) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, colorScheme: mode, locale: "ar" });
      await ctx.addInitScript(([m, t]) => { try { localStorage.setItem("forge.mode", m); if (t) localStorage.setItem("forge.theme", t); } catch {} }, [mode, theme]);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

      for (const route of ROUTES) {
        const tag = `${route} @ ${vp.name}/${mode}${theme ? "/" + theme : ""}`;
        errors.length = 0;
        await page.goto(`http://localhost:${PORT}/#${route}`, { waitUntil: "networkidle" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(450); // let entrance animations finish

        const r = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const overflow = document.documentElement.scrollWidth - vw;
          const out = [], small = [], clipped = [];
          const visible = (el) => { const s = getComputedStyle(el); return s.visibility !== "hidden" && s.display !== "none" && el.getClientRects().length; };
          const insideScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return p !== document.documentElement && p !== document.body; } return false; };
          const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
          for (const el of document.body.querySelectorAll("*")) {
            if (!visible(el) || el.closest("[aria-hidden=true], .pointer-events-none")) continue;
            const b = el.getBoundingClientRect();
            if (b.width === 0 || b.height === 0) continue;
            if ((b.right > vw + 1 || b.left < -1) && !insideScroller(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${label(el)}"`);
            if (el.matches("button, a[href], [role=button], input, select") && (b.height < 36 || b.width < 36) && !el.closest("p, label")) small.push(`"${label(el)}" ${Math.round(b.width)}×${Math.round(b.height)}`);
            if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 2 && !getComputedStyle(el).textOverflow.includes("ellipsis") && getComputedStyle(el).overflow !== "visible") clipped.push(label(el));
          }
          return { overflow, out: [...new Set(out)].slice(0, 8), small: [...new Set(small)].slice(0, 8), clipped: [...new Set(clipped)].slice(0, 5) };
        });

        if (r.overflow > 1) fails.push(`${tag}: horizontal overflow ${r.overflow}px (page scrolls sideways)`);
        if (r.out.length) fails.push(`${tag}: off-screen → ${r.out.join(" | ")}`);
        if (errors.length) fails.push(`${tag}: console errors → ${errors.slice(0, 3).join(" | ")}`);
        if (r.small.length) warns.push(`${tag}: small tap targets → ${r.small.join(" | ")}`);
        if (r.clipped.length) warns.push(`${tag}: clipped text → ${r.clipped.join(" | ")}`);

        await page.screenshot({ path: `${OUT}/${theme ? theme + "--" : ""}${route}--${vp.name}--${mode}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}

const total = THEMES.length * ROUTES.length * VIEWPORTS.length * MODES.length;
console.log(`\nForge QA — ${total} screens checked, screenshots in ${OUT}/`);
for (const w of warns) console.log("  ⚠", w);
for (const f of fails) console.log("  ✗", f);
if (fails.length) { console.log(`\n✗ FAILED (${fails.length})`); process.exit(1); }
console.log(`\n✓ PASSED${warns.length ? ` with ${warns.length} warnings` : ""}`);
