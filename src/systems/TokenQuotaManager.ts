import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages.js';

// 시그니처는 firebase/firestore 의 실제 함수에서 `typeof` 로 가져온다 — 테스트가
// 주입하는 모킹 구현도 이 형태만 만족하면 된다(createCloudAutosave.ts와 같은 패턴).
type FirestoreOperations = {
    doc?: typeof doc;
    setDoc?: typeof setDoc;
    serverTimestamp?: typeof serverTimestamp;
};

// --- TOKEN QUOTA MANAGER (v3.6) ---
// Limits AI calls per user per day to control costs
export const TokenQuotaManager = {
    get DAILY_LIMIT() { return BALANCE.DAILY_AI_LIMIT; },
    QUOTA_KEY: 'aetheria_ai_quota',

    getQuotaData() {
        const stored = localStorage.getItem(this.QUOTA_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Reset if new day
            const today = new Date().toDateString();
            if (data.date !== today) {
                return { date: today, used: 0 };
            }
            return data;
        }
        return { date: new Date().toDateString(), used: 0 };
    },

    canMakeAICall() {
        const quota = this.getQuotaData();
        return quota.used < this.DAILY_LIMIT;
    },

    // cycle 326: getRemainingCalls 메서드 제거 — 외부/내부 호출 0건이던 dead method.

    recordCall() {
        const quota = this.getQuotaData();
        quota.used++;
        localStorage.setItem(this.QUOTA_KEY, JSON.stringify(quota));
    },

    getExhaustedMessage() {
        return MSG.AI_QUOTA_EXHAUSTED;
    },

    // Sync quota to Firestore for cross-device tracking
    async syncToFirestore(uid: string, db: Firestore | null, firestoreOperations: FirestoreOperations = {}) {
        if (!uid || !db) return;
        try {
            const quota = this.getQuotaData();
            const makeDoc = firestoreOperations.doc || doc;
            const writeDoc = firestoreOperations.setDoc || setDoc;
            const makeServerTimestamp = firestoreOperations.serverTimestamp || serverTimestamp;
            await writeDoc(makeDoc(db, 'artifacts', 'aetheria-rpg', 'users', uid, 'quota', 'daily-ai'), {
                date: quota.date,
                used: quota.used,
                limit: this.DAILY_LIMIT,
                updatedAt: makeServerTimestamp(),
            }, { merge: true });
        } catch (e: unknown) {
            console.warn('Quota sync failed:', e instanceof Error ? e.message : String(e));
        }
    }
};
