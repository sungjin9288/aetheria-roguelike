import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const REQUIRED_FIREBASE_KEYS = ['apiKey', 'authDomain', 'projectId'];

const readInjectedConfig = () => {
    if (typeof window === 'undefined') return null;
    if (!window.__firebase_config || typeof window.__firebase_config !== 'object') return null;
    return window.__firebase_config;
};

const readEnvConfig = () => {
    const raw = import.meta.env.VITE_FIREBASE_CONFIG;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('[FIREBASE] Invalid VITE_FIREBASE_CONFIG JSON:', error);
        return null;
    }
};

const firebaseConfig = readInjectedConfig() || readEnvConfig() || {};
const hasFirebaseConfig = REQUIRED_FIREBASE_KEYS.every(
    (key) => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim().length > 0
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, hasFirebaseConfig };
