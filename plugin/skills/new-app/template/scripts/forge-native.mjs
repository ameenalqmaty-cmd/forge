// Prints the "native fingerprint" of this app: everything that only a new APK can change (Capacitor plugins and their
// versions, Capacitor config, app id/name, icon, splash color, Firebase file). Web updates are only offered to APKs with
// the same fingerprint; a different fingerprint means "install the new APK". Forge-managed file: do not edit.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const pkg = JSON.parse(read("package.json") || "{}");
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
// plugins android.yml adds on the build machine are left out, so the factory (without them) computes the same value
const CI_ADDED = new Set(["@capgo/capacitor-updater", "@capacitor/filesystem", "@capawesome-team/capacitor-file-opener", "@capacitor/push-notifications"]);
const nativeDeps = Object.keys(deps).filter((d) => /^@capacitor\/|^@capgo\/|^@capawesome|capacitor-/.test(d) && !CI_ADDED.has(d)).sort().map((d) => `${d}@${deps[d]}`);
const cfg = JSON.parse(read("forge.config.json") || "{}");
const parts = [
  nativeDeps.join(","),
  read("capacitor.config.ts"),
  [cfg.appId, cfg.name, cfg.shortName].join("|"),
  read("assets/icon-foreground.svg"),
  read("assets/icon.png") ? createHash("sha256").update(readFileSync("assets/icon.png")).digest("hex") : "",
  read(".forge/brand.json"),
  existsSync(".forge/google-services.json") ? "push" : "",
  "updater-1",
  // bump this number whenever android.yml changes what the APK itself does (MainActivity patch, manifest entries,
  // notification channel/tone, native resources): installed APKs then see "install the new APK" after the next publish
  "android-2",
  process.env.FORGE_NATIVE_EXTRA ?? "",
];
process.stdout.write("n" + createHash("sha256").update(parts.join("\n§\n")).digest("hex").slice(0, 16));
