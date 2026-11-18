# Signing

- `debug.keystore` — standard Android debug key (password `android`). CI copies it to `~/.android/debug.keystore` so **every build is signed with the same key** → a new APK installs as an update over the old one, keeping the app's data. Fine for personal / direct-install apps. Not secret.
- **Google Play** needs a private release key. Create one once (`keytool -genkeypair -keystore release.keystore -alias release ...`), never commit it, and add these repository secrets:
  `ANDROID_KEYSTORE_BASE64` (base64 of the file), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  The workflow then also builds a signed release APK + AAB (the file Google Play wants).
