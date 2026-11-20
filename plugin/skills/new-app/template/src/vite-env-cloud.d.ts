interface ImportMetaEnv {
  readonly VITE_FORGE_CLOUD_URL?: string;
  readonly VITE_FORGE_CLOUD_KEY?: string;
  readonly VITE_FORGE_APP_ID?: string;
  /** "1" in APKs built with Firebase (android.yml) — phone notifications available */
  readonly VITE_FORGE_PUSH_ANDROID?: string;
  /** set by android.yml: "1" when the APK carries the updater; versions are UTC yyyymmddhhmmss */
  readonly VITE_FORGE_UPDATER?: string;
  /** "test" = the test copy (own data, badge); unset = the real app */
  readonly VITE_FORGE_STAGE?: string;
  readonly VITE_FORGE_NATIVE?: string;
  readonly VITE_FORGE_WEB_VERSION?: string;
  readonly VITE_FORGE_APK_VERSION?: string;
}
