import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { cloud } from "@/lib/cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * App lock (Forge Studio → الخصوصية): when the owner sets a code, visitors must enter it once per device.
 * Wraps the whole app in main.tsx. Does nothing when the app is not locked or not on Forge Cloud.
 */
const KEY = `forge-unlocked-${cloud.appId}`;

export function LockGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "open" | "locked">(() => {
    if (!cloud.enabled) return "open";
    try { return localStorage.getItem(KEY) === "1" ? "open" : "checking"; } catch { return "checking"; }
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void cloud.presence(); }, []);

  useEffect(() => {
    if (state !== "checking") return;
    cloud.lock.info().then((i) => { setName(i.name); setState(i.locked ? "locked" : "open"); }).catch(() => setState("open"));
  }, [state]);

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <div className="grid h-dvh place-items-center bg-background"><span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;

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
        <h1 className="mt-5 text-fluid-xl font-bold">{name || "تطبيق خاص"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">هذا التطبيق مقفل. أدخل الرمز الذي أعطاك إياه صاحبه.</p>
        <Input className="mt-6 text-center tracking-[0.3em]" dir="ltr" inputMode="numeric" autoFocus value={code} onChange={(e) => setCode(e.target.value)} aria-label="رمز الدخول" placeholder="••••" />
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <Button className="mt-4 w-full" size="lg" disabled={busy || !code.trim()}>{busy ? "يتحقق…" : "دخول"}</Button>
      </form>
    </div>
  );
}
