import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing, Download, Eye, Lock, Megaphone, PauseCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { useAppUpdates } from "@/lib/updates";
import { num } from "@/lib/format";
import { actingError, cloud, useMessages, type AppInfo, type CloudUser } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Wraps the whole app in main.tsx. Controlled from Forge Studio → التشغيل → الخصوصية:
 * - App lock: visitors enter a code once per device.
 * - Pause: everyone sees the owner's message instead of the app (owner and app admins still get in).
 * Checks again every minute and when the app comes back to the foreground. Does nothing without Forge Cloud.
 * Also owns the launch and the pull-to-refresh for every app:
 * - fades out the brand boot screen (#forge-boot, from index.html) once the first real screen is ready;
 * - shows unread messages from Ahmed / the app's admins as a card at the top (one at a time, important first);
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

/** APK: the system splash (same logo, same place as the launcher icon animation) fades straight into the app */
function hideNativeSplash() {
  const sp = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { SplashScreen?: { hide(o?: { fadeOutDuration?: number }): Promise<void> } } } }).Capacitor;
  if (!sp?.isNativePlatform?.()) return;
  try { void sp.Plugins?.SplashScreen?.hide({ fadeOutDuration: 250 })?.catch?.(() => {}); } catch { /* the splash hides itself after 8 s */ }
}

