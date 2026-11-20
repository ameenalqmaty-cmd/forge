interface ImportMetaEnv {
  readonly VITE_FORGE_CLOUD_URL?: string;
  readonly VITE_FORGE_CLOUD_KEY?: string;
  readonly VITE_FORGE_APP_ID?: string;
  /** "1" in APKs built with Firebase (android.yml) — phone notifications available */
  readonly VITE_FORGE_PUSH_ANDROID?: string;
}
