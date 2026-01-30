import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CONSTANTS } from '../data/constants';

// --- REMOTE GAME CONFIG LOADER ---
// Fetches game balance data from Firestore at runtime
export const RemoteConfigLoader = {
    cache: null,

    async fetchConfig() {
        if (this.cache) return this.cache;
        if (!CONSTANTS.REMOTE_CONFIG_ENABLED) return null;

        try {
            const configDoc = await getDoc(doc(db, 'system', 'game_config'));
            if (configDoc.exists()) {
                this.cache = configDoc.data();
                console.log('✅ Remote game config loaded (v' + (this.cache.version || '?') + ')');
                return this.cache;
            }
        } catch (e) {
            console.warn('⚠️ Remote config fetch failed, using local data:', e.message);
        }
        return null;
    },

    async getItems() {
        const config = await this.fetchConfig();
        return config?.items || null;
    },

    async getMaps() {
        const config = await this.fetchConfig();
        return config?.maps || null;
    },

    async getClasses() {
        const config = await this.fetchConfig();
        return config?.classes || null;
    }
};
