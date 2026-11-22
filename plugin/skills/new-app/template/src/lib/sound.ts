// The notification tone: the same file the APK uses for its notification channel (public/sounds/notify.wav → res/raw/notify.wav).
// Browsers can't play sound from a push itself, so while the app is open (web, PWA, or the Studio preview) we play it ourselves
// when a notification or a new message arrives. Browsers allow it only after the person has touched the page once.
let audio: HTMLAudioElement | null = null;
let unlocked = false;

function el() {
  if (!audio && typeof Audio !== "undefined") { audio = new Audio(new URL("./sounds/notify.wav", document.baseURI).href); audio.preload = "auto"; }
  return audio;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    removeEventListener("pointerdown", unlock); removeEventListener("keydown", unlock);
    const a = el();
    if (a) { a.muted = true; void a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); }
  };
  addEventListener("pointerdown", unlock, { passive: true });
  addEventListener("keydown", unlock);
}

/** inside Studio's preview (iframe): Studio draws the notification like Android would, with this app's tone */
const inStudio = typeof window !== "undefined" && (() => { try { return window.top !== window; } catch { return true; } })();
function toStudio(title: string, body: string) {
  try { window.parent.postMessage({ type: "forge-notify", title, body }, "*"); return true; } catch { return false; }
}

/**
 * Show a notification to the person, the same way everywhere:
 * - Studio preview → an Android-style banner on top of the phone frame + the app's tone (browsers can't show real ones there)
 * - APK / web with permission → a real system notification (web) + the tone while the app is open
 * Use it for reminders and updates the app itself raises (a new message, a turn, a reminder) — not for every toast.
 */
export async function notify(title: string, body = "") {
  if (inStudio && toStudio(title, body)) return;
  playNotify();
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration("./forge-push/") ?? await navigator.serviceWorker.getRegistration();
      const icon = new URL("./icons/icon-192.png", document.baseURI).href;
      if (reg) await reg.showNotification(title, { body, icon, badge: new URL("./icons/badge-96.png", document.baseURI).href, tag: `forge-${Date.now()}` });
      else new Notification(title, { body, icon });
    }
  } catch { /* the tone was played; nothing else to do */ }
}

/** plays the tone once; silent (never throws) if the browser still blocks audio. In Studio's preview the banner plays it. */
export function playNotify(title?: string, body?: string) {
  if (inStudio && title && toStudio(title, body ?? "")) return;
  try { const a = el(); if (!a) return; a.currentTime = 0; void a.play().catch(() => {}); } catch { /* ignore */ }
}

/** native APK: the channel Android uses for every Forge notification (custom tone, high importance) + play when one arrives while the app is open */
export async function initNotifySound(nativePush: () => Promise<{ p: { addListener(e: string, f: (x: never) => void): Promise<unknown> } }>) {
  if (typeof window === "undefined") return;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    try {
      const P = (await nativePush()).p as unknown as { createChannel?: (c: object) => Promise<void>; addListener: (e: string, f: () => void) => Promise<unknown> };
      await P.createChannel?.({ id: "forge-default", name: "التنبيهات", description: "تنبيهات التطبيق", importance: 5, sound: "notify", vibration: true, visibility: 1 }).catch(() => {});
      void P.addListener("pushNotificationReceived", playNotify);
    } catch { /* plugin missing (APK built without Firebase): nothing to set up */ }
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => { const d = e.data as { type?: string; title?: string; body?: string } | null; if (d?.type === "forge-push") playNotify(d.title, d.body); });
  }
}
