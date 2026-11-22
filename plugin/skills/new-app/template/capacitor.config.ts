import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("./forge.config.json", "utf8"));
// brand color written by `npm run assets` — splash, window and web view share it, so launch is one continuous screen
const brand: string | undefined = existsSync("./.forge/brand.json") ? JSON.parse(readFileSync("./.forge/brand.json", "utf8")).splash : undefined;

const config: CapacitorConfig = {
  appId: cfg.appId,
  appName: cfg.shortName,
  webDir: "dist",
  android: { allowMixedContent: false, ...(brand ? { backgroundColor: brand } : {}) },
  ...(brand ? { backgroundColor: brand } : {}),
  plugins: {
    // live updates (src/lib/updates.ts): fully controlled by the app; no Capgo cloud, no telemetry; a new APK resets to its own files
    CapacitorUpdater: { autoUpdate: false, resetWhenUpdate: true, appReadyTimeout: 15000, autoDeleteFailed: true, autoDeletePrevious: true, statsUrl: "", updateUrl: "", channelUrl: "" },
    // the system splash (logo) stays until the first real screen is drawn, then fades straight into it (LockGate calls hide);
    // index.html shows no second logo inside the APK, so the logo never jumps in size or position
    SplashScreen: { launchShowDuration: 8000, launchAutoHide: true, launchFadeOutDuration: 250, androidScaleType: "CENTER_CROP", showSpinner: false, ...(brand ? { backgroundColor: brand } : {}) },
    LocalNotifications: { smallIcon: "ic_stat_notify", iconColor: "#000000" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
