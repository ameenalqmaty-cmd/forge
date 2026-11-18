import type { CapacitorConfig } from "@capacitor/cli";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("./forge.config.json", "utf8"));

const config: CapacitorConfig = {
  appId: cfg.appId,
  appName: cfg.shortName,
  webDir: "dist",
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 900, launchAutoHide: true, androidScaleType: "CENTER_CROP", showSpinner: false },
    LocalNotifications: { smallIcon: "ic_stat_notify", iconColor: "#000000" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
