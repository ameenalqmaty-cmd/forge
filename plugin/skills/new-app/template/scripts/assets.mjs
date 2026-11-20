#!/usr/bin/env node
/**
 * FORGE assets — one SVG → every icon the app needs.
 *   npm run assets
 * Reads forge.config.json (name, theme) and colors from src/styles/themes.css.
 * Writes: public/icons/*, public/favicon.svg, public/manifest.webmanifest,
 *         and (if android/ exists) launcher, adaptive, monochrome, notification and splash resources.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const cfg = JSON.parse(readFileSync("forge.config.json", "utf8"));
const css = readFileSync("src/styles/themes.css", "utf8");

/* ---------- theme colors (oklch → hex) ---------- */
function block(sel) {
  const i = css.indexOf(sel + " {");
  if (i < 0) return "";
  return css.slice(i, css.indexOf("}", i));
}
function token(b, name) {
  const m = b.match(new RegExp(`--${name}:\\s*oklch\\(([^)]+)\\)`));
  return m ? m[1].trim().split(/\s+/).map(Number) : null;
}
function oklchToHex([L, C, H]) {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const g = (x) => { x = Math.min(1, Math.max(0, x)); return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255); };
  return "#" + lin.map(g).map((v) => v.toString(16).padStart(2, "0")).join("");
}
const light = block(`[data-theme="${cfg.theme}"]`);
const dark = block(`[data-theme="${cfg.theme}"].dark`);
if (!light) throw new Error(`theme "${cfg.theme}" not found in themes.css`);
const C = {
  primary: oklchToHex(token(light, "primary")),
  primaryDark: oklchToHex(token(light, "primary").map((v, i) => (i === 0 ? v * 0.62 : v))),
  bg: oklchToHex(token(light, "background")),
  bgDark: oklchToHex(token(dark, "background") ?? token(light, "background")),
};

/* ---------- sources ---------- */
// An IMPORTED app ("legacy": true) keeps its own look: its own icon files (PNG or SVG), its own colour, its own manifest
// and index.html (never rewritten). Files: assets/icon.(png|svg) = full icon, assets/icon-maskable.(png|svg) = full-bleed
// icon for Android adaptive/splash, assets/notification.(png|svg) = white mark on transparent. Colour: forge.config.json
// "brand", else the original manifest's background_color.
const legacy = !!cfg.legacy;
const pick = (n) => ["svg", "png"].map((x) => `assets/${n}.${x}`).find((f) => existsSync(f));
const read = (f) => (f ? readFileSync(f) : null);
const customIcon = read(pick("icon"));
const maskIcon = legacy ? read(pick("icon-maskable")) ?? customIcon : null;
const fgFile = pick("icon-foreground");
const fg = read(fgFile) ?? (legacy ? null : readFileSync("assets/icon-foreground.svg"));
const notif = read(pick("notification")) ?? fg;
if (legacy && !customIcon) throw new Error("imported app: put its own icon at assets/icon.png (and icon-maskable.png, notification.png)");
if (legacy && !notif) throw new Error("imported app: put its white notification mark at assets/notification.png");

const bgSvg = (size, radius = 0) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.primary}"/><stop offset="1" stop-color="${C.primaryDark}"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`);

const out = (p) => { mkdirSync(dirname(p), { recursive: true }); return p; };
const png = (input, size) => sharp(input, { density: 512 }).resize(size, size).png();

/** full icon: custom icon.svg, or foreground (scaled) on gradient */
async function fullIcon(size, { radius = 0, fgScale = 0.78 } = {}) {
  if (customIcon) return png(customIcon, size).toBuffer();
  const f = await png(fg, Math.round(size * fgScale)).toBuffer();
  return sharp(bgSvg(size, radius)).composite([{ input: f, gravity: "center" }]).png().toBuffer();
}
/** white silhouette (notification / monochrome) */
async function silhouette(input, size, pad = 0) {
  const inner = Math.round(size * (1 - pad * 2));
  const { data, info } = await sharp(input, { density: 512 }).resize(inner, inner).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = 255; }
  const s = await sharp(data, { raw: info }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: s, gravity: "center" }]).png().toBuffer();
}

