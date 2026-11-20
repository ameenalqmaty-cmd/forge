/**
 * Forge layer for IMPORTED apps (forge.config.json "legacy": true) — managed by Forge, do not edit.
 *
 * The imported app keeps its own index.html, code and look. index.html loads this one module:
 *   <script type="module" src="/src/forge-shell.tsx"></script>
 * and gets everything Studio controls, without touching the original page:
 *   - pause / lock screens, broadcast messages, push offer, in-app updates, «نسخة تجريبية» badge (LockGate overlay)
 *   - usage stats with people's names (cloud presence)
 *   - window.forge.cloud: the Forge Cloud API (collections, auth, track) for the app's own scripts
 * Its UI lives in a shadow root, so Forge's styles never leak into the app and the app's styles never break Forge's.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans-arabic/arabic-400.css";
import "@fontsource/ibm-plex-sans-arabic/arabic-700.css";
import css from "./styles/globals.css?inline";
import config from "../forge.config.json";
import { LockGate } from "@/components/LockGate";
import { cloud } from "@/lib/cloud";

declare global {
  interface Window { forge?: { cloud: typeof cloud; ready: true } }
}
window.forge = { cloud, ready: true };
window.dispatchEvent(new Event("forge-ready"));

function mount() {
  if (document.getElementById("forge-shell")) return;
  const host = document.createElement("div");
  host.id = "forge-shell";
  // zero-size host: Forge's layers are position:fixed, so they cover the screen only when they need to
  host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = css;
  shadow.appendChild(style);
  // @property rules are ignored inside a shadow root; they are global and harmless in the document
  const props = css.match(/@property[^{]+\{[^}]*\}/g);
  if (props) {
    const p = document.createElement("style");
    p.id = "forge-shell-props";
    p.textContent = props.join("\n");
    document.head.appendChild(p);
  }

  const wrap = document.createElement("div");
  wrap.setAttribute("data-theme", (config as { theme?: string }).theme || "edu");
  wrap.setAttribute("dir", "rtl");
  wrap.setAttribute("lang", "ar");
  wrap.style.fontFamily = "'IBM Plex Sans Arabic', system-ui, sans-serif";
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)");
  const syncDark = () => wrap.classList.toggle("dark", document.documentElement.classList.contains("dark") || document.body.classList.contains("dark") || !!dark?.matches);
  syncDark();
  dark?.addEventListener?.("change", syncDark);
  new MutationObserver(syncDark).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  shadow.appendChild(wrap);
  document.body.appendChild(host);

  createRoot(wrap).render(
    <StrictMode>
      <LockGate overlay>{null}</LockGate>
    </StrictMode>,
  );
}

if (document.body) mount();
else document.addEventListener("DOMContentLoaded", mount, { once: true });
