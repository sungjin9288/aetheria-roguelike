import {
  allowsServiceWorker,
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from '../platform/runtimeEnvironment';

export function registerServiceWorker(environment: RuntimeEnvironment = getRuntimeEnvironment()) {
  if (!('serviceWorker' in navigator)) return;
  if (!allowsServiceWorker(environment)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('[PWA] Service worker registration failed:', error);
    });
  });
}
