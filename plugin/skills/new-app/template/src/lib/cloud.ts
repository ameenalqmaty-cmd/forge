/**
 * Forge Cloud — the shared backend of every Forge app (one Supabase project, each app's data kept apart).
 * Use this for anything that must be saved across devices or shared between users: accounts, lists, messages…
 * Do NOT create another Supabase project or table for an app; do NOT put keys in the code.
 *
 * The factory injects VITE_FORGE_CLOUD_URL / VITE_FORGE_CLOUD_KEY / VITE_FORGE_APP_ID at build time.
 * Without them (local dev, QA, demos) everything still works on this device only (localStorage).
 *
 *   const notes = cloud.collection<Note>("notes");
 *   await notes.add({ title: "…" });                       // private to the signed-in user (default)
 *   await notes.add({ title: "…" }, { scope: "app" });     // visible to every member of this app
 *   const rows = await notes.list();                       // newest first; rows the user may read
 *   const { rows, loading } = useCollection<Note>("notes") // React, live updates
 *
 * Scopes: "private" (owner + app admins) · "app" (all signed-in members) · "public" (anyone, even signed out).
 * Writing needs a signed-in user: cloud.auth.signInAnon() for a device account, or signUp/signIn with email.
 * App admins (set in Forge Studio → التشغيل → الأشخاص) can read and edit every row of the app.
 */
import { useEffect, useState } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_FORGE_CLOUD_URL as string | undefined;
const KEY = import.meta.env.VITE_FORGE_CLOUD_KEY as string | undefined;
const APP = (import.meta.env.VITE_FORGE_APP_ID as string | undefined) ?? "local";

export type Scope = "private" | "app" | "public";
export type Row<T> = { id: string; data: T; owner: string | null; scope: Scope; createdAt: string; updatedAt: string };
export type Role = "owner" | "admin" | "user";
export type CloudUser = { id: string; email: string | null; name: string | null; anonymous: boolean; role: Role };

let client: SupabaseClient | null = null;
const sb = () => (client ??= createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: `forge-${APP}` } }));

// ---------------------------------------------------------------- local fallback (no cloud configured)
const LK = `forge-local-${APP}`;
type LocalRow = Row<unknown> & { collection: string };
const localAll = (): LocalRow[] => { try { return JSON.parse(localStorage.getItem(LK) || "[]"); } catch { return []; } };
const localSave = (rows: LocalRow[]) => { try { localStorage.setItem(LK, JSON.stringify(rows)); } catch { /* full or blocked */ } };
const listeners = new Set<() => void>();
const emitLocal = () => listeners.forEach((f) => f());
const uid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

type DbRow = { doc_id: string; data: unknown; owner: string | null; scope: Scope; created_at: string; updated_at: string };
const fromDb = <T,>(r: DbRow): Row<T> => ({ id: r.doc_id, data: r.data as T, owner: r.owner, scope: r.scope, createdAt: r.created_at, updatedAt: r.updated_at });

// ---------------------------------------------------------------- auth
let current: CloudUser | null = null;
const authSubs = new Set<(u: CloudUser | null) => void>();

async function toCloudUser(u: User | null | undefined): Promise<CloudUser | null> {
  if (!u) return null;
  // registers the user as a member of this app (and refreshes "last seen"); returns their role
  let role: Role = "user";
  try {
    const { data } = await sb().rpc("forge_touch", { a: APP, p_email: u.email ?? null, p_name: (u.user_metadata?.name as string) ?? null });
    if (data) role = data as Role;
  } catch { /* offline: keep user */ }
  return { id: u.id, email: u.email ?? null, name: (u.user_metadata?.name as string) ?? null, anonymous: !!u.is_anonymous, role };
}
function setUser(u: CloudUser | null) { current = u; authSubs.forEach((f) => f(u)); }

