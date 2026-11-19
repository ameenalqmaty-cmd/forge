import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, PauseCircle } from "lucide-react";
import { cloud, type AppInfo } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Wraps the whole app in main.tsx. Controlled from Forge Studio → التشغيل → الخصوصية:
 * - App lock: visitors enter a code once per device.
 * - Pause: everyone sees the owner's message instead of the app (owner and app admins still get in).
 * Checks again every minute and when the app comes back to the foreground. Does nothing without Forge Cloud.
 * Forge-managed file: do not edit (the factory refreshes it).
 */
const KEY = `forge-unlocked-${cloud.appId}`;
type State = "checking" | "open" | "locked" | "paused";

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

export function LockGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => (!cloud.enabled ? "open" : isUnlocked() ? "open" : "checking"));
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [adminView, setAdminView] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => { void cloud.presence(); return () => { alive.current = false; }; }, []);

  const check = useCallback(async () => {
    if (!cloud.enabled) return;
    let i: AppInfo;
    try { i = await cloud.lock.info(); } catch { setState((s) => (s === "checking" ? "open" : s)); return; }
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
        {children}
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
