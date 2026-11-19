import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, PauseCircle, RefreshCw } from "lucide-react";
import { cloud, type AppInfo } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Wraps the whole app in main.tsx. Controlled from Forge Studio → التشغيل → الخصوصية:
 * - App lock: visitors enter a code once per device.
 * - Pause: everyone sees the owner's message instead of the app (owner and app admins still get in).
 * Checks again every minute and when the app comes back to the foreground. Does nothing without Forge Cloud.
 * Also owns the launch and the pull-to-refresh for every app:
 * - fades out the brand boot screen (#forge-boot, from index.html) once the first real screen is ready;
 * - replaces the browser's pull-to-refresh with one in the app's colors. Apps that can refresh in place listen to
 *   `window.addEventListener("forge:refresh", (e) => { e.preventDefault(); reload data… })`; otherwise the page reloads.
 * Forge-managed file: do not edit (the factory refreshes it).
 */
const KEY = `forge-unlocked-${cloud.appId}`;
type State = "checking" | "open" | "locked" | "paused";

const INFO_KEY = `forge-info-${cloud.appId}`;
/** last known state, so a paused app stays paused when the phone is offline (APK) */
const cachedInfo = (): AppInfo | null => { try { return JSON.parse(localStorage.getItem(INFO_KEY) || "null"); } catch { return null; } };
const cacheInfo = (i: AppInfo) => { try { localStorage.setItem(INFO_KEY, JSON.stringify(i)); } catch { /* */ } };
const isUnlocked = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** waits briefly for the signed-in user (device account or email) to know their role */
function roleSoon(ms = 4000): Promise<string | null> {
  const now = cloud.auth.user();
  if (now) return Promise.resolve(now.role);
  return new Promise((resolve) => {
    const t = setTimeout(() => { off(); resolve(null); }, ms);
    const off = cloud.auth.onChange((u) => { if (u) { clearTimeout(t); off(); resolve(u.role); } });
  });
}

/** fade out the boot screen; while it is up the status bar matches it */
function useBootScreen(ready: boolean) {
  useEffect(() => {
    const boot = document.getElementById("forge-boot");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!boot) return;
    if (!ready) {
      const brand = getComputedStyle(boot).backgroundColor;
      if (meta && brand) { meta.setAttribute("data-app", meta.getAttribute("content") ?? ""); meta.setAttribute("content", brand); }
      return;
    }
    const t = requestAnimationFrame(() => {
      boot.classList.add("out");
      const app = meta?.getAttribute("data-app");
      if (meta && app) meta.setAttribute("content", app);
      setTimeout(() => boot.remove(), 400);
    });
    return () => cancelAnimationFrame(t);
  }, [ready]);
}

const PULL = 72; // px to trigger
function PullToRefresh({ children }: { children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pulled = useRef(0);
  useEffect(() => {
    document.documentElement.style.overscrollBehaviorY = "none"; // no browser pull-to-refresh / bounce
    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0;
    const insideScroller = (t: EventTarget | null) => {
      for (let el = t as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        if (el.scrollTop > 0) return true; // a scrolled inner list: let it scroll back first
        if (el.closest?.('[role="dialog"], [data-no-pull]')) return true;
      }
      return false;
    };
    const down = (e: TouchEvent) => { start.current = !busy && e.touches.length === 1 && atTop() && !insideScroller(e.target) ? e.touches[0].clientY : null; };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      pulled.current = dy <= 0 || !atTop() ? 0 : Math.min(PULL * 1.6, dy * 0.5);
      setPull(pulled.current);
    };
    const up = () => {
      if (start.current === null) return;
      start.current = null;
      const p = pulled.current;
      pulled.current = 0;
      setPull(0);
      if (p < PULL) return;
      setBusy(true);
      const ev = new CustomEvent("forge:refresh", { cancelable: true });
      window.dispatchEvent(ev);
      if (!ev.defaultPrevented) setTimeout(() => location.reload(), 250);
      else setTimeout(() => setBusy(false), 900);
    };
    addEventListener("touchstart", down, { passive: true });
    addEventListener("touchmove", move, { passive: true });
    addEventListener("touchend", up);
    addEventListener("touchcancel", up);
    return () => { removeEventListener("touchstart", down); removeEventListener("touchmove", move); removeEventListener("touchend", up); removeEventListener("touchcancel", up); };
  }, [busy]);

  const shown = busy || pull > 4;
  const progress = Math.min(1, pull / PULL);
  return (
    <>
      <div aria-hidden={!busy} role={busy ? "status" : undefined} aria-label={busy ? "يحدّث" : undefined}
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
        style={{ transform: `translateY(${busy ? 56 : Math.max(0, pull - 8)}px)`, opacity: shown ? 1 : 0, transition: start.current === null ? "transform .25s ease, opacity .2s" : "none", paddingTop: "env(safe-area-inset-top)" }}>
        <span className="-mt-11 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
          <RefreshCw className={busy ? "size-5 animate-spin" : "size-5"} style={busy ? undefined : { transform: `rotate(${progress * 300}deg)`, opacity: 0.4 + progress * 0.6 }} />
        </span>
      </div>
      {children}
    </>
  );
}