/** fade out the boot screen; while it is up the status bar matches it */
function useBootScreen(ready: boolean) {
  useEffect(() => {
    const boot = document.getElementById("forge-boot");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!boot) { if (ready) hideNativeSplash(); return; } // imported apps: no boot screen, still release the splash
    if (!ready) {
      const brand = getComputedStyle(boot).backgroundColor;
      if (meta && brand) { meta.setAttribute("data-app", meta.getAttribute("content") ?? ""); meta.setAttribute("content", brand); }
      return;
    }
    // open on the real screen, not on loading placeholders: wait until no Skeleton is drawn (at most 1.5 s more)
    let off = false;
    const started = Date.now();
    const reveal = () => {
      if (off) return;
      if (document.querySelector("[data-skeleton]") && Date.now() - started < 1500) { setTimeout(reveal, 60); return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { // two frames: the screen is painted under the splash
        if (off) return;
        hideNativeSplash();
        boot.classList.add("out");
        const app = meta?.getAttribute("data-app");
        if (meta && app) meta.setAttribute("content", app);
        setTimeout(() => boot.remove(), 300);
      }));
    };
    reveal();
    return () => { off = true; };
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

/** unread messages, one at a time; "تم" marks it read. Apps with their own inbox can hide it: <html data-forge-banner="off"> */
const ASKED = `forge-push-asked-${cloud.appId}`;
/** after "تم" on a message: offer to get the next ones as phone notifications (once every 2 weeks, if possible) */
function PushOffer({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const later = () => { try { localStorage.setItem(ASKED, String(Date.now())); } catch { /* */ } onDone(); };
  const enable = async () => {
    setBusy(true);
    try {
      const s = await cloud.push.enable();
      if (s === "on") { setMsg("ستصلك التنبيهات القادمة حتى والتطبيق مغلق ✓"); setTimeout(later, 1800); }
      else if (s === "denied") { setMsg("الإشعارات ممنوعة لهذا التطبيق من إعدادات الجهاز"); setTimeout(later, 2500); }
      else later();
    } catch (e) { setMsg(e instanceof Error ? e.message : "تعذّر التفعيل"); setTimeout(later, 2500); }
    finally { setBusy(false); }
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
      <div role="dialog" aria-label="تنبيهات الهاتف" className="pointer-events-auto w-full max-w-md animate-rise rounded-2xl border border-border bg-card p-4 shadow-xl">
        {msg ? <p className="text-sm font-semibold" role="status">{msg}</p> : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><BellRing className="size-5" /></span>
              <div className="min-w-0"><div className="font-bold">تريد أن تصلك التنبيهات على هاتفك؟</div><p className="mt-0.5 text-sm text-muted-foreground">حتى لو كان التطبيق مغلقاً. يمكنك إيقافها متى شئت.</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" disabled={busy} onClick={() => void enable()}>{busy ? "لحظة…" : "نعم، فعّلها"}</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={later}>لاحقاً</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MessageBanner() {
  const { unread, markRead } = useMessages();
  const [hidden, setHidden] = useState(false);
  const [offer, setOffer] = useState(false);
  const done = async (id: string) => {
    await markRead(id);
    if (unread.length > 1) return;
    try {
      const asked = Number(localStorage.getItem(ASKED) || 0);
      if (Date.now() - asked > 14 * 864e5 && (await cloud.push.state()) === "default") setOffer(true);
    } catch { /* */ }
  };
  if (offer) return <PushOffer onDone={() => setOffer(false)} />;
  if (hidden || typeof document !== "undefined" && document.documentElement.dataset.forgeBanner === "off") return null;
  const m = [...unread].sort((a, b) => Number(b.important) - Number(a.important) || b.send_at.localeCompare(a.send_at))[0];
  if (!m) return null;
  const more = unread.length - 1;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
      <div key={m.id} role="alert" className={`pointer-events-auto w-full max-w-md animate-rise rounded-2xl border bg-card p-4 shadow-xl ${m.important ? "border-primary/60 ring-2 ring-primary/25" : "border-border"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${m.important ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {m.important ? <Megaphone className="size-5" /> : <BellRing className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold leading-snug">{m.title}</div>
            {m.body && <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{m.body}</p>}
            <div className="mt-1.5 text-xs text-muted-foreground">{m.sender_name ? `من ${m.sender_name}` : "رسالة"}{more > 0 ? ` · ${more} رسائل أخرى` : ""}</div>
          </div>
          <button aria-label="إخفاء" onClick={() => setHidden(true)} className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"><X className="size-4" /></button>
        </div>
        <Button className="mt-3 w-full" size="sm" variant={m.important ? "default" : "outline"} onClick={() => void done(m.id)}>تم</Button>
      </div>
    </div>
  );
}

/** APK updates: a full-screen step when mandatory, a small card when optional (see src/lib/updates.ts) */
function UpdateLayer() {
  const { state, applyNow, installApk, dismiss } = useAppUpdates();
  if (state.kind === "idle") return null;
  const mb = (n: number) => (n ? `${num(Math.round((n / 1024 / 1024) * 10) / 10)} م.ب` : "");
  const notes = "notes" in state ? state.notes : null;

  // full screen: mandatory, or something is in progress
  const full = state.kind === "web-applying" || state.kind === "apk-downloading" || (("mandatory" in state) && state.mandatory);
  if (full) {
    const percent = state.kind === "web-applying" || state.kind === "apk-downloading" ? state.percent : null;
    return (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-background p-6" role="dialog" aria-label="تحديث التطبيق">
        <div className="w-full max-w-sm animate-rise text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary"><Sparkles className="size-8" /></span>
          <h1 className="mt-5 text-fluid-xl font-bold">{percent !== null ? "يُحدَّث التطبيق" : "تحديث جديد مطلوب"}</h1>
          <p className="mt-2 text-muted-foreground">{percent !== null ? "لحظات ويعود التطبيق بالنسخة الجديدة." : notes || "حدّث التطبيق لتتابع استخدامه."}</p>
          {percent !== null ? (
            <div className="mt-6">
              <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(4, percent)}%` }} /></div>
              <p className="mt-2 text-sm tabular-nums text-muted-foreground">{num(percent)}٪</p>
            </div>
          ) : state.kind === "apk-error" ? (
            <>
              <p className="mt-4 text-sm text-destructive">تعذّر التحميل. تأكد من الاتصال ثم حاول مرة أخرى.</p>
              <Button className="mt-4 w-full" size="lg" onClick={() => void installApk()}><Download /> حاول مرة أخرى</Button>
            </>
          ) : state.kind === "apk" ? (
            <>
              <Button className="mt-6 w-full" size="lg" onClick={() => void installApk()}><Download /> حدّث الآن {mb(state.size) && `(${mb(state.size)})`}</Button>
              <p className="mt-3 text-xs text-muted-foreground">بعد التحميل سيطلب أندرويد تأكيد «تثبيت». في المرة الأولى قد يطلب السماح بالتثبيت من هذا التطبيق.</p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // optional: small card at the bottom
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[65] flex justify-center px-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}>
      <div role="status" className="pointer-events-auto w-full max-w-md animate-rise rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary"><Sparkles className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{state.kind === "web-ready" ? "تحديث جديد جاهز" : "إصدار جديد من التطبيق"}</div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notes || (state.kind === "web-ready" ? "يُطبَّق تلقائياً عند الفتح القادم، أو الآن." : "حمّله وثبّته متى شئت.")}</p>
          </div>
          <button aria-label="لاحقاً" onClick={dismiss} className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground"><X className="size-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" onClick={() => void (state.kind === "web-ready" ? applyNow() : installApk())}>{state.kind === "web-ready" ? "حدّث الآن" : <><Download /> تحميل {mb("size" in state ? state.size : 0)}</>}</Button>
          <Button size="sm" variant="outline" onClick={dismiss}>لاحقاً</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * overlay = imported (legacy) apps: the original page stays underneath, untouched; LockGate only adds its layers
 * (paused / locked screens on top, banners, updates). See src/forge-shell.tsx.
 */
export function LockGate({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
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
        {overlay ? children : <PullToRefresh>{children}</PullToRefresh>}
        {cloud.enabled && <MessageBanner />}
        <UpdateLayer />
        {import.meta.env.VITE_FORGE_STAGE === "test" && <TestBadge />}
        {cloud.enabled && <ActingBar />}
      </>
    );
  }
  if (state === "checking" && overlay) return null; // the original app shows its own loading
  if (state === "checking") return <div className="grid h-dvh place-items-center bg-background"><span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;

  if (state === "paused") {
    return (
      <div className={cn("grid min-h-dvh place-items-center bg-background p-6", overlay && "fixed inset-0 z-[100] overflow-y-auto")}>
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
    <div className={cn("grid min-h-dvh place-items-center bg-background p-6", overlay && "fixed inset-0 z-[100] overflow-y-auto")}>
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

/** the test copy Ahmed checks before «انشر التحديث»: same code, its own data — never confused with the real app */
/** Test copy marker. Inside Studio's preview Studio itself says «نسخة تجريبية», so nothing is drawn over the app there.
 *  Opened directly: a small corner tag that never covers the app's header (tap it for the full text). */
function TestBadge() {
  const inStudio = (() => { try { return new URLSearchParams(location.search).has("forge_preview") || window.top !== window; } catch { return true; } })();
  const [open, setOpen] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOpen(false), 3500); return () => clearTimeout(t); }, []);
  if (inStudio) return null;
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} aria-label="نسخة تجريبية ببيانات منفصلة"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] start-2 z-[60] inline-flex min-h-8 items-center gap-1.5 rounded-full bg-foreground/85 px-2.5 text-xs font-bold text-background shadow-md">
      <span className="size-2 shrink-0 rounded-full bg-warning" />{open && <span>نسخة تجريبية · بيانات منفصلة</span>}
    </button>
  );
}