/* ---------- launch: one brand color from the system splash to the first screen ---------- */
// The splash (installed web app, APK) and the boot screen in index.html all use the same flat brand color with the
// white mark in the middle, so opening the app is one continuous screen instead of icon-square → white flash → app.
let origManifest = {};
try { if (legacy) origManifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")); } catch {}
const BRAND = (legacy && (cfg.brand || origManifest.background_color || origManifest.theme_color)) || C.primary;
const glyph = async (size) => silhouette(notif, size, 0.12);
/** flat, full-bleed icon in the brand color (what Chrome puts on the splash: it blends into background_color) */
async function flatIcon(size, scale = 0.5) {
  if (maskIcon) return png(maskIcon, size).toBuffer();
  if (customIcon) return png(customIcon, size).toBuffer();
  const f = await glyph(Math.round(size * scale));
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND } }).composite([{ input: f, gravity: "center" }]).png().toBuffer();
}
mkdirSync(".forge", { recursive: true });
writeFileSync(".forge/brand.json", JSON.stringify({ splash: BRAND }, null, 2) + "\n");

/* ---------- web / PWA ---------- */
const glyphPng = await glyph(256);
writeFileSync(out("public/icons/icon-192.png"), await fullIcon(192, { radius: 40 }));
// small white mark shown in the Android status bar for web notifications (forge-sw.js)
writeFileSync(out("public/icons/badge-96.png"), await glyph(96));
if (!legacy) {
writeFileSync(out("public/icons/icon-512.png"), await flatIcon(512));
writeFileSync(out("public/icons/splash-glyph.png"), glyphPng);
writeFileSync(out("public/icons/maskable-512.png"), await fullIcon(512, { fgScale: 0.6 }));
writeFileSync(out("public/icons/apple-touch-icon.png"), await fullIcon(180, { fgScale: 0.7 }));
writeFileSync(out("public/icons/favicon-32.png"), await fullIcon(32, { radius: 7 }));
const fgB64 = fg.toString("base64");
writeFileSync(out("public/favicon.svg"), customIcon ? customIcon : Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.primary}"/><stop offset="1" stop-color="${C.primaryDark}"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/><image href="data:image/svg+xml;base64,${fgB64}" x="56" y="56" width="400" height="400"/></svg>`));

writeFileSync(out("public/manifest.webmanifest"), JSON.stringify({
  name: cfg.name, short_name: cfg.shortName, description: cfg.description ?? "",
  lang: "ar", dir: "rtl", start_url: "./", scope: "./", display: "standalone", orientation: "any",
  background_color: BRAND, theme_color: BRAND,
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));

// keep index.html title + theme-color in sync with config
let html = readFileSync("index.html", "utf8");
html = html.replace(/<title>.*?<\/title>/, `<title>${cfg.name}</title>`)
  .replace(/<meta name="theme-color" content="[^"]*"/, `<meta name="theme-color" content="${C.bg}"`)
  .replace(/data-theme="[^"]*"/, `data-theme="${cfg.theme}"`);
// boot screen: shown by the browser before any JS, removed by LockGate when the first real screen is ready
const boot = `<!-- forge-boot -->
    <style>#forge-boot{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:${BRAND};transition:opacity .35s ease}#forge-boot.out{opacity:0;pointer-events:none}#forge-boot img{width:88px;height:88px}#forge-boot .fail{display:none;position:absolute;inset:auto 0 max(48px,env(safe-area-inset-bottom));text-align:center;color:#fff;font:15px/1.7 system-ui,sans-serif}#forge-boot .fail button{margin-top:8px;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid #ffffff66;background:transparent;color:#fff;font:inherit}@media (prefers-reduced-motion:reduce){#forge-boot{transition:none}}</style>
    <div id="forge-boot" aria-hidden="true"><img alt="" src="data:image/png;base64,${glyphPng.toString("base64")}"><div class="fail">تعذّر فتح التطبيق<br><button onclick="location.reload()">أعد المحاولة</button></div></div>
    <script>setTimeout(function(){var b=document.getElementById("forge-boot");if(b&&!b.classList.contains("out")){var f=b.querySelector(".fail");if(f)f.style.display="block"}},12000)</script>
    <!-- /forge-boot -->`;
html = /<!-- forge-boot -->[\s\S]*?<!-- \/forge-boot -->/.test(html)
  ? html.replace(/<!-- forge-boot -->[\s\S]*?<!-- \/forge-boot -->/, boot)
  : html.replace(/<body([^>]*)>/, `<body$1>\n    ${boot}`);
writeFileSync("index.html", html);
}

/* ---------- Android ---------- */
let androidDone = false;
if (existsSync("android/app/src/main/res")) {
  const res = "android/app/src/main/res";
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    writeFileSync(out(`${res}/mipmap-${d}/ic_launcher.png`), await fullIcon(48 * k, { radius: 10 * k, fgScale: 0.7 }));
    const round = maskIcon ? await png(maskIcon, 48 * k).toBuffer() : await fullIcon(48 * k, { fgScale: 0.62 });
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${48 * k}" height="${48 * k}"><circle cx="${24 * k}" cy="${24 * k}" r="${24 * k}"/></svg>`);
    writeFileSync(out(`${res}/mipmap-${d}/ic_launcher_round.png`), await sharp(round).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer());
    // adaptive foreground: 108dp canvas, mark inside central 66dp
    const fgSize = Math.round(108 * k);
    if (maskIcon) {
      // full-bleed icon of the imported app fills the adaptive canvas (its mark sits in the middle, like the original)
      writeFileSync(out(`${res}/mipmap-${d}/ic_launcher_foreground.png`), await png(maskIcon, fgSize).toBuffer());
    } else {
      const f = await png(fg, Math.round(fgSize * 0.5)).toBuffer();
      writeFileSync(out(`${res}/mipmap-${d}/ic_launcher_foreground.png`), await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: f, gravity: "center" }]).png().toBuffer());
    }
    writeFileSync(out(`${res}/mipmap-${d}/ic_launcher_monochrome.png`), await silhouette(notif, fgSize, 0.25));
    // notification icon: 24dp white silhouette
    writeFileSync(out(`${res}/drawable-${d}/ic_stat_notify.png`), await silhouette(notif, Math.round(24 * k), 0.04));
  }
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>\n`;
  writeFileSync(out(`${res}/mipmap-anydpi-v26/ic_launcher.xml`), adaptive);
  writeFileSync(out(`${res}/mipmap-anydpi-v26/ic_launcher_round.xml`), adaptive);
  writeFileSync(out(`${res}/values/ic_launcher_background.xml`), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">${legacy ? BRAND : C.primary}</color>\n  <color name="notification_accent">${legacy ? BRAND : C.primary}</color>\n  <color name="forge_brand">${BRAND}</color>\n</resources>\n`);
  // Android 12+ system splash: brand background + the white mark (icon area = central 2/3 of a 288dp canvas)
  for (const [d, k] of Object.entries(dens)) {
    const size = Math.round(288 * k);
    writeFileSync(out(`${res}/drawable-${d}/splash_icon.png`), await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await glyph(Math.round(size * 0.42)), gravity: "center" }]).png().toBuffer());
  }
  const stylesPath = `${res}/values/styles.xml`;
  if (existsSync(stylesPath)) {
    let st = readFileSync(stylesPath, "utf8");
    st = st.replace(/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/, `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">@color/forge_brand</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`);
    if (!st.includes('android:windowBackground">@color/forge_brand')) st = st.replace(/(<style name="AppTheme\.NoActionBar" [^>]*>)/, `$1\n        <item name="android:windowBackground">@color/forge_brand</item>`);
    writeFileSync(stylesPath, st);
  }
  // splash (Capacitor SplashScreen uses @drawable/splash)
  // Capacitor ships default splash images in drawable-port-*/drawable-land-* that would override ours → overwrite every one
  const logo = await glyph(520);
  const splash = async (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: BRAND } }).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
  const dirs = new Set(["drawable", "drawable-night", ...readdirSync(res).filter((d) => existsSync(`${res}/${d}/splash.png`))]);
  for (const dir of dirs) {
    const [w, h] = dir.includes("land") ? [2732, 1536] : dir.includes("port") ? [1536, 2732] : [2732, 2732];
    writeFileSync(out(`${res}/${dir}/splash.png`), await splash(w, h));
  }
  androidDone = true;
}

console.log(`✓ assets generated — theme "${cfg.theme}" primary ${C.primary}, background ${C.bg}${androidDone ? " (+ Android resources)" : " (run again after `npx cap add android` for Android resources)"}`);
