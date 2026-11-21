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

/** plays the tone once; silent (never throws) if the browser still blocks audio */
export function playNotify() {
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
    navigator.serviceWorker.addEventListener("message", (e) => { if ((e.data as { type?: string } | null)?.type === "forge-push") playNotify(); });
  }
}
