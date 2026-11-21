/**
 * App updates inside the APK (Forge-managed file: do not edit — the factory refreshes it).
 *
 * Two layers:
 * 1. Live update (most changes: screens, text, features): the new web bundle downloads in the background and is applied
 *    silently — on the next launch, or right away behind a loading screen when Ahmed marked it mandatory in Studio.
 * 2. APK update (only when the Android part changed): downloaded inside the app with progress, then Android's own
 *    "Install" prompt (one tap; Android never lets an app install itself silently).
 *
 * Only active inside APKs built by Forge with the updater (android.yml); on the web it does nothing.
 */
import { useEffect, useRef, useState } from "react";
import { cloud } from "./cloud";

type Bundle = { id: string; version: string };
type Updater = {
  notifyAppReady(): Promise<unknown>;
  current(): Promise<{ bundle: Bundle; native: string }>;
  download(o: { url: string; version: string }): Promise<Bundle>;
  next(o: { id: string }): Promise<Bundle>;
  set(o: { id: string }): Promise<void>;
  list(): Promise<{ bundles: Bundle[] }>;
  addListener(e: "download", f: (s: { percent: number; bundle?: Bundle }) => void): Promise<{ remove(): Promise<void> }>;
};
type Release = { web: { version: string; url: string; size: number; notes: string | null } | null; web_must: string | null;
  apk: { version: string; url: string; size: number; notes: string | null; native: string } | null; apk_must: string | null };

export type UpdateState =
  | { kind: "idle" }
  | { kind: "web-ready"; version: string; notes: string | null; mandatory: boolean; bundle: Bundle }   // downloaded, waiting to apply
  | { kind: "web-applying"; percent: number; notes: string | null }                                      // mandatory: loading screen
  | { kind: "apk"; version: string; notes: string | null; mandatory: boolean; url: string; size: number }
  | { kind: "apk-downloading"; percent: number; mandatory: boolean }
  | { kind: "apk-error"; message: string; mandatory: boolean; url: string; size: number; version: string; notes: string | null };

const env = import.meta.env;
const URL_ = env.VITE_FORGE_CLOUD_URL as string | undefined;
const KEY = env.VITE_FORGE_CLOUD_KEY as string | undefined;
const APP = (env.VITE_FORGE_APP_ID as string | undefined) ?? "";
const NATIVE = (env.VITE_FORGE_NATIVE as string | undefined) ?? "";
const APK_KEY = `forge-apk-version-${APP}`;

type Cap = { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean };
const cap = () => (window as unknown as { Capacitor?: Cap }).Capacitor;
// only a Forge-built APK carries the updater; an older shell that just loads the site (e.g. an imported app's old APK) skips it
const native = () => !!cap()?.isNativePlatform?.() && !!cap()?.isPluginAvailable?.("CapacitorUpdater");
export const updatesEnabled = () => typeof window !== "undefined" && native() && !!URL_ && !!KEY && !!NATIVE && env.VITE_FORGE_UPDATER === "1";

// NEVER return a Capacitor plugin proxy from an async function / promise: `await` calls its `.then`, which the proxy
// forwards to Android as a plugin method → "CapacitorUpdater.then() is not implemented on android". Box it.
async function plugin<T>(name: string): Promise<{ p: T }> {
  const { registerPlugin } = await import("@capacitor/core");
  return { p: registerPlugin<T>(name) };
}

// A new bundle MUST report itself ready within appReadyTimeout (15 s) or Capacitor Updater silently rolls back to the previous bundle
// (then the same update is offered again, in a loop). So do it the moment this file loads, never from a component that mounts late.
const WANT_KEY = `forge-update-want-${APP}`;
let readyOnce: Promise<void> | null = null;
function reportReady(): Promise<void> {
  if (readyOnce) return readyOnce;
  readyOnce = (async () => {
    if (!native()) return;
    try {
      const up = (await plugin<Updater>("CapacitorUpdater")).p;
      await up.notifyAppReady();
      let want: string | null = null;
      try { want = localStorage.getItem(WANT_KEY); } catch { /* */ }
      if (want) { // we asked for this bundle before the last reload: say what happened (visible in Studio → التشغيل → الأحداث)
        try { localStorage.removeItem(WANT_KEY); } catch { /* */ }
        const cur = await up.current();
        const ok = cur.bundle.version === want;
        try { cloud.track(ok ? "update_applied" : "update_rolled_back", { want, got: cur.bundle.version }); } catch { /* */ }
      }
    } catch (e) { console.warn("[forge-updates] notifyAppReady", e); }
  })();
  return readyOnce;
}
if (typeof window !== "undefined") void reportReady();

async function latest(): Promise<Release | null> {
  const r = await fetch(`${URL_}/rest/v1/rpc/forge_latest_release`, {
    method: "POST", headers: { apikey: KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ a: APP, nat: NATIVE }),
  });
  return r.ok ? r.json() : null;
}

