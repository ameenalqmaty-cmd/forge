# App assets

- `icon-foreground.svg` — **required**. The mark only, white or single-color, transparent background, inside the central 66%.
- `icon.svg` — optional. A full custom icon (with its own background). If missing, the icon = foreground on the theme's primary gradient.
- `notification.svg` — optional. Single-color silhouette for Android notifications. If missing, derived from the foreground.

Run `npm run assets` → generates every size for PWA, favicon, Android launcher (adaptive + round + monochrome), notification icon and splash. Colors come from the theme in `forge.config.json`.
