import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages.js';

type FirestoreOperations = {
    doc?: (db: any, ...pathSegments: string[]) => any;
    setDoc?: (reference: any, data: Record<string, any>, options: { merge: true }) => Promise<unknown> | unknown;
    serverTimestamp?: () => any;
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
    async syncToFirestore(uid: any, db: any, firestoreOperations: FirestoreOperations = {}) {
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
        } catch (e: any) {
            console.warn('Quota sync failed:', e.message);
        }
    }
};