/** Ahmed is looking at the app AS someone (Studio → الأشخاص → «ادخل كأنه هو»): always visible, one tap to leave, ends by itself. */
function ActingBar() {
  const [u, setU] = useState<CloudUser | null>(() => cloud.auth.user());
  const [failed, setFailed] = useState("");
  useEffect(() => cloud.auth.onChange((x) => { setU(x); if (actingError) setFailed(actingError); }), []);
  const until = u?.acting?.until;
  useEffect(() => {
    if (!until) return;
    const ms = Date.parse(until) - Date.now();
    const t = setTimeout(() => void cloud.auth.stopActing(), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [until]);
  if (failed && !until) {
    return (
      <div role="alert" className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-destructive px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg">
        <span className="min-w-0 flex-1">{failed}</span>
        <button type="button" aria-label="إغلاق" className="grid size-9 place-items-center rounded-full" onClick={() => setFailed("")}><X className="size-4" /></button>
      </div>
    );
  }
  if (!until) return null;
  const end = new Date(until).toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" });
  return <ActingChip name={u?.name || "هذا الشخص"} end={end} />;
}

/** a small chip, not a full-width bar: it never hides the app's own header; drag it anywhere and it stays there for the session */
const POS_KEY = "forge.acting.pos";
export function ActingChip({ name, end }: { name: string; end: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => { try { return JSON.parse(sessionStorage.getItem(POS_KEY) ?? "null"); } catch { return null; } });
  const down = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!drag.current || !r) return;
    const p = { x: Math.min(Math.max(4, e.clientX - drag.current.dx), window.innerWidth - r.width - 4), y: Math.min(Math.max(4, e.clientY - drag.current.dy), window.innerHeight - r.height - 4) };
    last.current = p; setPos(p);
  };
  const up = () => { drag.current = null; if (last.current) try { sessionStorage.setItem(POS_KEY, JSON.stringify(last.current)); } catch { /* */ } };
  return (
    <div
      ref={ref}
      role="status"
      title={`تتصفح كـ ${name} · ما تعدّله يُحفظ في حسابه · حتى ${end}`}
      style={pos ? { left: pos.x, top: pos.y } : { left: "50%", top: "calc(0.5rem + env(safe-area-inset-top))", transform: "translateX(-50%)" }}
      className="fixed z-[70] flex max-w-[calc(100vw-1rem)] items-center gap-0.5 rounded-full bg-destructive ps-1 pe-1.5 text-primary-foreground shadow-lg"
    >
      <button type="button" aria-label="اسحب لتحريك الشريط" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-full active:cursor-grabbing">
        <Eye className="size-4" />
      </button>
      <span className="min-w-0 max-w-[6.5rem] truncate text-sm font-semibold">كـ {name}</span>
      <button type="button" onClick={() => void cloud.auth.stopActing()} className="ms-1 min-h-9 shrink-0 rounded-full bg-primary-foreground/20 px-3 text-sm font-bold">خروج</button>
    </div>
  );
}