export function LockGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => (!cloud.enabled ? "open" : isUnlocked() ? "open" : "checking"));
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [adminView, setAdminView] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => { void cloud.presence(); return () => { alive.current = false; }; }, []);
  useBootScreen(state !== "checking");

  const check = useCallback(async () => {
    if (!cloud.enabled) return;
    let i: AppInfo;
    try { i = await cloud.lock.info(); cacheInfo(i); }
    catch {
      const c = cachedInfo(); // offline: trust the last answer
      if (!c) { setState((s) => (s === "checking" ? "open" : s)); return; }
      i = c;
    }
    if (!alive.current) return;
    setInfo(i);
    if (i.paused) {
      const role = await roleSoon();
      if (!alive.current) return;
      const admin = role === "owner" || role === "admin";
      setAdminView(admin);
      setState(admin ? (i.locked && !isUnlocked() ? "locked" : "open") : "paused");
      return;
    }
    setAdminView(false);
    setState(i.locked && !isUnlocked() ? "locked" : "open");
  }, []);

  useEffect(() => {
    if (!cloud.enabled) return;
    void check();
    const t = setInterval(() => void check(), 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [check]);

  if (state === "open") {
    return (
      <>
        {adminView && info?.paused && (
          <div role="status" className="sticky top-0 z-50 bg-foreground px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-sm font-semibold text-background">
            التطبيق متوقف للزوار. أنت تراه لأنك مشرف.
          </div>
        )}
        <PullToRefresh>{children}</PullToRefresh>
      </>
    );
  }
  if (state === "checking") return <div className="grid h-dvh place-items-center bg-background"><span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;

  if (state === "paused") {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm animate-rise text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground"><PauseCircle className="size-8" /></span>
          <h1 className="mt-5 text-fluid-xl font-bold">{info?.name || "التطبيق"} متوقف مؤقتاً</h1>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{info?.message || "نعمل على تحسينه، ونعود قريباً إن شاء الله."}</p>
          <Button variant="outline" className="mt-6" onClick={() => void check()}>تحقّق مرة أخرى</Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (await cloud.lock.check(code.trim())) { try { localStorage.setItem(KEY, "1"); } catch { /* */ } setState("open"); }
      else setError("الرمز غير صحيح");
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التحقق"); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <form className="w-full max-w-sm animate-rise text-center" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary"><Lock className="size-7" /></span>
        <h1 className="mt-5 text-fluid-xl font-bold">{info?.name || "تطبيق خاص"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">هذا التطبيق مقفل. أدخل الرمز الذي أعطاك إياه صاحبه.</p>
        <Input className="mt-6 text-center tracking-[0.3em]" dir="ltr" inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value)} aria-label="رمز الدخول" placeholder="••••" />
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <Button className="mt-4 w-full" size="lg" disabled={busy || !code.trim()}>{busy ? "يتحقق…" : "دخول"}</Button>
      </form>
    </div>
  );
}