/** the web version running now and the APK version installed */
async function versions(up: Updater) {
  const cur = await up.current();
  const builtin = cur.bundle.id === "builtin";
  if (builtin) { try { localStorage.setItem(APK_KEY, env.VITE_FORGE_APK_VERSION ?? "0"); } catch { /* */ } }
  const apk = (() => { try { return localStorage.getItem(APK_KEY) ?? env.VITE_FORGE_APK_VERSION ?? "0"; } catch { return env.VITE_FORGE_APK_VERSION ?? "0"; } })();
  const web = builtin ? (env.VITE_FORGE_WEB_VERSION ?? "0") : cur.bundle.version;
  return { web, apk };
}

export function useAppUpdates() {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const busy = useRef(false);

  useEffect(() => {
    if (!updatesEnabled()) return;
    let alive = true;
    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const up = (await plugin<Updater>("CapacitorUpdater")).p;
        await reportReady(); // keeps this bundle (no automatic rollback)
        const rel = await latest();
        if (!rel || !alive) return;
        const v = await versions(up);

        // 1) a new APK is needed (the Android part changed)
        if (rel.apk && rel.apk.version > v.apk && rel.apk.native !== NATIVE) {
          const mandatory = !!rel.apk_must && rel.apk_must > v.apk;
          setState({ kind: "apk", version: rel.apk.version, notes: rel.apk.notes, mandatory, url: rel.apk.url, size: rel.apk.size });
          return;
        }
        // 2) a newer web bundle for this APK
        if (rel.web && rel.web.version > v.web) {
          const mandatory = !!rel.web_must && rel.web_must > v.web;
          let sub: { remove(): Promise<void> } | null = null;
          if (mandatory) {
            setState({ kind: "web-applying", percent: 0, notes: rel.web.notes });
            sub = await up.addListener("download", (s) => alive && setState({ kind: "web-applying", percent: Math.round(s.percent), notes: rel.web!.notes }));
          }
          const have = (await up.list()).bundles.find((b) => b.version === rel.web!.version);
          const bundle = have ?? (await up.download({ url: rel.web.url, version: rel.web.version }));
          await sub?.remove();
          try { localStorage.setItem(WANT_KEY, rel.web.version); } catch { /* */ }
          if (mandatory) { await up.set({ id: bundle.id }); return; } // reloads into the new version
          await up.next({ id: bundle.id }); // applied on the next launch anyway
          if (alive) setState({ kind: "web-ready", version: rel.web.version, notes: rel.web.notes, mandatory: false, bundle });
        }
      } catch (e) {
        console.warn("[forge-updates]", e);
        setState((s) => (s.kind === "web-applying" ? { kind: "idle" } : s)); // never block the app on a failed download
      } finally { busy.current = false; }
    };
    void run();
    const t = setInterval(() => void run(), 30 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const applyNow = async () => {
    if (state.kind !== "web-ready") return;
    const up = (await plugin<Updater>("CapacitorUpdater")).p;
    setState({ kind: "web-applying", percent: 100, notes: state.notes });
    try { localStorage.setItem(WANT_KEY, state.version); } catch { /* */ }
    await up.set({ id: state.bundle.id });
  };

  /** download the APK inside the app (progress), then hand it to Android's installer */
  const installApk = async () => {
    if (state.kind !== "apk" && state.kind !== "apk-error") return;
    const { url, mandatory, size, version, notes } = state;
    setState({ kind: "apk-downloading", percent: 0, mandatory });
    try {
      // Filesystem.downloadFile still ships in v8 (deprecated in favour of @capacitor/file-transfer; swap when it is removed)
      type Fs = { downloadFile(o: { url: string; path: string; directory: string; progress?: boolean }): Promise<{ path?: string }>;
        addListener(e: "progress", f: (p: { bytes: number; contentLength: number }) => void): Promise<{ remove(): Promise<void> }> };
      const fs = (await plugin<Fs>("Filesystem")).p;
      const sub = await fs.addListener("progress", (p) => setState({ kind: "apk-downloading", percent: Math.min(99, Math.round((p.bytes / (p.contentLength || size || 1)) * 100)), mandatory }));
      const res = await fs.downloadFile({ url, path: `update-${version}.apk`, directory: "CACHE", progress: true });
      await sub.remove();
      setState({ kind: "apk-downloading", percent: 100, mandatory });
      const opener = (await plugin<{ openFile(o: { path: string; mimeType: string }): Promise<void> }>("FileOpener")).p;
      await opener.openFile({ path: res.path!, mimeType: "application/vnd.android.package-archive" });
      setState({ kind: "apk", version, notes, mandatory, url, size }); // if they cancel Android's prompt, they can try again
    } catch (e) {
      setState({ kind: "apk-error", message: e instanceof Error ? e.message : String(e), mandatory, url, size, version, notes });
    }
  };

  const dismiss = () => setState((s) => (("mandatory" in s && s.mandatory) ? s : { kind: "idle" }));
  return { state, applyNow, installApk, dismiss };
}
