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
import { initNotifySound, notify, playNotify } from "./sound";
export { notify };
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_FORGE_CLOUD_URL as string | undefined;
const KEY = import.meta.env.VITE_FORGE_CLOUD_KEY as string | undefined;
const APP = (import.meta.env.VITE_FORGE_APP_ID as string | undefined) ?? "local";

export type Scope = "private" | "app" | "shared" | "public"; // shared = every member can read AND edit (delete: owner/admins)
export type Message = { id: string; title: string; body: string; important: boolean; send_at: string; sender_name: string | null; target: "all" | "admins" | "user"; read: boolean };
export type NewMessage = { title: string; body?: string; important?: boolean; to?: "all" | "admins" | { user: string }; at?: Date | string; repeat?: "none" | "daily" | "weekly"; push?: boolean };
export type PushState = "unsupported" | "default" | "denied" | "on";
export type AppInfo = { locked: boolean; name: string; paused: boolean; message: string | null };
export type Row<T> = { id: string; data: T; owner: string | null; scope: Scope; createdAt: string; updatedAt: string };
export type Role = "owner" | "admin" | "user";
export type CloudUser = {
  id: string; email: string | null; name: string | null; anonymous: boolean; role: Role;
  /** set while Ahmed is looking at the app AS this person (Studio → الأشخاص → «ادخل كأنه هو»); ends by itself at `until` */
  acting?: { until: string } | null;
};

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
  const me: CloudUser = { id: u.id, email: u.email ?? null, name: (u.user_metadata?.name as string) ?? null, anonymous: !!u.is_anonymous, role };
  return (await actingAs()) ?? me;
}

