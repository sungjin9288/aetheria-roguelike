import { setDoc, doc } from 'firebase/firestore';

// --- TOKEN QUOTA MANAGER (v3.5) ---
// Limits AI calls per user per day to control costs
export const TokenQuotaManager = {
    DAILY_LIMIT: 50, // AI calls per day per user
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

    getRemainingCalls() {
        const quota = this.getQuotaData();
        return Math.max(0, this.DAILY_LIMIT - quota.used);
    },

    recordCall() {
        const quota = this.getQuotaData();
        quota.used++;
        localStorage.setItem(this.QUOTA_KEY, JSON.stringify(quota));
    },

    getExhaustedMessage() {
        return "⚡ 에테르니아의 마력이 소진되었습니다. 내일 다시 시도해주세요.";
    },

    // Sync quota to Firestore for cross-device tracking
    async syncToFirestore(uid, db) {
        if (!uid || !db) return;
        try {
            const quota = this.getQuotaData();
            await setDoc(doc(db, 'user_quotas', uid), {
                date: quota.date,
                used: quota.used,
                limit: this.DAILY_LIMIT,
                updatedAt: new Date()
            }, { merge: true });
        } catch (e) {
            console.warn('Quota sync failed:', e.message);
        }
    }
};