let started = false;
function startAuth() {
  if (started) return;
  started = true;
  if (!enabled) {
    try { const raw = localStorage.getItem(`${LK}-user`); current = raw ? JSON.parse(raw) : null; } catch { current = null; }
    return;
  }
  sb().auth.getSession().then(async ({ data }) => setUser(await toCloudUser(data.session?.user)));
  sb().auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void toCloudUser(session?.user).then(setUser);
  });
}
const err = (e: { message?: string } | null) => { if (e) throw new Error(arabicError(e.message ?? "")); };
function arabicError(m: string) {
  if (/Invalid login credentials/i.test(m)) return "البريد أو كلمة المرور غير صحيحة";
  if (/already registered|already exists/i.test(m)) return "هذا البريد مسجّل من قبل، سجّل الدخول بدلاً من ذلك";
  if (/Password should be at least/i.test(m)) return "كلمة المرور قصيرة، استعمل ٦ أحرف على الأقل";
  if (/Anonymous sign-ins are disabled/i.test(m)) return "الدخول بدون حساب غير مفعّل لهذا التطبيق";
  if (/Failed to fetch|NetworkError/i.test(m)) return "لا يوجد اتصال بالإنترنت";
  return m || "حدث خطأ غير متوقع";
}

const enabled = !!(URL_ && KEY);