// ---- «ادخل كأنه هو»: a one-time grant from Studio in ?forge_act=… → this device acts as that person for 30 minutes.
// The server decides everything (forge_uid() in the database); the app only learns who "me" is now.
const ACT = `forge-acting-${APP}`;
let claim: Promise<void> | null = null;
export let actingError = "";
async function actingAs(): Promise<CloudUser | null> {
  if (typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search);
  const token = q.get("forge_act");
  if (token) {
    claim ??= (async () => {
      q.delete("forge_act");
      history.replaceState(null, "", location.pathname + (q.toString() ? `?${q}` : "") + location.hash);
      const { error } = await sb().rpc("forge_act_claim", { a: APP, t: token });
      if (error) actingError = arabicError(error.message); else try { localStorage.setItem(ACT, "1"); } catch { /* */ }
    })();
  }
  if (claim) await claim;
  let flagged = false; try { flagged = localStorage.getItem(ACT) === "1"; } catch { /* */ }
  if (!flagged) return null;
  try {
    const { data } = await sb().rpc("forge_whoami", { a: APP });
    const w = data as { acting: boolean; id: string; name: string | null; email: string | null; role: Role; until: string | null } | null;
    if (!w?.acting) { localStorage.removeItem(ACT); return null; }
    return { id: w.id, email: w.email, name: w.name, anonymous: false, role: w.role, acting: { until: w.until! } };
  } catch { return null; }
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
/**
 * Robots (link previews in WhatsApp/Messenger/Telegram, crawlers, security scanners, headless browsers) open the published
 * link too. They must not become "visitors": no device account, no visit recorded.
 */
export const isRobot = typeof navigator !== "undefined" && (navigator.webdriver === true
  || /bot\b|bot\/|crawl|spider|slurp|headless|facebookexternalhit|facebot|meta-external|whatsapp|telegram|discord|skype|preview|lighthouse|pagespeed|google-|bingpreview|yandex|baidu|embedly|quora|pinterest|vkshare|w3c_validator|cloudflare|uptime|monitor|python-|curl\/|wget/i.test(navigator.userAgent));
/** what the person is running: "1.0.3" right after an APK, "1.0.3-a2" after the 2nd web update on top of it */
export const appLabel: string = (import.meta.env.VITE_FORGE_LABEL as string | undefined) || (import.meta.env.VITE_FORGE_STAGE === "test" ? "تجريبية" : "");

/** Inside Studio's preview (iframe / ?forge_preview=1) the device account is labelled so Ahmed can tell it apart. */
const inPreview = typeof window !== "undefined" && (new URLSearchParams(location.search).has("forge_preview") || (() => { try { return window.top !== window; } catch { return true; } })());

/**
 * One device account per browser, however many places ask at once (LockGate, app code, several tabs):
 * concurrent calls share one promise, and a cross-tab lock makes the second tab reuse the first tab's session.
 */
let anonFlight: Promise<void> | null = null;
async function ensureSession() {
  const { data } = await sb().auth.getSession();
  if (data.session) return;
  if (isRobot) throw new Error("robot: no device account");
  anonFlight ??= (async () => {
    const run = async () => {
      const again = await sb().auth.getSession();
      if (again.data.session) return;
      const { error } = await sb().auth.signInAnonymously(inPreview ? { options: { data: { name: "معاينة Studio" } } } : undefined);
      err(error);
    };
    if (typeof navigator !== "undefined" && navigator.locks?.request) await navigator.locks.request(`forge-anon-${APP}`, run);
    else await run();
  })().finally(() => { anonFlight = null; });
  await anonFlight;
}

const urlB64 = (s: string) => { const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
/** the Capacitor push plugin, only present in APKs built with Firebase (see android.yml) */
type NativePush = {
  checkPermissions(): Promise<{ receive: string }>; requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>; unregister(): Promise<void>; addListener(e: string, f: (x: never) => void): Promise<unknown>;
};
// boxed: awaiting a Capacitor proxy itself calls its `.then` on Android and throws (see updates.ts)
async function nativePush(): Promise<{ p: NativePush }> {
  const { registerPlugin } = await import("@capacitor/core");
  return { p: registerPlugin<NativePush>("PushNotifications") };
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
  if (!enabled || !name || current?.acting) return; // Ahmed looking as someone is not that person's activity
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
  if (tracking || !enabled || typeof window === "undefined" || isRobot) return;
  tracking = true;
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  const pwa = matchMedia?.("(display-mode: standalone)").matches;
  push("session", "open", { platform: native ? "apk" : pwa ? "pwa" : "web", w: innerWidth, h: innerHeight, lang: navigator.language, v: appLabel || undefined, ua: clip(navigator.userAgent, 160) });
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
      await ensureSession(); // never creates a second account on the same device
    },
    /**
     * Turn this device account into a real account (email + password) WITHOUT losing anything: same person, same data.
     * Then the person signs in with that email on another phone and is recognised as the same person.
     */
    async saveAccount(email: string, password: string, name?: string) {
      if (!enabled) return localSignIn(email, name);
      const { error } = await sb().auth.updateUser({ email, password, ...(name ? { data: { name } } : {}) }); err(error);
    },
    async signOut() {
      if (!enabled) { try { localStorage.removeItem(`${LK}-user`); } catch { /* */ } setUser(null); return; }
      await sb().auth.signOut();
    },
    /** leave «ادخل كأنه هو» (Studio): back to this device's own account */
    async stopActing() {
      try { localStorage.removeItem(ACT); } catch { /* */ }
      if (enabled) await sb().rpc("forge_act_end");
      location.reload();
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
      await ensureSession(); // SIGNED_IN → forge_touch
      void flush();
    } catch { /* offline: try next launch */ }
  },

  /**
   * Record a meaningful action for Studio's stats and the person's timeline: cloud.track("message_sent", { room: "family" }).
   * Name it in snake_case and give it an Arabic label in .forge/data.json → "events". Not for every click.
   */
  track(name: string, data: Record<string, unknown> = {}) { push("event", name, data); },

  /**
   * The app's settings from its panel (Studio → التشغيل → اللوحة): defaults from .forge/panel.json, changed by Ahmed
   * any time without a new build. Not for secrets (those never reach the app — use cloud.ask / cloud.call).
   */
  async config<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T> {
    if (!enabled) return {} as T;
    const CK = `forge-config-${APP}`;
    try {
      await ensureSession();
      const { data, error } = await sb().rpc("forge_config", { a: APP });
      err(error);
      try { localStorage.setItem(CK, JSON.stringify(data ?? {})); } catch { /* */ }
      return (data ?? {}) as T;
    } catch (e) {
      try { const c = localStorage.getItem(CK); if (c) return JSON.parse(c) as T; } catch { /* */ }
      throw e;
    }
  },

  /**
   * Use a service declared in the panel ("services") — its key stays on the server. Raw form: the provider's own
   * request body (Anthropic messages / OpenAI chat / Gemini generateContent), or { path, method, body } for "http".
   * Errors come back in Arabic (no key yet, daily limit reached, offline…) with e.code = "no_key" | "limit" | ….
   */
  async call<T = unknown>(service: string, req: { body?: unknown; path?: string; method?: string; model?: string } = {}): Promise<T> {
    if (!enabled) throw Object.assign(new Error("هذه الميزة تعمل في التطبيق المنشور فقط"), { code: "offline" });
    await ensureSession();
    const { data } = await sb().auth.getSession();
    let r: Response;
    try {
      r = await fetch(`${URL_}/functions/v1/forge-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: KEY!, Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ app: APP, service, ...req }),
      });
    } catch { throw Object.assign(new Error("لا يوجد اتصال بالإنترنت"), { code: "offline" }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = (j as { error?: string | { message?: string }; code?: string });
      const msg = typeof m.error === "string" ? m.error : m.error?.message ? `الخدمة ردّت: ${m.error.message}` : "تعذّر الاتصال بالخدمة";
      throw Object.assign(new Error(msg), { code: m.code ?? String(r.status) });
    }
    return j as T;
  },

  /**
   * The easy way to use an AI service from the panel: cloud.ask("ai", "اشرح …") or
   * cloud.ask("ai", { system, messages: [{ role: "user", content: "…" }], maxTokens, model }) → the reply text.
   * Works the same whether Ahmed set it up with Claude, OpenAI or Gemini.
   */
  async ask(service: string, q: string | { system?: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number; model?: string }): Promise<string> {
    const x = typeof q === "string" ? { messages: [{ role: "user" as const, content: q }] } : q;
    const r = await cloud.call<{ text?: string }>(service, { body: { ask: true, ...x } });
    return r.text ?? "";
  },
  /** for apps that don't use hash routes: report the current screen yourself */
  screen(name: string) { if (name !== lastScreen) { lastScreen = name; push("screen", name); } },

  /**
   * Messages from Ahmed (Studio) and the app's admins. Every app already shows unread ones as a banner (LockGate);
   * build an inbox screen with useMessages() if the app needs one. Admins send with cloud.messages.send().
   */
  messages: {
    async inbox(limit = 30): Promise<Message[]> {
      if (!enabled) return [];
      const { data } = await sb().auth.getSession();
      if (!data.session) return [];
      const r = await sb().rpc("forge_inbox", { a: APP, lim: limit }); err(r.error);
      return (r.data as Message[]) ?? [];
    },
    async markRead(id: string) {
      if (!enabled) return;
      const { error } = await sb().from("forge_message_reads").upsert({ message_id: id }, { onConflict: "message_id,user_id", ignoreDuplicates: true });
      if (error && !/duplicate/i.test(error.message)) err(error);
      window.dispatchEvent(new Event("forge:messages"));
    },
    /** admins only (Studio decides who is an admin): send now or later, once or every day/week */
    async send(m: NewMessage) {
      if (!enabled) throw new Error("الرسائل تحتاج Forge Cloud");
      const u = await sb().auth.getUser();
      const me = u.data.user;
      const to = m.to ?? "all";
      const { error } = await sb().from("forge_messages").insert({
        app_id: APP, title: m.title, body: m.body ?? "", important: !!m.important,
        target: typeof to === "string" ? to : "user", target_user: typeof to === "string" ? null : to.user,
        send_at: m.at ? new Date(m.at).toISOString() : new Date().toISOString(), repeat: m.repeat ?? "none", push: m.push ?? true,
        sender: me?.id, sender_name: (me?.user_metadata?.name as string) || me?.email || null,
      });
      err(error);
    },
  },

  /**
   * Phone notifications: messages from Studio/admins arrive even when the app is closed.
   * Web & installed web app: Web Push. APK: Firebase (when the factory set it up for this app).
   * Ask at a meaningful moment (LockGate already offers it after the first message); never on launch.
   */
  push: {
    native: () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(),
    supported(): boolean {
      if (!enabled || typeof window === "undefined") return false;
      if (cloud.push.native()) return import.meta.env.VITE_FORGE_PUSH_ANDROID === "1";
      return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    },
    async state(): Promise<PushState> {
      if (!cloud.push.supported()) return "unsupported";
      if (cloud.push.native()) {
        const P = (await nativePush()).p;
        const p = await P.checkPermissions();
        return p.receive === "granted" ? (localStorage.getItem(`forge-push-${APP}`) === "1" ? "on" : "default") : p.receive === "denied" ? "denied" : "default";
      }
      if (Notification.permission === "denied") return "denied";
      const reg = await navigator.serviceWorker.getRegistration("./forge-push/");
      return (await reg?.pushManager.getSubscription()) ? "on" : "default";
    },
    /** asks the system permission and registers this device; returns the new state */
    async enable(): Promise<PushState> {
      if (!cloud.push.supported()) return "unsupported";
      await ensureSession();
      if (cloud.push.native()) {
        const P = (await nativePush()).p;
        const perm = await P.requestPermissions();
        if (perm.receive !== "granted") return "denied";
        const token = await new Promise<string>((resolve, reject) => {
          void P.addListener("registration", (t: { value: string }) => resolve(t.value));
          void P.addListener("registrationError", (e: { error: string }) => reject(new Error(e.error)));
          void P.register();
          setTimeout(() => reject(new Error("تعذّر تفعيل الإشعارات")), 20000);
        });
        const r = await sb().rpc("forge_push_register", { a: APP, k: "fcm", ep: token, ks: {} }); err(r.error);
        localStorage.setItem(`forge-push-${APP}`, "1");
        return "on";
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return perm === "denied" ? "denied" : "default";
      const reg = await navigator.serviceWorker.register("./forge-sw.js", { scope: "./forge-push/" });
      // (not serviceWorker.ready: that waits for a worker controlling this page, and ours only lives in ./forge-push/)
      const sw = reg.installing ?? reg.waiting ?? reg.active;
      if (sw && sw.state !== "activated") await new Promise<void>((res) => { sw.addEventListener("statechange", () => { if (sw.state === "activated") res(); }); setTimeout(res, 8000); });
      const res = await fetch(`${URL_}/functions/v1/forge-push?vapid=1`);
      const { publicKey } = await res.json();
      let sub: PushSubscription;
      try { sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(publicKey) }); }
      catch { throw new Error("هذا المتصفح لا يسمح بالإشعارات الآن. جرّب Chrome أو ثبّت التطبيق على الشاشة الرئيسية."); }
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await sb().rpc("forge_push_register", { a: APP, k: "web", ep: j.endpoint, ks: j.keys }); err(r.error);
      return "on";
    },
    async disable() {
      if (!enabled) return;
      if (cloud.push.native()) { localStorage.removeItem(`forge-push-${APP}`); await (await nativePush()).p.unregister().catch(() => {}); return; }
      const reg = await navigator.serviceWorker.getRegistration("./forge-push/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await sb().from("forge_push_subs").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
    },
  },

  /** App lock (set in Studio → الخصوصية) */
  lock: {
    /** lock code + pause state (both set in Studio → التشغيل → الخصوصية) */
    async info(): Promise<AppInfo> {
      if (!enabled) return { locked: false, name: "", paused: false, message: null };
      const { data } = await sb().rpc("forge_app_info", { a: APP });
      return { locked: false, name: "", paused: false, message: null, ...((data as Partial<AppInfo>) ?? {}) };
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

/** the app's panel settings (see cloud.config): { config, loading, error, reload } — refreshed when the app comes back */
export function useConfig<T extends Record<string, unknown> = Record<string, unknown>>(defaults: Partial<T> = {}) {
  const [config, setConfig] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setError(null); setConfig(await cloud.config<T>()); } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التحميل"); setConfig((c) => c ?? ({} as T)); }
  }, []);
  useEffect(() => {
    void reload();
    const vis = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [reload]);
  return { config: { ...defaults, ...(config ?? {}) } as T, loading: config === null, error, reload };
}

/** phone-notification state for a settings switch: { state, enable, disable } */
export function usePush() {
  const [state, setState] = useState<PushState | "loading">("loading");
  useEffect(() => { void cloud.push.state().then(setState).catch(() => setState("unsupported")); }, []);
  return {
    state,
    enable: async () => { try { setState(await cloud.push.enable()); } catch (e) { setState("default"); throw e; } },
    disable: async () => { await cloud.push.disable(); setState("default"); },
  };
}

/** the signed-in person's messages (newest first), refreshed every minute and when the app comes back */
export function useMessages() {
  const [messages, setMessages] = useState<Message[] | null>(enabled ? null : []);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const reload = useCallback(async () => {
    try {
      setError(null);
      const list = await cloud.messages.inbox();
      const ids = new Set(list.filter((m) => !m.read).map((m) => m.id));
      const fresh = seen.current ? list.find((m) => !m.read && !seen.current!.has(m.id)) : undefined;
      if (fresh && document.visibilityState === "visible") playNotify(fresh.title, fresh.body);
      seen.current = ids;
      setMessages(list);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التحميل"); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void reload();
    const t = setInterval(() => void reload(), 60_000);
    const vis = () => { if (document.visibilityState === "visible") void reload(); };
    const off = cloud.auth.onChange(() => void reload());
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("forge:messages", reload);
    return () => { clearInterval(t); off(); document.removeEventListener("visibilitychange", vis); window.removeEventListener("forge:messages", reload); };
  }, [reload]);
  const markRead = useCallback(async (id: string) => {
    setMessages((l) => l?.map((m) => (m.id === id ? { ...m, read: true } : m)) ?? l);
    await cloud.messages.markRead(id).catch(() => {});
  }, []);
  return { messages, unread: (messages ?? []).filter((m) => !m.read), loading: messages === null, error, reload, markRead };
}

// notification tone: native channel + play while the app is open (see sound.ts)
if (typeof window !== "undefined") void initNotifySound(nativePush);
