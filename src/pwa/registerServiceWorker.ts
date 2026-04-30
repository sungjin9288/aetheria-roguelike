import { Capacitor } from '@capacitor/core';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (Capacitor.isNativePlatform()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[PWA] Service worker registration failed:', error);
    });
  });
}
