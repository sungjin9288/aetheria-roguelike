# Aetheria RPG

A terminal-style fantasy RPG built with React + Vite.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Mobile App (PWA)

This project now supports installable mobile usage via PWA.

1. Build and deploy the app over HTTPS.
2. Open on mobile browser.
3. Use **Add to Home Screen** (Android) or **Share > Add to Home Screen** (iOS).

PWA assets:
- `public/manifest.webmanifest`
- `public/sw.js`
- `src/pwa/registerServiceWorker.js`

## Gameplay Notes

- Movement is now map-path based only.
- Direct jump to town has been removed.

## Useful PowerShell Tip

If numbered `Get-Content` commands hang due to quote collisions, use this safe form:

```powershell
$i=0; Get-Content README.md | ForEach-Object { $i++; "{0,4}: {1}" -f $i, $_ }
```
