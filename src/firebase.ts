import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const REQUIRED_FIREBASE_KEYS: any = ['apiKey', 'authDomain', 'projectId'];

const readInjectedConfig = () => {
    if (typeof window === 'undefined') return null;
    if (!window.__firebase_config || typeof window.__firebase_config !== 'object') return null;
    return window.__firebase_config;
};

const readEnvConfig = () => {
    // 테스트 환경(plain Node/tsx, Vite 외부)에선 import.meta.env가 부재할 수 있음 — constants.ts 동일 가드 패턴.
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || ({} as ImportMetaEnv);
    const raw = env.VITE_FIREBASE_CONFIG;
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
    (key: any) => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim().length > 0
);

// hasFirebaseConfig가 false인 호출부는 항상 auth/db 사용 전에 가드하므로(useFirebaseSync.ts:78,
// GravePanel.tsx:33) config 부재 시 getAuth/getFirestore를 건너뛰어도 런타임 동작은 동일하다.
// 부재 상태에서 무조건 호출하면 invalid-api-key로 throw되어 테스트 환경(plain Node) import가 불가능했음.
const app = initializeApp(firebaseConfig);
const auth: any = hasFirebaseConfig ? getAuth(app) : null;
const db: any = hasFirebaseConfig ? getFirestore(app) : null;

// cycle 324: `app` export 제거 — src/ 어디에서도 import 0건. auth / db / hasFirebaseConfig만 active.
export { auth, db, hasFirebaseConfig };