// ---------------------------------------------------------------- activity (Studio → التشغيل → الإحصاءات)
// Sessions, screens and errors are recorded automatically once presence() runs; apps add key actions with cloud.track().
type Ev = { kind: "session" | "screen" | "event" | "error"; name: string; data: Record<string, unknown>; at: string };
const queue: Ev[] = [];
let flushing = false;
let errorCount = 0;
let lastScreen = "";
const clip = (v: string, n: number) => (v.length > n ? v.slice(0, n) : v);
function push(kind: Ev["kind"], name: string, data: Record<string, unknown> = {}) {
  if (!enabled || !name) return;
  queue.push({ kind, name: clip(String(name), 150), data, at: new Date().toISOString() });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
}
async function flush() {
  if (!enabled || flushing || !queue.length) return;
  flushing = true;
  try {
    const { data } = await sb().auth.getSession();
    if (!data.session) return; // not signed in yet: keep the queue
    const batch = queue.splice(0, 50);
    const { error } = await sb().from("forge_events").insert(batch.map((e) => ({ app_id: APP, ...e })));
    if (error) queue.unshift(...batch.filter((e) => Date.now() - Date.parse(e.at) < 20 * 3600e3));
  } catch { /* offline: next tick */ } finally { flushing = false; }
}
/** "#student/8f3a…?tab=1" → "student/:id" so the same screen is counted together */
function screenOf(hash: string) {
  const path = hash.replace(/^#\/?/, "").split("?")[0] || "home";
  return path.split("/").map((seg) => (/^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg) || seg.length > 24 ? ":id" : seg)).join("/");
}
function recordScreen() {
  const s = screenOf(location.hash);
  if (s !== lastScreen) { lastScreen = s; push("screen", s); }
}
let tracking = false;
function startTracking() {
  if (tracking || !enabled || typeof window === "undefined") return;
  tracking = true;
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const pwa = matchMedia?.("(display-mode: standalone)").matches;
  push("session", "open", { platform: native ? "apk" : pwa ? "pwa" : "web", w: innerWidth, h: innerHeight, lang: navigator.language });
  recordScreen();
  addEventListener("hashchange", recordScreen);
  addEventListener("error", (e) => {
    if (++errorCount > 20) return;
    push("error", (e as ErrorEvent).message || "خطأ غير معروف", { stack: clip(String((e as ErrorEvent).error?.stack ?? ""), 1500), screen: lastScreen, src: (e as ErrorEvent).filename ?? "" });
  });
  addEventListener("unhandledrejection", (e) => {
    if (++errorCount > 20) return;
    const r = (e as PromiseRejectionEvent).reason;
    push("error", r instanceof Error ? r.message : clip(String(r ?? "Promise rejected"), 150), { stack: clip(String(r?.stack ?? ""), 1500), screen: lastScreen });
  });
  setInterval(() => void flush(), 5000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
}

export const cloud = {
  /** true when the app is connected to Forge Cloud (otherwise data stays on this device) */
  enabled,
  appId: APP,
  auth: {
    user: () => { startAuth(); return current; },
    onChange(cb: (u: CloudUser | null) => void) { startAuth(); authSubs.add(cb); return () => { authSubs.delete(cb); }; },
    async signUp(email: string, password: string, name?: string) {
      if (!enabled) return localSignIn(email, name);
      const { error } = await sb().auth.signUp({ email, password, options: { data: { name } } }); err(error);
    },
    async signIn(email: string, password: string) {
      if (!enabled) return localSignIn(email);
      const { error } = await sb().auth.signInWithPassword({ email, password }); err(error);
    },
    /** a device account without email (if allowed by the project); good default for simple apps */
    async signInAnon() {
      if (!enabled) return localSignIn(null);
      const { error } = await sb().auth.signInAnonymously(); err(error);
    },
    async signOut() {
      if (!enabled) { try { localStorage.removeItem(`${LK}-user`); } catch { /* */ } setUser(null); return; }
      await sb().auth.signOut();
    },
    async updateName(name: string) {
      if (!enabled) { if (current) { current = { ...current, name }; localStorage.setItem(`${LK}-user`, JSON.stringify(current)); setUser(current); } return; }
      const { error } = await sb().auth.updateUser({ data: { name } }); err(error);
    },
  },

  collection<T = Record<string, unknown>>(name: string) {
    return {
      async list(opts: { scope?: Scope; mine?: boolean; limit?: number } = {}): Promise<Row<T>[]> {
        if (!enabled) {
          return localAll().filter((r) => r.collection === name && (!opts.scope || r.scope === opts.scope)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, opts.limit ?? 500) as Row<T>[];
        }
        let q = sb().from("forge_rows").select("doc_id,data,owner,scope,created_at,updated_at").eq("app_id", APP).eq("collection", name).order("created_at", { ascending: false }).limit(opts.limit ?? 500);
        if (opts.scope) q = q.eq("scope", opts.scope);
        if (opts.mine && current) q = q.eq("owner", current.id);
        const { data, error } = await q; err(error);
        return (data as DbRow[]).map(fromDb<T>);
      },
      async get(id: string): Promise<Row<T> | null> {
        if (!enabled) return (localAll().find((r) => r.collection === name && r.id === id) as Row<T>) ?? null;
        const { data, error } = await sb().from("forge_rows").select("doc_id,data,owner,scope,created_at,updated_at").eq("app_id", APP).eq("collection", name).eq("doc_id", id).maybeSingle(); err(error);
        return data ? fromDb<T>(data as DbRow) : null;
      },
      /** create or replace the row with this id */
      async set(id: string, data: T, opts: { scope?: Scope } = {}): Promise<Row<T>> {
        const now = new Date().toISOString();
        if (!enabled) {
          const all = localAll(); const i = all.findIndex((r) => r.collection === name && r.id === id);
          const row: LocalRow = { id, data, owner: current?.id ?? "me", scope: opts.scope ?? all[i]?.scope ?? "private", createdAt: all[i]?.createdAt ?? now, updatedAt: now, collection: name };
          if (i >= 0) all[i] = row; else all.push(row);
          localSave(all); emitLocal(); return row as Row<T>;
        }
        const { data: r, error } = await sb().from("forge_rows")
          .upsert({ app_id: APP, collection: name, doc_id: id, data, ...(opts.scope ? { scope: opts.scope } : {}) }, { onConflict: "app_id,collection,doc_id" })
          .select("doc_id,data,owner,scope,created_at,updated_at").single(); err(error);
        return fromDb<T>(r as DbRow);
      },
      add(data: T, opts: { scope?: Scope } = {}) { return this.set(uid(), data, opts); },
      async update(id: string, patch: Partial<T>): Promise<Row<T>> {
        const cur = await this.get(id);
        if (!cur) throw new Error("العنصر غير موجود");
        return this.set(id, { ...cur.data, ...patch } as T);
      },
      async remove(id: string) {
        if (!enabled) { localSave(localAll().filter((r) => !(r.collection === name && r.id === id))); emitLocal(); return; }
        const { error } = await sb().from("forge_rows").delete().eq("app_id", APP).eq("collection", name).eq("doc_id", id); err(error);
      },
      /** calls back on any change in this collection (insert/update/delete) */
      subscribe(cb: () => void) {
        if (!enabled) { listeners.add(cb); return () => { listeners.delete(cb); }; }
        const ch = sb().channel(`forge-${APP}-${name}-${uid()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "forge_rows", filter: `app_id=eq.${APP}` }, (p) => {
            const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { collection?: string };
            if (!row.collection || row.collection === name) cb();
          }).subscribe();
        return () => { void sb().removeChannel(ch); };
      },
    };
  },

  /**
   * Called once on launch by LockGate (main.tsx). Makes sure this device has a session — a silent device
   * account if nobody is signed in — and records the visit, so Studio → التشغيل shows users and activity
   * for every app. Apps with email sign-in: treat `user.anonymous` as "not signed in yet".
   */
  async presence() {
    if (!enabled) return;
    startTracking();
    try {
      startAuth(); // an existing session is recorded (forge_touch) by startAuth
      const { data } = await sb().auth.getSession();
      if (!data.session) await sb().auth.signInAnonymously(); // SIGNED_IN → forge_touch
      void flush();
    } catch { /* offline: try next launch */ }
  },

  /**
   * Record a meaningful action for Studio's stats and the person's timeline: cloud.track("message_sent", { room: "family" }).
   * Name it in snake_case and give it an Arabic label in .forge/data.json → "events". Not for every click.
   */
  track(name: string, data: Record<string, unknown> = {}) { push("event", name, data); },
  /** for apps that don't use hash routes: report the current screen yourself */
  screen(name: string) { if (name !== lastScreen) { lastScreen = name; push("screen", name); } },

  /** App lock (set in Studio → الخصوصية) */
  lock: {
    async info(): Promise<{ locked: boolean; name: string }> {
      if (!enabled) return { locked: false, name: "" };
      const { data } = await sb().rpc("forge_app_info", { a: APP });
      return (data as { locked: boolean; name: string }) ?? { locked: false, name: "" };
    },
    async check(code: string): Promise<boolean> {
      if (!enabled) return true;
      const { data, error } = await sb().rpc("forge_check_lock", { a: APP, code }); err(error);
      return !!data;
    },
  },
};

function localSignIn(email: string | null, name?: string) {
  const u: CloudUser = { id: "me", email, name: name ?? null, anonymous: !email, role: "owner" };
  try { localStorage.setItem(`${LK}-user`, JSON.stringify(u)); } catch { /* */ }
  setUser(u);
}

// ---------------------------------------------------------------- React hooks
export function useCloudUser() {
  const [u, setU] = useState<CloudUser | null>(() => cloud.auth.user());
  const [ready, setReady] = useState(!enabled);
  useEffect(() => cloud.auth.onChange((x) => { setU(x); setReady(true); }), []);
  useEffect(() => { if (!enabled) return; const t = setTimeout(() => setReady(true), 2500); return () => clearTimeout(t); }, []);
  return { user: u, ready };
}

/** Rows of a collection with loading / error state, kept live. */
export function useCollection<T = Record<string, unknown>>(name: string, opts: { scope?: Scope; mine?: boolean; limit?: number } = {}) {
  const [rows, setRows] = useState<Row<T>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);
  useEffect(() => {
    let off = false;
    const col = cloud.collection<T>(name);
    const load = () => col.list(opts).then((r) => { if (!off) { setRows(r); setError(null); } }).catch((e: Error) => { if (!off) setError(e.message); });
    void load();
    const unsub = col.subscribe(load);
    return () => { off = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key]);
  return { rows: rows ?? [], loading: rows === null && !error, error, reload: () => cloud.collection<T>(name).list(opts).then(setRows) };
}
