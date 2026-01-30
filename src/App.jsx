import { useState, useEffect, useRef, useReducer, createContext, useContext, useMemo } from 'react';
import { Terminal, Shield, Sword, Heart, Zap, Map as MapIcon, ShoppingBag, Ghost, ScrollText, GraduationCap, X, ChevronRight, User, Bot, ArrowRight, Save, Moon, Cloud, Wifi, WifiOff, Sparkles, Flame, Snowflake, Leaf, Mountain, Sun, Skull, Crown, Hammer } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// Rule 1: Use environment variable or global injection
const firebaseConfig = window.__firebase_config || JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'aetheria-rpg';
const ADMIN_UIDS = ['YOUR_ADMIN_UID_HERE']; // Replace with actual developer UID

/* ======================================================================================================================
   LAYER 1: CONFIGURATION & DATA (STATIC)
   ====================================================================================================================== */

const CONSTANTS = {
  // Note: GEMINI_API_KEY moved to server-side (api/ai-proxy.js)
  // Client no longer needs this key directly
  USE_AI_PROXY: import.meta.env.VITE_USE_AI_PROXY === 'true' || false,
  AI_PROXY_URL: import.meta.env.VITE_AI_PROXY_URL || '/api/ai-proxy',
  MAX_LEVEL: 99,
  START_HP: 150,
  START_MP: 50,
  START_GOLD: 500,
  SAVE_KEY: 'aetheria_save_v3_4', // Versioning 3.4
  DATA_VERSION: 3.4,
  REMOTE_CONFIG_ENABLED: import.meta.env.VITE_REMOTE_CONFIG === 'true' || false
};

// --- REMOTE GAME CONFIG LOADER ---
// Fetches game balance data from Firestore at runtime
const RemoteConfigLoader = {
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

// --- FEEDBACK VALIDATION (Client-side pre-validation) ---
const FeedbackValidator = {
  MIN_LENGTH: 10,
  MAX_LENGTH: 1000,
  RATE_LIMIT_KEY: 'aetheria_feedback_ts',
  RATE_LIMIT_MS: 60000, // 1 minute

  validate(content) {
    if (!content || content.length < this.MIN_LENGTH) {
      return { valid: false, error: `최소 ${this.MIN_LENGTH}자 이상 입력해주세요.` };
    }
    if (content.length > this.MAX_LENGTH) {
      return { valid: false, error: `${this.MAX_LENGTH}자를 초과할 수 없습니다.` };
    }
    // Check rate limit
    const lastTs = localStorage.getItem(this.RATE_LIMIT_KEY);
    if (lastTs && Date.now() - parseInt(lastTs) < this.RATE_LIMIT_MS) {
      const wait = Math.ceil((this.RATE_LIMIT_MS - (Date.now() - parseInt(lastTs))) / 1000);
      return { valid: false, error: `잠시 후 다시 시도해주세요. (${wait}초)` };
    }
    return { valid: true };
  },

  markSubmitted() {
    localStorage.setItem(this.RATE_LIMIT_KEY, Date.now().toString());
  }
};

// --- TOKEN QUOTA MANAGER (v3.5) ---
// Limits AI calls per user per day to control costs
const TokenQuotaManager = {
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

// --- LATENCY TRACKER (v3.5) ---
// Monitors AI response times and alerts on slow responses
const LatencyTracker = {
  THRESHOLD_MS: 3000, // 3 seconds threshold
  recentLatencies: [],
  MAX_HISTORY: 20,

  async trackCall(asyncFn, callType = 'ai') {
    const startTime = performance.now();

    try {
      const result = await asyncFn();
      const latency = performance.now() - startTime;

      this.recordLatency(callType, latency);

      // Alert if over threshold
      if (latency > this.THRESHOLD_MS) {
        console.warn(`⚠️ Slow ${callType} response: ${(latency / 1000).toFixed(2)}s (threshold: ${this.THRESHOLD_MS / 1000}s)`);
        this.onSlowResponse(callType, latency);
      }

      return result;
    } catch (e) {
      const latency = performance.now() - startTime;
      this.recordLatency(callType, latency, true);
      throw e;
    }
  },

  recordLatency(type, latency, isError = false) {
    this.recentLatencies.unshift({
      type,
      latency,
      isError,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (this.recentLatencies.length > this.MAX_HISTORY) {
      this.recentLatencies.pop();
    }
  },

  getAverageLatency(type = null) {
    const filtered = type
      ? this.recentLatencies.filter(l => l.type === type && !l.isError)
      : this.recentLatencies.filter(l => !l.isError);

    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, l) => sum + l.latency, 0) / filtered.length;
  },

  onSlowResponse(type, latency) {
    // Hook for custom alerting (can integrate with monitoring systems)
    // For now, just dispatch a custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aetheria:slow-response', {
        detail: { type, latency, threshold: this.THRESHOLD_MS }
      }));
    }
  },

  getStats() {
    return {
      avgLatency: this.getAverageLatency(),
      callCount: this.recentLatencies.length,
      errorCount: this.recentLatencies.filter(l => l.isError).length,
      slowCount: this.recentLatencies.filter(l => l.latency > this.THRESHOLD_MS).length
    };
  }
};

const DB = {
  ELEMENTS: {
    '물리': { icon: <Sword size={12} />, strong: [], weak: [] },
    '화염': { icon: <Flame size={12} className="text-orange-500" />, strong: ['자연', '냉기'], weak: ['대지', '물'] },
    '냉기': { icon: <Snowflake size={12} className="text-cyan-400" />, strong: ['화염', '대지'], weak: ['빛'] },
    '자연': { icon: <Leaf size={12} className="text-green-500" />, strong: ['대지', '물'], weak: ['화염'] },
    '대지': { icon: <Mountain size={12} className="text-amber-700" />, strong: ['냉기'], weak: ['자연'] },
    '빛': { icon: <Sun size={12} className="text-yellow-400" />, strong: ['어둠'], weak: ['자연'] },
    '어둠': { icon: <Moon size={12} className="text-purple-500" />, strong: ['빛'], weak: ['화염'] }
  },
  CLASSES: {
    '모험가': {
      tier: 0, desc: '기본 직업', hpMod: 1.0, mpMod: 1.0, atkMod: 1.0,
      skills: [
        { name: '강타', mp: 10, type: '물리', mult: 1.5, desc: '강력한 일격' }
      ],
      next: ['전사', '마법사', '도적']
    },
    '전사': {
      tier: 1, reqLv: 10, desc: '체력/공격 특화', hpMod: 1.4, mpMod: 0.6, atkMod: 1.3,
      skills: [
        { name: '파워배시', mp: 15, mult: 2.0, desc: '강력한 내려찍기' },
        { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3, desc: 'ATK 50% 상승 3턴' },
        { name: '출혈베기', mp: 25, mult: 1.8, effect: 'bleed', desc: '3턴간 지속 피해' }
      ],
      next: ['나이트', '버서커']
    },
    '마법사': {
      tier: 1, reqLv: 10, desc: '마법 공격 특화', hpMod: 0.7, mpMod: 1.8, atkMod: 1.6,
      skills: [
        { name: '화염구', mp: 20, type: '화염', mult: 2.2, effect: 'burn', desc: '화상 부여' },
        { name: '썬더볼트', mp: 45, type: '빛', mult: 3.5, effect: 'stun', desc: '기절 부여' },
        { name: '아이스볼트', mp: 25, type: '냉기', mult: 2.0, effect: 'freeze', desc: '빙결 부여' }
      ],
      next: ['아크메이지', '흑마법사']
    },
    '도적': {
      tier: 1, reqLv: 10, desc: '치명타/속도', hpMod: 1.0, mpMod: 1.0, atkMod: 1.4,
      skills: [
        { name: '급소찌르기', mp: 15, mult: 1.8, crit: 0.5, desc: '50% 치명타 확률' },
        { name: '독바르기', mp: 25, type: '자연', mult: 1.5, effect: 'poison', desc: '독 부여' },
        { name: '연막탄', mp: 20, type: 'debuff', effect: 'blind', turn: 2, desc: '적 명중률 하락' }
      ],
      next: ['어쌔신', '레인저']
    },
    '나이트': {
      tier: 2, reqLv: 30, desc: '철벽의 방어', hpMod: 2.0, mpMod: 0.8, atkMod: 1.5,
      skills: [
        { name: '실드배시', mp: 20, mult: 2.5, effect: 'stun', desc: '기절 부여' },
        { name: '절대방어', mp: 50, type: 'buff', effect: 'def_up', val: 2.0, turn: 5, desc: 'DEF 100% 상승' },
        { name: '신성한 심판', mp: 80, type: '빛', mult: 5.0, effect: 'purify', desc: '궁극기: 신성 피해' },
        { name: '도발', mp: 30, type: 'debuff', effect: 'taunt', turn: 3, desc: '적 공격 집중' }
      ],
      next: []
    },
    '버서커': {
      tier: 2, reqLv: 30, desc: '광란의 공격', hpMod: 1.6, mpMod: 0.5, atkMod: 2.0,
      skills: [
        { name: '휠윈드', mp: 30, mult: 3.0, desc: '회전 공격' },
        { name: '피의갈망', mp: 60, type: 'buff', effect: 'berserk', val: 2.5, turn: 3, desc: 'ATK 150% / DEF 감소' },
        { name: '대지 분쇄', mp: 80, type: '대지', mult: 5.5, effect: 'stun', desc: '궁극기: 기절 부여' },
        { name: '출혈 광란', mp: 50, mult: 3.5, effect: 'bleed', desc: '강력한 출혈' }
      ],
      next: []
    },
    '아크메이지': {
      tier: 2, reqLv: 30, desc: '원소의 지배자', hpMod: 0.8, mpMod: 2.5, atkMod: 2.2,
      skills: [
        { name: '메테오', mp: 60, type: '화염', mult: 4.5, effect: 'burn', desc: '화상 부여' },
        { name: '블리자드', mp: 60, type: '냉기', mult: 4.0, effect: 'freeze', desc: '빙결 부여' },
        { name: '천벌', mp: 100, type: '빛', mult: 6.0, effect: 'purify', desc: '궁극기: 신성 피해' },
        { name: '마나 폭발', mp: 80, mult: 5.0, desc: '순수 마력 폭발' }
      ],
      next: []
    },
    '흑마법사': {
      tier: 2, reqLv: 30, desc: '어둠의 계약', hpMod: 0.9, mpMod: 2.0, atkMod: 2.0,
      skills: [
        { name: '다크메터', mp: 50, type: '어둠', mult: 4.0, effect: 'curse', desc: '저주 부여' },
        { name: '생명흡수', mp: 40, mult: 3.0, effect: 'drain', desc: 'HP 흡수' },
        { name: '영혼 파괴', mp: 100, type: '어둠', mult: 6.5, effect: 'curse', desc: '궁극기: 강력한 저주' },
        { name: '공포', mp: 35, type: 'debuff', effect: 'fear', turn: 2, desc: '적 ATK 감소' }
      ],
      next: []
    },
    '어쌔신': {
      tier: 2, reqLv: 30, desc: '일격필살', hpMod: 1.1, mpMod: 1.2, atkMod: 1.9,
      skills: [
        { name: '암살', mp: 40, mult: 5.0, crit: 0.8, desc: '80% 치명타 확률' },
        { name: '은신', mp: 30, type: 'buff', effect: 'stealth', val: 2.0, turn: 2, desc: '회피 증가' },
        { name: '그림자 일섬', mp: 100, type: '어둠', mult: 7.0, crit: 1.0, desc: '궁극기: 100% 치명타' },
        { name: '치명 독', mp: 50, type: '자연', mult: 3.0, effect: 'poison', desc: '강력한 독' }
      ],
      next: []
    },
    '레인저': {
      tier: 2, reqLv: 30, desc: '원거리 명사수', hpMod: 1.2, mpMod: 1.5, atkMod: 1.7,
      skills: [
        { name: '연속사격', mp: 35, mult: 3.5, desc: '다중 공격' },
        { name: '폭발화살', mp: 45, type: '화염', mult: 3.8, effect: 'burn', desc: '화상 부여' },
        { name: '저격', mp: 100, mult: 8.0, crit: 0.7, desc: '궁극기: 70% 치명타' },
        { name: '빙결 화살', mp: 40, type: '냉기', mult: 3.2, effect: 'freeze', desc: '빙결 부여' }
      ],
      next: []
    }
  },
  ITEMS: {
    weapons: [
      // Tier 1 - 초급 (15개)
      { name: '녹슨 단검', type: 'weapon', val: 5, tier: 1, price: 50, jobs: ['모험가', '도적', '마법사', '어쌔신', '레인저'], desc: '기본 단검', desc_stat: 'ATK+5' },
      { name: '롱소드', type: 'weapon', val: 15, tier: 1, price: 150, jobs: ['전사', '모험가', '나이트', '버서커'], desc: '표준적인 검.', desc_stat: 'ATK+15' },
      { name: '나무지팡이', type: 'weapon', val: 8, tier: 1, price: 80, jobs: ['마법사', '모험가'], desc: '마법 입문자의 지팡이.', desc_stat: 'ATK+8' },
      { name: '단궁', type: 'weapon', val: 12, tier: 1, price: 120, jobs: ['도적', '레인저', '모험가'], desc: '가벼운 단궁.', desc_stat: 'ATK+12' },
      { name: '나무곤봉', type: 'weapon', val: 10, tier: 1, price: 60, jobs: ['전사', '모험가', '버서커'], desc: '무거운 나무 곤봉.', desc_stat: 'ATK+10' },
      { name: '수련생의 검', type: 'weapon', val: 12, tier: 1, price: 100, jobs: ['전사', '모험가', '나이트'], desc: '검술 수련용 검.', desc_stat: 'ATK+12' },
      { name: '투척용 단검', type: 'weapon', val: 8, tier: 1, price: 70, jobs: ['도적', '어쌔신', '레인저'], desc: '던지기 좋은 단검.', desc_stat: 'ATK+8' },
      { name: '마법봉', type: 'weapon', val: 10, tier: 1, price: 90, jobs: ['마법사', '모험가'], desc: '작은 마법봉.', desc_stat: 'ATK+10' },
      { name: '농부의 포크', type: 'weapon', val: 7, tier: 1, price: 40, jobs: ['모험가'], desc: '농기구지만...', desc_stat: 'ATK+7' },
      { name: '사냥칼', type: 'weapon', val: 11, tier: 1, price: 95, jobs: ['도적', '레인저', '모험가'], desc: '사냥에 쓰던 칼.', desc_stat: 'ATK+11' },
      { name: '낡은 철퇴', type: 'weapon', val: 14, tier: 1, price: 130, jobs: ['전사', '나이트'], desc: '무거운 철퇴.', desc_stat: 'ATK+14' },
      { name: '견습생의 단검', type: 'weapon', val: 9, tier: 1, price: 75, jobs: ['도적', '어쌔신'], desc: '암살 수업용 단검.', desc_stat: 'ATK+9' },
      { name: '호신용 지팡이', type: 'weapon', val: 6, tier: 1, price: 55, jobs: ['마법사', '모험가'], desc: '여행자의 지팡이.', desc_stat: 'ATK+6' },
      { name: '병사의 창', type: 'weapon', val: 13, tier: 1, price: 110, jobs: ['전사', '나이트'], desc: '일반 보병의 창.', desc_stat: 'ATK+13' },
      { name: '양손검', type: 'weapon', val: 18, tier: 1, price: 180, jobs: ['전사', '버서커'], desc: '양손으로 쥐는 대검.', desc_stat: 'ATK+18' },
      // Tier 2 - 중급 (15개)
      { name: '전투도끼', type: 'weapon', val: 25, tier: 2, price: 400, jobs: ['전사', '버서커'], desc: '무거운 도끼.', desc_stat: 'ATK+25' },
      { name: '마법지팡이', type: 'weapon', val: 20, tier: 2, price: 500, jobs: ['마법사', '아크메이지', '흑마법사'], desc: '마력이 깃든 지팡이.', desc_stat: 'ATK+20' },
      { name: '강철 롱소드', type: 'weapon', val: 25, tier: 2, price: 400, jobs: ['전사', '모험가', '나이트'], desc: '잘 제련된 강철 검.', desc_stat: 'ATK+25' },
      { name: '화염의 지팡이', type: 'weapon', val: 35, tier: 2, price: 600, elem: '화염', jobs: ['마법사', '아크메이지'], desc: '불꽃이 일렁이는 지팡이.', desc_stat: 'ATK+35(화)' },
      { name: '암살자의 단검', type: 'weapon', val: 28, tier: 2, price: 450, jobs: ['도적', '어쌔신'], desc: '독이 발린 단검.', desc_stat: 'ATK+28' },
      { name: '복합궁', type: 'weapon', val: 30, tier: 2, price: 480, jobs: ['레인저', '도적'], desc: '강화된 복합궁.', desc_stat: 'ATK+30' },
      { name: '얼음 지팡이', type: 'weapon', val: 32, tier: 2, price: 550, elem: '냉기', jobs: ['마법사', '아크메이지'], desc: '냉기가 서린 지팡이.', desc_stat: 'ATK+32(냉)' },
      { name: '드워프의 망치', type: 'weapon', val: 30, tier: 2, price: 480, jobs: ['전사', '버서커'], desc: '드워프가 만든 망치.', desc_stat: 'ATK+30' },
      { name: '질풍의 단검', type: 'weapon', val: 26, tier: 2, price: 420, jobs: ['도적', '어쌔신'], desc: '바람처럼 빠른 단검.', desc_stat: 'ATK+26' },
      { name: '기사의 검', type: 'weapon', val: 28, tier: 2, price: 450, jobs: ['전사', '나이트'], desc: '기사단의 검.', desc_stat: 'ATK+28' },
      { name: '사막의 시미터', type: 'weapon', val: 27, tier: 2, price: 430, jobs: ['전사', '도적', '버서커'], desc: '곡선형 검.', desc_stat: 'ATK+27' },
      { name: '마녀의 지팡이', type: 'weapon', val: 33, tier: 2, price: 570, elem: '어둠', jobs: ['마법사', '흑마법사'], desc: '저주가 깃든 지팡이.', desc_stat: 'ATK+33(암)' },
      { name: '정예병의 창', type: 'weapon', val: 29, tier: 2, price: 460, jobs: ['전사', '나이트'], desc: '정예 병사의 창.', desc_stat: 'ATK+29' },
      { name: '사냥꾼의 활', type: 'weapon', val: 28, tier: 2, price: 440, jobs: ['레인저'], desc: '숙련된 사냥꾼의 활.', desc_stat: 'ATK+28' },
      { name: '번개 지팡이', type: 'weapon', val: 34, tier: 2, price: 590, elem: '빛', jobs: ['마법사', '아크메이지'], desc: '번개가 깃든 지팡이.', desc_stat: 'ATK+34(빛)' },
      // Tier 3 - 상급 (12개)
      { name: '미스릴검', type: 'weapon', val: 45, tier: 3, price: 1200, jobs: ['전사', '모험가', '나이트'], desc: '가볍고 강한 미스릴 검.', desc_stat: 'ATK+45' },
      { name: '흑요석단검', type: 'weapon', val: 40, tier: 3, price: 1000, jobs: ['도적', '어쌔신'], desc: '날카로운 흑요석 단검.', desc_stat: 'ATK+40' },
      { name: '엘프의활', type: 'weapon', val: 35, tier: 3, price: 1100, jobs: ['도적', '모험가', '레인저'], desc: '엘프가 만든 활.', desc_stat: 'ATK+35' },
      { name: '대지의 메이스', type: 'weapon', val: 50, tier: 3, price: 1300, elem: '대지', jobs: ['전사', '나이트'], desc: '대지의 힘이 깃든 메이스.', desc_stat: 'ATK+50(지)' },
      { name: '독사의 송곳니', type: 'weapon', val: 48, tier: 3, price: 1250, elem: '자연', jobs: ['도적', '어쌔신'], desc: '맹독이 스며든 단검.', desc_stat: 'ATK+48(독)' },
      { name: '정령의 지팡이', type: 'weapon', val: 55, tier: 3, price: 1500, elem: '자연', jobs: ['마법사', '아크메이지', '흑마법사'], desc: '정령의 가호.', desc_stat: 'ATK+55(자)' },
      { name: '광전사의 도끼', type: 'weapon', val: 60, tier: 3, price: 1600, jobs: ['버서커'], desc: '피에 굶주린 도끼.', desc_stat: 'ATK+60' },
      { name: '사냥꾼의 장궁', type: 'weapon', val: 52, tier: 3, price: 1400, jobs: ['레인저'], desc: '정밀한 장거리 활.', desc_stat: 'ATK+52' },
      { name: '성기사의 검', type: 'weapon', val: 55, tier: 3, price: 1500, elem: '빛', jobs: ['나이트'], desc: '신성한 힘이 깃든 검.', desc_stat: 'ATK+55(빛)' },
      { name: '암살의 표창', type: 'weapon', val: 45, tier: 3, price: 1150, jobs: ['어쌔신'], desc: '치명적인 표창 세트.', desc_stat: 'ATK+45' },
      { name: '혼돈의 로드', type: 'weapon', val: 58, tier: 3, price: 1550, elem: '어둠', jobs: ['흑마법사'], desc: '어둠의 마력이 흐르는 로드.', desc_stat: 'ATK+58(암)' },
      { name: '용아 단검', type: 'weapon', val: 52, tier: 3, price: 1350, jobs: ['도적', '어쌔신'], desc: '용 이빨로 만든 단검.', desc_stat: 'ATK+52' },
      // Tier 4 - 영웅급 (10개)
      { name: '용살자의창', type: 'weapon', val: 80, tier: 4, price: 5000, jobs: ['전사', '나이트'], desc: '용을 잡는 창.', desc_stat: 'ATK+80' },
      { name: '아크스태프', type: 'weapon', val: 90, tier: 4, price: 6000, jobs: ['마법사', '아크메이지'], desc: '대마법사의 지팡이.', desc_stat: 'ATK+90' },
      { name: '암흑의 대검', type: 'weapon', val: 95, tier: 4, price: 6500, elem: '어둠', jobs: ['버서커', '흑마법사'], desc: '암흑에서 태어난 검.', desc_stat: 'ATK+95(암)' },
      { name: '불사조의 활', type: 'weapon', val: 85, tier: 4, price: 5500, elem: '화염', jobs: ['레인저'], desc: '불사조 깃털로 만든 활.', desc_stat: 'ATK+85(화)' },
      { name: '서리칼날', type: 'weapon', val: 88, tier: 4, price: 5800, elem: '냉기', jobs: ['어쌔신'], desc: '얼어붙은 그림자.', desc_stat: 'ATK+88(냉)' },
      { name: '심판자의 검', type: 'weapon', val: 100, tier: 4, price: 7000, elem: '빛', jobs: ['나이트'], desc: '신성한 심판의 검.', desc_stat: 'ATK+100(빛)' },
      { name: '혼돈의 지팡이', type: 'weapon', val: 92, tier: 4, price: 6200, elem: '어둠', jobs: ['흑마법사'], desc: '혼돈의 마력.', desc_stat: 'ATK+92(암)' },
      { name: '타이탄 해머', type: 'weapon', val: 98, tier: 4, price: 6800, elem: '대지', jobs: ['버서커'], desc: '거인의 망치.', desc_stat: 'ATK+98(지)' },
      { name: '세이지 로드', type: 'weapon', val: 88, tier: 4, price: 5700, jobs: ['아크메이지'], desc: '현자의 지팡이.', desc_stat: 'ATK+88' },
      { name: '죽음의 낫', type: 'weapon', val: 93, tier: 4, price: 6300, elem: '어둠', jobs: ['흑마법사', '어쌔신'], desc: '사신의 무기.', desc_stat: 'ATK+93(암)' },
      // Tier 5 - 전설급 (8개)
      { name: '성검 에테르니아', type: 'weapon', val: 200, tier: 5, price: 30000, elem: '빛', jobs: ['전사', '모험가', '나이트'], desc: '전설 속 영웅이 사용하던 검.', desc_stat: 'ATK+200(빛)' },
      { name: '천벌의 지팡이', type: 'weapon', val: 180, tier: 5, price: 28000, elem: '빛', jobs: ['아크메이지'], desc: '신들의 심판.', desc_stat: 'ATK+180(빛)' },
      { name: '마왕의 대낫', type: 'weapon', val: 220, tier: 5, price: 35000, elem: '어둠', jobs: ['흑마법사', '버서커'], desc: '마왕이 사용하던 무기.', desc_stat: 'ATK+220(암)' },
      { name: '바람의 궁극', type: 'weapon', val: 170, tier: 5, price: 27000, jobs: ['레인저'], desc: '바람을 가르는 전설의 활.', desc_stat: 'ATK+170' },
      { name: '그림자 절단기', type: 'weapon', val: 190, tier: 5, price: 29000, elem: '어둠', jobs: ['어쌔신'], desc: '존재 자체가 전설.', desc_stat: 'ATK+190(암)' },
      { name: '라그나로크', type: 'weapon', val: 210, tier: 5, price: 32000, elem: '화염', jobs: ['버서커'], desc: '세계를 태우는 검.', desc_stat: 'ATK+210(화)' },
      { name: '빙결의 왕관검', type: 'weapon', val: 185, tier: 5, price: 28500, elem: '냉기', jobs: ['나이트'], desc: '얼음 왕의 검.', desc_stat: 'ATK+185(냉)' },
      { name: '세계수의 지팡이', type: 'weapon', val: 175, tier: 5, price: 27500, elem: '자연', jobs: ['아크메이지', '흑마법사'], desc: '세계수의 가지.', desc_stat: 'ATK+175(자)' }
    ],
    armors: [
      // Tier 1 - 초급 (12개)
      { name: '여행자 튜닉', type: 'armor', val: 2, tier: 1, price: 50, jobs: ['모험가', '전사', '마법사', '도적', '레인저'], desc: '활동하기 편한 얇은 옷.', desc_stat: 'DEF+2' },
      { name: '가죽 갑옷', type: 'armor', val: 8, tier: 1, price: 120, jobs: ['모험가', '전사', '도적', '어쌔신'], desc: '질긴 가죽 갑옷.', desc_stat: 'DEF+8' },
      { name: '수련복', type: 'armor', val: 5, tier: 1, price: 80, jobs: ['마법사', '모험가'], desc: '마법사의 수련복.', desc_stat: 'DEF+5' },
      { name: '천 로브', type: 'armor', val: 3, tier: 1, price: 40, jobs: ['마법사', '모험가'], desc: '간단한 천 로브.', desc_stat: 'DEF+3' },
      { name: '가죽 조끼', type: 'armor', val: 6, tier: 1, price: 70, jobs: ['도적', '레인저', '모험가'], desc: '가벼운 가죽 조끼.', desc_stat: 'DEF+6' },
      { name: '병사 갑옷', type: 'armor', val: 10, tier: 1, price: 150, jobs: ['전사', '나이트'], desc: '일반 병사의 갑옷.', desc_stat: 'DEF+10' },
      { name: '사냥꾼 망토', type: 'armor', val: 5, tier: 1, price: 60, jobs: ['레인저', '도적'], desc: '숲에서 위장하기 좋은 망토.', desc_stat: 'DEF+5' },
      { name: '수련생 도복', type: 'armor', val: 4, tier: 1, price: 55, jobs: ['전사', '모험가'], desc: '무술 수련생의 도복.', desc_stat: 'DEF+4' },
      { name: '마법 모자', type: 'armor', val: 3, tier: 1, price: 45, jobs: ['마법사'], desc: '마법 입문자의 모자.', desc_stat: 'DEF+3' },
      { name: '도적의 두건', type: 'armor', val: 4, tier: 1, price: 50, jobs: ['도적', '어쌔신'], desc: '얼굴을 가리는 두건.', desc_stat: 'DEF+4' },
      { name: '가죽 장화', type: 'armor', val: 3, tier: 1, price: 35, jobs: ['모험가', '전사', '도적', '레인저'], desc: '튼튼한 가죽 장화.', desc_stat: 'DEF+3' },
      { name: '목재 방패', type: 'armor', val: 7, tier: 1, price: 90, jobs: ['전사', '나이트', '모험가'], desc: '간단한 나무 방패.', desc_stat: 'DEF+7' },
      // Tier 2 - 중급 (12개)
      { name: '사슬 갑옷', type: 'armor', val: 18, tier: 2, price: 350, jobs: ['전사', '나이트', '버서커'], desc: '튼튼한 사슬 갑옷.', desc_stat: 'DEF+18' },
      { name: '강화가죽갑옷', type: 'armor', val: 15, tier: 2, price: 280, jobs: ['도적', '어쌔신', '레인저'], desc: '강화된 가죽 갑옷.', desc_stat: 'DEF+15' },
      { name: '마력천로브', type: 'armor', val: 12, tier: 2, price: 320, jobs: ['마법사', '아크메이지', '흑마법사'], desc: '마력이 깃든 로브.', desc_stat: 'DEF+12' },
      { name: '기사의 흉갑', type: 'armor', val: 20, tier: 2, price: 400, jobs: ['전사', '나이트'], desc: '기사단의 흉갑.', desc_stat: 'DEF+20' },
      { name: '은빛 로브', type: 'armor', val: 14, tier: 2, price: 340, jobs: ['마법사', '아크메이지'], desc: '은실로 짠 로브.', desc_stat: 'DEF+14' },
      { name: '도적 가죽갑옷', type: 'armor', val: 16, tier: 2, price: 300, jobs: ['도적', '어쌔신'], desc: '움직임에 최적화.', desc_stat: 'DEF+16' },
      { name: '철제 방패', type: 'armor', val: 15, tier: 2, price: 320, jobs: ['전사', '나이트'], desc: '튼튼한 철제 방패.', desc_stat: 'DEF+15' },
      { name: '화염 방어복', type: 'armor', val: 14, tier: 2, price: 380, elem: '화염', jobs: ['전사', '나이트', '버서커'], desc: '불에 강한 갑옷.', desc_stat: 'DEF+14(화저항)' },
      { name: '냉기 방어복', type: 'armor', val: 14, tier: 2, price: 380, elem: '냉기', jobs: ['전사', '나이트', '버서커'], desc: '추위에 강한 갑옷.', desc_stat: 'DEF+14(냉저항)' },
      { name: '레인저 외투', type: 'armor', val: 13, tier: 2, price: 290, jobs: ['레인저'], desc: '숲에서 입는 외투.', desc_stat: 'DEF+13' },
      { name: '암흑 로브', type: 'armor', val: 13, tier: 2, price: 350, elem: '어둠', jobs: ['마법사', '흑마법사'], desc: '어둠이 깃든 로브.', desc_stat: 'DEF+13(암)' },
      { name: '축복받은 갑옷', type: 'armor', val: 16, tier: 2, price: 400, elem: '빛', jobs: ['전사', '나이트'], desc: '신성한 가호.', desc_stat: 'DEF+16(빛)' },
      // Tier 3 - 상급 (10개)
      { name: '판금갑옷', type: 'armor', val: 30, tier: 3, price: 800, jobs: ['전사', '나이트'], desc: '두꺼운 강철 판금.', desc_stat: 'DEF+30' },
      { name: '마법로브', type: 'armor', val: 20, tier: 3, price: 700, jobs: ['마법사', '아크메이지', '흑마법사'], desc: '마력이 깃든 로브.', desc_stat: 'DEF+20' },
      { name: '그림자 망토', type: 'armor', val: 25, tier: 3, price: 900, jobs: ['도적', '어쌔신'], desc: '그림자에 녹아드는 망토.', desc_stat: 'DEF+25' },
      { name: '사냥꾼의 외투', type: 'armor', val: 22, tier: 3, price: 750, jobs: ['레인저'], desc: '움직임이 편한 외투.', desc_stat: 'DEF+22' },
      { name: '광전사의 조끼', type: 'armor', val: 28, tier: 3, price: 850, jobs: ['버서커'], desc: '상처를 두려워하지 않는다.', desc_stat: 'DEF+28' },
      { name: '미스릴 갑옷', type: 'armor', val: 35, tier: 3, price: 1100, jobs: ['전사', '나이트'], desc: '가볍고 튼튼한 미스릴 갑옷.', desc_stat: 'DEF+35' },
      { name: '정령의 로브', type: 'armor', val: 24, tier: 3, price: 950, elem: '자연', jobs: ['마법사', '아크메이지'], desc: '정령의 가호가 깃든 로브.', desc_stat: 'DEF+24(자)' },
      { name: '암살자 장갑', type: 'armor', val: 22, tier: 3, price: 800, jobs: ['도적', '어쌔신'], desc: '손재주를 높여준다.', desc_stat: 'DEF+22' },
      { name: '엘프의 갑옷', type: 'armor', val: 26, tier: 3, price: 900, jobs: ['레인저', '도적'], desc: '엘프가 만든 가벼운 갑옷.', desc_stat: 'DEF+26' },
      { name: '화염술사 로브', type: 'armor', val: 23, tier: 3, price: 880, elem: '화염', jobs: ['마법사', '아크메이지'], desc: '화염에 강한 로브.', desc_stat: 'DEF+23(화)' },
      // Tier 4 - 영웅급 (8개)
      { name: '용비늘갑옷', type: 'armor', val: 60, tier: 4, price: 5000, jobs: ['전사', '모험가', '버서커'], desc: '용의 비늘로 만든 갑옷.', desc_stat: 'DEF+60' },
      { name: '대마법사로브', type: 'armor', val: 45, tier: 4, price: 4500, jobs: ['아크메이지', '흑마법사'], desc: '대마법사의 상징.', desc_stat: 'DEF+45' },
      { name: '암살자의 야복', type: 'armor', val: 50, tier: 4, price: 4800, jobs: ['어쌔신'], desc: '완벽한 은폐.', desc_stat: 'DEF+50' },
      { name: '성기사의 갑주', type: 'armor', val: 70, tier: 4, price: 5500, jobs: ['나이트'], desc: '신성한 가호의 갑옷.', desc_stat: 'DEF+70' },
      { name: '정밀 사격복', type: 'armor', val: 48, tier: 4, price: 4600, jobs: ['레인저'], desc: '원거리 전투 특화.', desc_stat: 'DEF+48' },
      { name: '불사조 흉갑', type: 'armor', val: 65, tier: 4, price: 5200, elem: '화염', jobs: ['전사', '버서커'], desc: '불사조의 깃털로 만든 갑옷.', desc_stat: 'DEF+65(화)' },
      { name: '빙결의 갑주', type: 'armor', val: 62, tier: 4, price: 5100, elem: '냉기', jobs: ['나이트'], desc: '얼음으로 보호받는 갑옷.', desc_stat: 'DEF+62(냉)' },
      { name: '어둠의 망토', type: 'armor', val: 52, tier: 4, price: 4900, elem: '어둠', jobs: ['흑마법사', '어쌔신'], desc: '어둠에 녹아드는 망토.', desc_stat: 'DEF+52(암)' },
      // Tier 5 - 전설급 (8개)
      { name: '천상의갑주', type: 'armor', val: 100, tier: 5, price: 15000, jobs: ['전사', '나이트'], desc: '천계의 금속으로 만듬.', desc_stat: 'DEF+100' },
      { name: '현자의 예복', type: 'armor', val: 80, tier: 5, price: 14000, jobs: ['아크메이지'], desc: '현자들의 지혜.', desc_stat: 'DEF+80' },
      { name: '암흑 군주의 망토', type: 'armor', val: 85, tier: 5, price: 14500, jobs: ['흑마법사', '어쌔신'], desc: '어둠의 가호.', desc_stat: 'DEF+85' },
      { name: '전설의 사냥꾼 외투', type: 'armor', val: 75, tier: 5, price: 13500, jobs: ['레인저'], desc: '전설의 궁수가 입었던 외투.', desc_stat: 'DEF+75' },
      { name: '광기의 갑주', type: 'armor', val: 90, tier: 5, price: 15000, jobs: ['버서커'], desc: '광기가 깃든 저주받은 갑옷.', desc_stat: 'DEF+90' },
      { name: '드래곤로드 갑주', type: 'armor', val: 110, tier: 5, price: 18000, jobs: ['전사', '나이트', '버서커'], desc: '용왕의 비늘로 만든 갑옷.', desc_stat: 'DEF+110' },
      { name: '세계수의 로브', type: 'armor', val: 78, tier: 5, price: 14200, elem: '자연', jobs: ['아크메이지'], desc: '세계수의 잎으로 만든 로브.', desc_stat: 'DEF+78(자)' },
      { name: '어둠의 왕 갑주', type: 'armor', val: 95, tier: 5, price: 16000, elem: '어둠', jobs: ['흑마법사', '버서커'], desc: '어둠의 왕이 입었던 갑주.', desc_stat: 'DEF+95(암)' }
    ],
    consumables: [
      // 체력물약
      { name: '하급 체력 물약', val: 50, type: 'hp', price: 30, desc: 'HP 50 회복', desc_stat: 'HP+50' },
      { name: '중급 체력 물약', val: 150, type: 'hp', price: 100, desc: 'HP 150 회복', desc_stat: 'HP+150' },
      { name: '상급 체력 물약', val: 300, type: 'hp', price: 300, desc: 'HP 300 회복', desc_stat: 'HP+300' },
      { name: '엘릭서', val: 9999, type: 'hp', price: 2000, desc: 'HP 완전 회복', desc_stat: 'HP MAX' },
      // 마나물약
      { name: '하급 마나 물약', val: 30, type: 'mp', price: 40, desc: 'MP 30 회복', desc_stat: 'MP+30' },
      { name: '중급 마나 물약', val: 80, type: 'mp', price: 120, desc: 'MP 80 회복', desc_stat: 'MP+80' },
      { name: '상급 마나 물약', val: 200, type: 'mp', price: 350, desc: 'MP 200 회복', desc_stat: 'MP+200' },
      // 상태이상 치료
      { name: '해독제', type: 'cure', effect: 'poison', price: 50, desc: '중독 상태를 치료', desc_stat: '해독' },
      { name: '치료약', type: 'cure', effect: 'burn', price: 50, desc: '화상 상태를 치료', desc_stat: '화상치료' },
      { name: '해빙제', type: 'cure', effect: 'freeze', price: 60, desc: '빙결 상태를 치료', desc_stat: '해빙' },
      { name: '저주해제 주문서', type: 'cure', effect: 'curse', price: 100, desc: '저주를 해제', desc_stat: '저주해제' },
      // 버프 물약
      { name: '분노의 물약', type: 'buff', effect: 'atk_up', val: 1.3, turn: 5, price: 200, desc: 'ATK 30% 증가 5턴', desc_stat: 'ATK↑' },
      { name: '수호의 물약', type: 'buff', effect: 'def_up', val: 1.3, turn: 5, price: 200, desc: 'DEF 30% 증가 5턴', desc_stat: 'DEF↑' },
      { name: '영웅의 물약', type: 'buff', effect: 'all_up', val: 1.5, turn: 3, price: 500, desc: '모든 능력 50% 증가 3턴', desc_stat: 'ALL↑' }
    ],
    materials: [
      // 기본 재료
      { name: '슬라임 젤리', type: 'mat', price: 5, desc: '끈적거리는 액체', desc_stat: '재료' },
      { name: '동전 주머니', type: 'mat', price: 50, desc: '동전이 든 주머니', desc_stat: '재료' },
      { name: '철광석', type: 'mat', price: 20, desc: '단단한 광석', desc_stat: '재료' },
      { name: '마나 결정', type: 'mat', price: 100, desc: '마력이 응축된 결정', desc_stat: '재료' },
      { name: '용의 비늘', type: 'mat', price: 500, desc: '매우 단단한 비늘', desc_stat: '재료' },
      { name: '어둠의 정수', type: 'mat', price: 300, desc: '불길한 기운', desc_stat: '재료' },
      { name: '멧돼지 가죽', type: 'mat', price: 20, desc: '질긴 가죽', desc_stat: '재료' },
      { name: '박쥐 날개', type: 'mat', price: 15, desc: '연금술 재료', desc_stat: '재료' },
      { name: '화염의 결정', type: 'mat', price: 100, desc: '뜨거운 열기', desc_stat: '재료' },
      // 중급 재료
      { name: '냉기의 결정', type: 'mat', price: 100, desc: '얼어붙은 마력', desc_stat: '재료' },
      { name: '자연의 결정', type: 'mat', price: 100, desc: '생명의 기운', desc_stat: '재료' },
      { name: '빛의 결정', type: 'mat', price: 150, desc: '신성한 빛', desc_stat: '재료' },
      { name: '해골 뼈', type: 'mat', price: 25, desc: '언데드의 잔해', desc_stat: '재료' },
      { name: '트롤의 피', type: 'mat', price: 80, desc: '재생력이 있는 피', desc_stat: '재료' },
      { name: '고블린 이빨', type: 'mat', price: 15, desc: '날카로운 이빨', desc_stat: '재료' },
      { name: '엘프의 눈물', type: 'mat', price: 200, desc: '희귀한 마법 재료', desc_stat: '재료' },
      // 상급 재료
      { name: '용의 심장', type: 'mat', price: 2000, desc: '드래곤의 핵심', desc_stat: '재료' },
      { name: '마왕의 혼', type: 'mat', price: 5000, desc: '최강의 재료', desc_stat: '재료' },
      { name: '미스릴 원석', type: 'mat', price: 500, desc: '가공되지 않은 미스릴', desc_stat: '재료' },
      { name: '오리할콘', type: 'mat', price: 1000, desc: '전설의 금속', desc_stat: '재료' },
      { name: '정령의 핵', type: 'mat', price: 800, desc: '원소 정령의 핵심', desc_stat: '재료' }
    ],
    prefixes: [
      { name: '날카로운', type: 'weapon', stat: 'atk', val: 3, price: 1.2 },
      { name: '묵직한', type: 'weapon', stat: 'atk', val: 5, price: 1.3 },
      { name: '불타는', type: 'weapon', stat: 'atk', val: 5, elem: '화염', price: 1.5 },
      { name: '얼어붙은', type: 'weapon', stat: 'atk', val: 5, elem: '냉기', price: 1.5 },
      { name: '맹독의', type: 'weapon', stat: 'atk', val: 4, elem: '자연', price: 1.4 },
      { name: '신성한', type: 'weapon', stat: 'atk', val: 7, elem: '빛', price: 1.8 },
      { name: '저주받은', type: 'weapon', stat: 'atk', val: 8, elem: '어둠', price: 1.9 },
      { name: '단단한', type: 'armor', stat: 'def', val: 2, price: 1.2 },
      { name: '수호의', type: 'armor', stat: 'def', val: 5, price: 1.4 },
      { name: '축복받은', type: 'all', stat: 'hp', val: 20, price: 2.0 },
      { name: '고대의', type: 'all', stat: 'all', val: 10, price: 2.5 }
    ],
    // 제작 레시피 (Phase 2.2 준비)
    recipes: [
      { id: 'r1', name: '강철 롱소드', inputs: [{ name: '철광석', qty: 5 }], gold: 100 },
      { id: 'r2', name: '사슬 갑옷', inputs: [{ name: '철광석', qty: 8 }], gold: 200 },
      { id: 'r3', name: '화염의 지팡이', inputs: [{ name: '나무지팡이', qty: 1 }, { name: '화염의 결정', qty: 3 }], gold: 300 },
      { id: 'r4', name: '미스릴검', inputs: [{ name: '미스릴 원석', qty: 3 }, { name: '철광석', qty: 5 }], gold: 500 },
      { id: 'r5', name: '중급 체력 물약', inputs: [{ name: '슬라임 젤리', qty: 5 }], gold: 30 },
      { id: 'r6', name: '해독제', inputs: [{ name: '자연의 결정', qty: 1 }], gold: 20 }
    ]
  },
  MAPS: {
    // 초반 지역 (Lv 1-10)
    '시작의 마을': { level: 1, type: 'safe', exits: ['고요한 숲', '서쪽 평원'], monsters: [], desc: '평화로운 시작의 마을입니다.', eventChance: 0 },
    '고요한 숲': { level: 1, type: 'dungeon', exits: ['시작의 마을', '잊혀진 폐허', '호수의 신전'], monsters: ['슬라임', '늑대', '숲의 정령', '거미떼'], desc: '새들의 지저귐 속에 긴장감이 감도는 숲입니다.', eventChance: 0.3 },
    '서쪽 평원': { level: 3, type: 'dungeon', exits: ['시작의 마을', '화염의 협곡', '사막 오아시스'], monsters: ['멧돼지', '들개', '코볼트', '초록슬라임'], desc: '넓은 초원이 펼쳐진 평화로운 지역입니다.', eventChance: 0.25 },
    '호수의 신전': { level: 5, type: 'dungeon', exits: ['고요한 숲'], monsters: ['물의 정령', '머맨', '거대 거북'], desc: '고대 수호신이 잠든 호수의 신전입니다.', eventChance: 0.35 },

    // 중반 지역 (Lv 5-20)
    '잊혀진 폐허': { level: 5, type: 'dungeon', exits: ['고요한 숲', '어둠의 동굴', '버려진 광산'], monsters: ['해골 병사', '고블린', '석상 가디언', '유령 기사'], desc: '오래된 문명의 흔적이 남아있는 폐허입니다.', eventChance: 0.3 },
    '버려진 광산': { level: 8, type: 'dungeon', exits: ['잊혀진 폐허'], monsters: ['광석골렘', '코볼트 광부', '광산 박쥐', '거대 지렁이'], desc: '금맥을 찾아 파헤쳐진 버려진 광산입니다.', eventChance: 0.35 },
    '어둠의 동굴': { level: 10, type: 'dungeon', exits: ['잊혀진 폐허', '암흑 성'], monsters: ['동굴 트롤', '박쥐 떼', '다크 엘프', '거대 지네', '암흑 마법사'], desc: '빛이 들지 않는 깊고 어두운 동굴입니다.', eventChance: 0.4 },

    // 화염 지역 (Lv 15-30)
    '화염의 협곡': { level: 15, type: 'dungeon', exits: ['서쪽 평원', '용의 둥지'], monsters: ['화염 정령', '용암 골렘', '파이어뱃', '화염 도마뱀'], desc: '뜨거운 용암이 흐르는 위험한 협곡입니다.', eventChance: 0.4 },
    '용의 둥지': { level: 25, type: 'dungeon', exits: ['화염의 협곡'], monsters: ['화염의 군주', '레드 드래곤', '화염 와이번', '드래곤 나이트'], desc: '용들이 거주하는 전설의 장소입니다.', eventChance: 0.5, boss: true },

    // 사막 지역 (Lv 15-25)
    '사막 오아시스': { level: 15, type: 'safe', exits: ['서쪽 평원', '피라미드'], monsters: [], desc: '사막 한가운데 있는 오아시스 마을입니다.', eventChance: 0 },
    '피라미드': { level: 20, type: 'dungeon', exits: ['사막 오아시스'], monsters: ['미라', '사막도적', '스핑크스', '아누비스 수호자'], desc: '고대 왕이 잠든 거대한 피라미드입니다.', eventChance: 0.45, boss: true },

    // 얼음 지역 (Lv 20-35)
    '얼음 성채': { level: 20, type: 'dungeon', exits: ['잊혀진 폐허', '빙하 심연'], monsters: ['프로스트 위치', '얼음 거인', '스노우 울프', '아이스 골렘'], desc: '영원히 얼어붙은 고대 성채입니다.', eventChance: 0.4 },
    '빙하 심연': { level: 30, type: 'dungeon', exits: ['얼음 성채'], monsters: ['아이스 드래곤', '빙결의 마녀', '서리 정령'], desc: '깊은 빙하 속에 숨겨진 심연입니다.', eventChance: 0.5, boss: true },

    // 최종 지역 (Lv 30-50)
    '암흑 성': { level: 30, type: 'dungeon', exits: ['어둠의 동굴', '마왕성'], monsters: ['데스나이트', '리치', '뱀파이어', '암흑 사제'], desc: '어둠의 세력이 지배하는 성입니다.', eventChance: 0.45 },
    '마왕성': { level: 40, type: 'dungeon', exits: ['암흑 성'], monsters: ['마왕의 사도', '지옥의 문지기', '타락한 천사', '마왕'], desc: '마왕이 군림하는 최종 목적지입니다.', eventChance: 0.5, boss: true }
  },
  LOOT_TABLE: {
    // 숲 지역
    '슬라임': ['슬라임 젤리', '하급 체력 물약'],
    '늑대': ['멧돼지 가죽', '하급 체력 물약'],
    '숲의 정령': ['자연의 결정', '하급 마나 물약'],
    '거미떼': ['슬라임 젤리', '해독제'],
    // 평원 지역
    '멧돼지': ['멧돼지 가죽', '여행자 튜닉'],
    '들개': ['멧돼지 가죽'],
    '코볼트': ['철광석', '녹슨 단검', '동전 주머니'],
    '초록슬라임': ['슬라임 젤리'],
    // 호수 지역
    '물의 정령': ['마나 결정', '중급 마나 물약'],
    '머맨': ['철광석', '하급 체력 물약'],
    '거대 거북': ['철광석', '가죽 갑옷'],
    // 폐허 지역
    '해골 병사': ['해골 뼈', '녹슨 단검'],
    '고블린': ['고블린 이빨', '동전 주머니'],
    '석상 가디언': ['철광석', '미스릴 원석'],
    '유령 기사': ['어둠의 정수', '사슬 갑옷'],
    // 광산 지역
    '광석골렘': ['철광석', '미스릴 원석'],
    '코볼트 광부': ['철광석', '동전 주머니'],
    '광산 박쥐': ['박쥐 날개'],
    '거대 지렁이': ['슬라임 젤리'],
    // 동굴 지역
    '동굴 트롤': ['트롤의 피', '전투도끼'],
    '박쥐 떼': ['박쥐 날개'],
    '다크 엘프': ['엘프의 눈물', '어둠의 정수'],
    '거대 지네': ['해독제', '독사의 송곳니'],
    '암흑 마법사': ['어둠의 정수', '마나 결정'],
    // 화염 지역
    '화염 정령': ['화염의 결정', '화염의 지팡이'],
    '용암 골렘': ['철광석', '화염의 결정'],
    '파이어뱃': ['박쥐 날개', '화염의 결정'],
    '화염 도마뱀': ['화염의 결정'],
    '화염의 군주': ['화염의 지팡이', '엘릭서', '용비늘갑옷', '용의 심장'],
    '레드 드래곤': ['용의 비늘', '용의 심장', '용살자의창'],
    '화염 와이번': ['용의 비늘', '화염의 결정'],
    '드래곤 나이트': ['용비늘갑옷', '미스릴검'],
    // 사막 지역
    '미라': ['해골 뼈', '저주해제 주문서'],
    '사막도적': ['동전 주머니', '암살자의 단검'],
    '스핑크스': ['빛의 결정', '대마법사로브'],
    '아누비스 수호자': ['어둠의 정수', '성기사의 갑주'],
    // 얼음 지역
    '프로스트 위치': ['냉기의 결정', '얼음 지팡이'],
    '얼음 거인': ['냉기의 결정', '오리할콘'],
    '스노우 울프': ['멧돼지 가죽', '냉기의 결정'],
    '아이스 골렘': ['냉기의 결정', '미스릴 원석'],
    '아이스 드래곤': ['용의 비늘', '냉기의 결정', '서리칼날'],
    '빙결의 마녀': ['냉기의 결정', '현자의 예복'],
    '서리 정령': ['냉기의 결정', '정령의 핵'],
    // 암흑 지역
    '데스나이트': ['어둠의 정수', '암흑의 대검'],
    '리치': ['어둠의 정수', '마나 결정', '혼돈의 지팡이'],
    '뱀파이어': ['어둠의 정수', '엘릭서'],
    '암흑 사제': ['어둠의 정수', '저주해제 주문서'],
    // 마왕성
    '마왕의 사도': ['어둠의 정수', '마나 결정'],
    '지옥의 문지기': ['어둠의 정수', '용비늘갑옷'],
    '타락한 천사': ['빛의 결정', '어둠의 정수', '천상의갑주'],
    '마왕': ['마왕의 혼', '마왕의 대낫', '성검 에테르니아', '엘릭서']
  },
  QUESTS: [
    // 초반 퀘스트 (Lv 1-10)
    { id: 1, title: '슬라임 소탕', desc: '슬라임 3마리 처치', target: '슬라임', goal: 3, reward: { exp: 50, gold: 100 }, minLv: 1 },
    { id: 2, title: '멧돼지 사냥', desc: '멧돼지 5마리 처치', target: '멧돼지', goal: 5, reward: { exp: 80, gold: 150 }, minLv: 2 },
    { id: 3, title: '광산의 위협', desc: '코볼트 5마리 처치', target: '코볼트', goal: 5, reward: { exp: 300, gold: 500, item: '강철 롱소드' }, minLv: 3 },
    { id: 4, title: '숲의 해충', desc: '거미떼 8마리 처치', target: '거미떼', goal: 8, reward: { exp: 200, gold: 250, item: '해독제' }, minLv: 3 },
    { id: 5, title: '호수의 수호자', desc: '물의 정령 5마리 처치', target: '물의 정령', goal: 5, reward: { exp: 350, gold: 400, item: '마나 결정' }, minLv: 5 },
    { id: 6, title: '폐허 탐험', desc: '해골 병사 10마리 처치', target: '해골 병사', goal: 10, reward: { exp: 500, gold: 600 }, minLv: 5 },
    { id: 7, title: '광산 정화', desc: '광석골렘 5마리 처치', target: '광석골렘', goal: 5, reward: { exp: 600, gold: 700, item: '미스릴 원석' }, minLv: 8 },
    { id: 10, title: '전직의 자격 (1차)', desc: '1차 전직을 위해 레벨 10 달성', target: 'Level', goal: 10, reward: { exp: 0, gold: 1000 }, minLv: 9 },
    // 중반 퀘스트 (Lv 10-25)
    { id: 11, title: '동굴 트롤 토벌', desc: '동굴 트롤 5마리 처치', target: '동굴 트롤', goal: 5, reward: { exp: 800, gold: 1000, item: '전투도끼' }, minLv: 10 },
    { id: 12, title: '사막의 무법자', desc: '사막도적 10마리 처치', target: '사막도적', goal: 10, reward: { exp: 1000, gold: 1500, item: '암살자의 단검' }, minLv: 15 },
    { id: 13, title: '화염의 시련', desc: '화염 정령 10마리 처치', target: '화염 정령', goal: 10, reward: { exp: 1200, gold: 1800, item: '화염의 결정' }, minLv: 15 },
    { id: 14, title: '피라미드의 비밀', desc: '미라 15마리 처치', target: '미라', goal: 15, reward: { exp: 1500, gold: 2000, item: '저주해제 주문서' }, minLv: 20 },
    { id: 15, title: '얼음 성채 정복', desc: '얼음 거인 5마리 처치', target: '얼음 거인', goal: 5, reward: { exp: 2000, gold: 2500, item: '냉기의 결정' }, minLv: 20 },
    // 고급 퀘스트 (Lv 25-40)
    { id: 20, title: '용의 둥지 습격', desc: '레드 드래곤 처치', target: '레드 드래곤', goal: 1, reward: { exp: 5000, gold: 8000, item: '용의 심장' }, minLv: 25 },
    { id: 21, title: '빙결의 마녀 토벌', desc: '빙결의 마녀 처치', target: '빙결의 마녀', goal: 1, reward: { exp: 6000, gold: 10000, item: '현자의 예복' }, minLv: 30 },
    { id: 22, title: '암흑 성 침공', desc: '데스나이트 10마리 처치', target: '데스나이트', goal: 10, reward: { exp: 4000, gold: 6000, item: '암흑의 대검' }, minLv: 30 },
    { id: 23, title: '리치 처단', desc: '리치 처치', target: '리치', goal: 1, reward: { exp: 7000, gold: 12000, item: '혼돈의 지팡이' }, minLv: 35 },
    { id: 30, title: '영웅의 길 (2차)', desc: '2차 전직을 위해 레벨 30 달성', target: 'Level', goal: 30, reward: { exp: 0, gold: 5000 }, minLv: 29 },
    // 최종 퀘스트 (Lv 40+)
    { id: 40, title: '마왕의 사도 척결', desc: '마왕의 사도 10마리 처치', target: '마왕의 사도', goal: 10, reward: { exp: 8000, gold: 15000 }, minLv: 40 },
    { id: 41, title: '타락한 천사', desc: '타락한 천사 처치', target: '타락한 천사', goal: 1, reward: { exp: 10000, gold: 20000, item: '천상의갑주' }, minLv: 45 },
    { id: 99, title: '마왕 토벌', desc: '최종 보스 마왕 처치', target: '마왕', goal: 1, reward: { exp: 50000, gold: 99999, item: '성검 에테르니아' }, minLv: 50 }
  ],
  ACHIEVEMENTS: [
    { id: 'ach_kill_10', title: '초보 사냥꾼', desc: '몬스터 10마리 처치', target: 'kills', goal: 10, reward: { gold: 200 } },
    { id: 'ach_kill_100', title: '학살자', desc: '몬스터 100마리 처치', target: 'kills', goal: 100, reward: { gold: 2000, item: '중급 체력 물약' } },
    { id: 'ach_gold_1000', title: '저축왕', desc: '누적 골드 1000G 달성', target: 'total_gold', goal: 1000, reward: { item: '하급 체력 물약' } },
    { id: 'ach_gold_10000', title: '갑부', desc: '누적 골드 10000G 달성', target: 'total_gold', goal: 10000, reward: { item: '엘릭서' } },
    { id: 'ach_lv_10', title: '성장의 기쁨', desc: '레벨 10 달성', target: 'level', goal: 10, reward: { item: '강철 롱소드' } },
    { id: 'ach_die_1', title: '죽음은 또 다른 시작', desc: '최초 사망 달성', target: 'deaths', goal: 1, reward: { gold: 100 } }
  ],
  MONSTER_PREFIXES: [
    { name: '허약한', mod: 0.7, expMod: 0.7 },
    { name: '일반적인', mod: 1.0, expMod: 1.0 },
    { name: '날렵한', mod: 1.1, expMod: 1.1 },
    { name: '단단한', mod: 1.2, expMod: 1.2 },
    { name: '광폭한', mod: 1.3, expMod: 1.4 },
    { name: '거대', mod: 1.5, expMod: 1.6 },
    { name: '고대', mod: 1.8, expMod: 2.0 },
  ]
};

// Freeze static data
Object.freeze(CONSTANTS);
Object.freeze(DB);

// Utility: JSON File Export
const exportToJson = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Utility: Exponential Backoff Fetch
const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Status: ${res.status} `);
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
};

/* ======================================================================================================================
   LAYER 1.5: AI SERVICE
   ====================================================================================================================== */
const AI_SERVICE = {
  getFallback: (type, data) => {
    const templates = {
      encounter: `⚠️[${data.loc}]의 어둠 속에서[${data.name}]이(가) 나타났습니다!`,
      victory: `🎉[${data.name}]에게 결정타를 날렸습니다! 승리!`,
      death: `💀[${data.player?.name || '당신'}]의 의식이 흐려집니다...`,
      levelUp: `✨ 새로운 힘이 깨어납니다! 레벨 ${data.level} 달성!`,
      rest: `💤[${data.loc}]에서 편안한 휴식을 취했습니다.체력이 회복됩니다.`
    };
    return templates[type] || "운명의 수레바퀴가 돌기 시작합니다.";
  },
  generateEvent: async (loc, history = [], uid = 'anonymous') => {
    // v3.5: Check quota before making AI call
    if (!TokenQuotaManager.canMakeAICall()) {
      console.warn(TokenQuotaManager.getExhaustedMessage());
      return { exhausted: true, message: TokenQuotaManager.getExhaustedMessage() };
    }

    // v3.4: Use proxy for secure API key handling
    if (CONSTANTS.USE_AI_PROXY) {
      try {
        // v4.0: Cross-Cloud Security (Auth Token)
        const token = await auth.currentUser?.getIdToken();
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        // v3.5: Track latency
        const result = await LatencyTracker.trackCall(async () => {
          const response = await fetch(CONSTANTS.AI_PROXY_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ type: 'event', data: { location: loc, history, uid } })
          });
          if (response.ok) {
            return await response.json();
          }
          return null;
        }, 'ai-event');

        if (result?.success) {
          TokenQuotaManager.recordCall(); // Record successful call
          return result.data;
        }
      } catch (e) {
        console.warn('AI proxy unavailable:', e.message);
      }
    }
    // Fallback: No direct API call (API key removed from client)
    return null;
  },
  generateStory: async (type, data, uid = 'anonymous') => {
    // v3.5: Check quota
    if (!TokenQuotaManager.canMakeAICall()) {
      return AI_SERVICE.getFallback(type, data);
    }

    // v3.4: Use proxy for secure API key handling
    if (CONSTANTS.USE_AI_PROXY) {
      try {
        // v4.0: Cross-Cloud Security (Auth Token)
        const token = await auth.currentUser?.getIdToken();
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        // v3.5: Track latency
        const result = await LatencyTracker.trackCall(async () => {
          const response = await fetch(CONSTANTS.AI_PROXY_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ type: 'story', data: { storyType: type, ...data, uid } })
          });
          if (response.ok) {
            return await response.json();
          }
          return null;
        }, 'ai-story');

        if (result?.success && result.data?.narrative) {
          TokenQuotaManager.recordCall(); // Record successful call
          return result.data.narrative;
        }
      } catch (e) {
        console.warn('AI proxy unavailable for story:', e.message);
      }
    }
    // Fallback: Use local templates
    return AI_SERVICE.getFallback(type, data);
  }
};


/* ======================================================================================================================
   LAYER 2: GAME ENGINE (DOMAIN)
   ====================================================================================================================== */

// Milestone Utility
const checkMilestones = (killRegistry, lastKillName, player) => {
  const rewards = [];
  const count = killRegistry[lastKillName] || 0;

  // 1. Monster Count Milestones
  if (count === 10) rewards.push({ type: 'gold', val: 100, msg: `🥉 [${lastKillName}] 사냥꾼 (10마리 처치)` });
  if (count === 50) rewards.push({ type: 'item', val: '하급 체력 물약', msg: `🥈 [${lastKillName}] 학살자 (50마리 처치)` });
  if (count === 100) rewards.push({ type: 'item', val: '강철 롱소드', msg: `🥇 [${lastKillName}] 지배자 (100마리 처치)` });

  // 2. Boss Milestones
  // Simple check: if name is in a boss list (manual for now, or based on stats)
  // Let's assume high EXP (>200) monsters are bosses for simplicity in this MVP logic or use manual list
  const bosses = ['화염의 군주', '마왕', '다크 엘프', '동굴 트롤', '맹독히드라'];
  if (bosses.includes(lastKillName)) {
    if (count === 1) rewards.push({ type: 'title', val: `[${lastKillName}] 처치자`, msg: `👑 [${lastKillName}] 최초 처치!` });
    if (count === 5) rewards.push({ type: 'gold', val: 5000, msg: `👑 [${lastKillName}] 숙련자 (5회 처치)` });
  }

  return rewards;
};

// Data Migration Utility
const migrateData = (savedData) => {
  if (!savedData) return null;
  // Version 2.7 Migration
  if (!savedData.version || savedData.version < 2.7) {
    savedData.version = 2.7;
    savedData.mp = savedData.mp ?? 50;
    savedData.maxMp = savedData.maxMp ?? 50;
    savedData.history = savedData.history || [];
    savedData.archivedHistory = savedData.archivedHistory || [];
    // New stats for v3.1
    savedData.stats = savedData.stats || { kills: 0, total_gold: 0, deaths: 0 };
    savedData.stats.killRegistry = savedData.stats.killRegistry || {};
    savedData.stats.bossKills = savedData.stats.bossKills || 0;
  }
  // Ensure equip is object not string (Old version compatibility)
  if (typeof savedData.equip?.weapon === 'string') {
    savedData.equip.weapon = DB.ITEMS.weapons.find(w => w.name === savedData.equip.weapon) || DB.ITEMS.weapons[0];
  }
  if (typeof savedData.equip?.armor === 'string') {
    savedData.equip.armor = DB.ITEMS.armors.find(a => a.name === savedData.equip.armor) || DB.ITEMS.armors[0];
  }
  return savedData;
};

// INITIAL STATE
const INITIAL_STATE = {
  player: {
    name: '방랑자', job: '모험가', level: 1, hp: 150, maxHp: 150, mp: 50, maxMp: 50, atk: 10, def: 5, exp: 0, nextExp: 100, gold: 500, loc: '시작의 마을',
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0] },
    quests: [], achievements: [], stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
    tempBuff: { atk: 0, turn: 0 }, status: [],
    history: [], archivedHistory: [] // Telemetry Ledger
  },
  version: 2.7,
  gameState: 'idle',
  logs: [],
  enemy: null,
  currentEvent: null,
  grave: null,
  shopItems: [],
  sideTab: 'inventory',
  isAiThinking: false,
  visualEffect: null, // 'shake', 'flash', etc
  syncStatus: 'offline', // 'offline', 'syncing', 'synced'
  uid: null,
  leaderboard: [],
  liveConfig: { eventMultiplier: 1, announcement: '' } // Live-Ops
};

// REDUCER
const gameReducer = (state, action) => {
  switch (action.type) {
    case 'INIT_PLAYER':
      return { ...state, player: { ...state.player, ...action.payload }, syncStatus: 'synced' };
    case 'SET_UID':
      return { ...state, uid: action.payload };
    case 'SET_LEADERBOARD':
      return { ...state, leaderboard: action.payload };
    case 'SET_LIVE_CONFIG':
      return { ...state, liveConfig: { ...state.liveConfig, ...action.payload } };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload, syncStatus: 'syncing' };
    case 'SET_PLAYER': // Generic updater
      const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
      return { ...state, player: { ...state.player, ...nextPlayer }, syncStatus: 'syncing' };
    case 'SET_EVENT':
      return { ...state, currentEvent: action.payload, syncStatus: 'syncing' };
    case 'SET_SHOP_ITEMS':
      return { ...state, shopItems: action.payload };
    case 'SET_SIDE_TAB':
      return { ...state, sideTab: action.payload };
    case 'SET_AI_THINKING':
      return { ...state, isAiThinking: action.payload };
    case 'SET_VISUAL_EFFECT':
      return { ...state, visualEffect: action.payload };
    case 'ADD_LOG': // Logs are not synced to main doc constantly to save writes, only when special events occur? 
      // Actually, let's keep it simple. Local log state.
      return { ...state, logs: [...state.logs, { id: Date.now() + Math.random(), ...action.payload }] };
    case 'UPDATE_LOG':
      return { ...state, logs: state.logs.map(l => l.id === action.payload.id ? action.payload.log : l) };
    case 'SET_ENEMY':
      return { ...state, enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload, syncStatus: 'syncing' };
    case 'SET_GRAVE':
      return { ...state, grave: action.payload, syncStatus: 'syncing' };
    case 'RESET_GAME':
      return { ...INITIAL_STATE, logs: [], uid: state.uid, syncStatus: 'synced' }; // Keep UID
    default:
      return state;
  }
};

const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const { player, gameState, logs, enemy, grave, shopItems, sideTab, isAiThinking, currentEvent, visualEffect, syncStatus, uid, leaderboard, liveConfig } = state;
  const logIdCounter = useRef(0);

  // --- LIVE CONFIG (Remote Config) ---
  useEffect(() => {
    const configDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config');
    const unsubscribe = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        dispatch({ type: 'SET_LIVE_CONFIG', payload: docSnap.data() });
      }
    }, (err) => console.error("LiveConfig Error", err));
    return () => unsubscribe();
  }, []);

  // --- CLOUD PERSISTENCE ---

  // 1. Auth
  useEffect(() => {
    signInAnonymously(auth)
      .then((creds) => {
        dispatch({ type: 'SET_UID', payload: creds.user.uid });
        console.log("Signed in as", creds.user.uid);
      })
      .catch((error) => {
        console.error("Auth Error", error);
        dispatch({ type: 'ADD_LOG', payload: { type: 'error', text: '클라우드 연결 실패. 오프라인 모드로 전환합니다.' } });
      });
  }, []);

  // 2. Data Sync (Firestore)
  useEffect(() => {
    if (!uid) return;

    const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        // Remote data exists, load it
        const remoteData = docSnap.data();
        // We only init if we are effectively "loading" or if remote changed significantly?
        // For simplicity in this architecture, we trust remote > local if remote exists on load.
        // NOTE: Real-time listeners can can cause loops if we update local -> saves -> triggers listener -> updates local.
        // 'hasPendingWrites' can help, or compare timestamps. 
        // For this MVP, we will only INIT on first load of the session, then mainly PUSH.
        // However, onSnapshot fires on local writes too (latency comp).
        if (!docSnap.metadata.hasPendingWrites) {
          // It's a remote update. Assuming single device for now, but good practice.
          // We won't force-overwrite state on every snapshot to avoid jitter, 
          // but we should set 'synced' status.
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
          // Only load if player data is default or significantly different
          if (state.player.name === INITIAL_STATE.player.name && state.player.level === INITIAL_STATE.player.level) {
            dispatch({ type: 'INIT_PLAYER', payload: remoteData.player });
            dispatch({ type: 'SET_GAME_STATE', payload: remoteData.gameState });
            dispatch({ type: 'SET_ENEMY', payload: remoteData.enemy });
            dispatch({ type: 'SET_GRAVE', payload: remoteData.grave });
            dispatch({ type: 'SET_EVENT', payload: remoteData.currentEvent });
          }
        }
      } else {
        // No remote data. Check Migration.
        const localData = localStorage.getItem(CONSTANTS.SAVE_KEY);
        if (localData) {
          try {
            const migrated = migrateData(JSON.parse(localData));
            setDoc(userDocRef, {
              player: migrated,
              gameState: INITIAL_STATE.gameState,
              enemy: INITIAL_STATE.enemy,
              grave: INITIAL_STATE.grave,
              currentEvent: INITIAL_STATE.currentEvent,
              version: CONSTANTS.DATA_VERSION,
              lastActive: serverTimestamp()
            });
            dispatch({ type: 'INIT_PLAYER', payload: migrated });
            // Clear local? localStorage.removeItem(CONSTANTS.SAVE_KEY); 
          } catch (e) { console.error("Migration Failed", e); }
        } else {
          // New User
          setDoc(userDocRef, {
            player: INITIAL_STATE.player,
            gameState: INITIAL_STATE.gameState,
            enemy: INITIAL_STATE.enemy,
            grave: INITIAL_STATE.grave,
            currentEvent: INITIAL_STATE.currentEvent,
            version: CONSTANTS.DATA_VERSION,
            lastActive: serverTimestamp()
          });
        }
      }
    }, (error) => {
      console.error("Sync Error", error);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
    });

    return () => unsubscribe();
  }, [uid]);

  // 3. Save (Debounced or Event-driven)
  // We use syncStatus 'syncing' to trigger saves.
  useEffect(() => {
    if (!uid || syncStatus !== 'syncing') return;

    const saveData = async () => {
      try {
        const userDocRef = doc(db, 'artifacts', APP_ID, 'users', uid);
        // Sanitize: Don't save logs or shopItems to user doc if not needed.
        // We save: player, gameState, enemy, grave, currentEvent.
        const payload = {
          player: player,
          gameState: gameState,
          enemy: enemy,
          grave: grave,
          currentEvent: currentEvent,
          version: CONSTANTS.DATA_VERSION,
          lastActive: serverTimestamp()
        };

        // Archive History Check
        // If archivedHistory has items, push them to subcollection and clear from main payload
        if (player.archivedHistory && player.archivedHistory.length > 0) {
          const historyCol = collection(userDocRef, 'history');
          const batchPromises = player.archivedHistory.map(h => addDoc(historyCol, h));
          await Promise.all(batchPromises);
          payload.player.archivedHistory = []; // Clear after upload
        }

        await setDoc(userDocRef, payload, { merge: true });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' });
      } catch (e) {
        console.error("Save Error", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
      }
    };

    const timer = setTimeout(saveData, 1000); // 1s Debounce
    return () => clearTimeout(timer);
  }, [uid, player, gameState, enemy, grave, currentEvent, syncStatus]);

  // 4. Leaderboard Fetching (On Mount & Events)
  const fetchLeaderboard = async () => {
    try {
      // Path: /artifacts/{appId}/public/data/leaderboard (Collection, NOT Doc)
      // Actually, per requirement: /artifacts/{appId}/public/data/leaderboard is collection.
      const lbRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard');
      const q = query(lbRef, orderBy('totalKills', 'desc'), limit(50)); // Optimized: 20 instead of 10
      const querySnapshot = await getDocs(q);
      const lbData = [];
      querySnapshot.forEach((doc) => {
        lbData.push(doc.data());
      });
      dispatch({ type: 'SET_LEADERBOARD', payload: lbData });
    } catch (e) {
      console.error("Leaderboard Fetch Error", e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []); // Refresh on mount

  // --- CORE MECHANICS ---
  const addLog = (type, text) => {
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_LOG', payload: { type, text, id, timestamp: Date.now() } });
    return id; // Return ID for updates
  };

  const addStoryLog = async (type, data) => {
    dispatch({ type: 'SET_AI_THINKING', payload: true });
    const tempId = Date.now();
    dispatch({ type: 'ADD_LOG', payload: { type: 'loading', text: '...', id: tempId } });

    // Inject Player History
    const enrichedData = { ...data, history: player.history };

    const text = await AI_SERVICE.generateStory(type, enrichedData, uid);

    dispatch({ type: 'UPDATE_LOG', payload: { id: tempId, log: { id: tempId, type: 'story', text } } });
    dispatch({ type: 'SET_AI_THINKING', payload: false });
  };

  const getFullStats = () => {
    const cls = DB.CLASSES[player.job];
    const wVal = player.equip.weapon?.val || 0;
    const aVal = player.equip.armor?.val || 0;
    const buff = player.tempBuff.turn > 0 ? (player.atk * 0.5) : 0;
    return {
      atk: Math.floor((player.atk + wVal + buff) * cls.atkMod),
      def: player.def + aVal,
      elem: player.equip.weapon?.elem || '물리'
    };
  };

  const generateDrop = (baseName) => {
    // Consolidated drop logic
    const allItems = [...DB.ITEMS.weapons, ...DB.ITEMS.armors, ...DB.ITEMS.consumables, ...DB.ITEMS.materials];
    const base = allItems.find(i => i.name === baseName);
    if (!base) return null;

    // 20% Chance for Prefix (Weapons/Armor only)
    if ((base.type === 'weapon' || base.type === 'armor') && Math.random() < 0.2) {
      const validPrefixes = DB.ITEMS.prefixes.filter(p => p.type === 'all' || p.type === base.type);
      if (validPrefixes.length > 0) {
        const prefix = validPrefixes[Math.floor(Math.random() * validPrefixes.length)];
        return {
          ...base,
          name: `${prefix.name} ${base.name}`,
          val: base.val + prefix.val,
          price: Math.floor(base.price * prefix.price),
          desc_stat: `${base.desc_stat.split('+')[0]}+${base.val + prefix.val}`,
          elem: prefix.elem || base.elem
        };
      }
    }
    return { ...base };
  };

  // --- ACTIONS ---
  // FSM & GUARD: Ensure actions are only callable in correct states
  const actions = {
    start: (name) => {
      dispatch({ type: 'SET_PLAYER', payload: { name: name.trim() || '방랑자' } });
      addLog('system', `환영합니다, ${name}님.`);
    },
    reset: () => {
      if (!window.confirm("초기화 하시겠습니까?")) return;
      localStorage.removeItem(CONSTANTS.SAVE_KEY);
      dispatch({ type: 'RESET_GAME' });
    },
    move: (loc) => {
      if (gameState === 'combat') return addLog('error', '⚠️ 전투 중에는 이동할 수 없습니다!');
      if (gameState === 'shop') return addLog('error', '⚠️ 상점을 먼저 나가주세요.');

      if (!DB.MAPS[player.loc].exits.includes(loc) && loc !== '시작의 마을') return addLog('error', '🚫 갈 수 없는 곳입니다.');

      dispatch({ type: 'SET_PLAYER', payload: { loc } });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
      addLog('success', `👣 ${loc} 도착.`);
      addLog('system', DB.MAPS[loc].desc);
      if (grave && grave.loc === loc) addLog('event', '⚰️ 유해가 발견되었습니다.');
    },
    explore: async () => {
      if (gameState !== 'idle') return addLog('error', '🚫 지금은 탐색할 수 없습니다.');
      if (player.loc === '시작의 마을') return addLog('info', '마을에서는 탐색할 수 없습니다.');

      const mapData = DB.MAPS[player.loc];

      // DynaEvent Trigger
      if (Math.random() < (mapData.eventChance || 0)) {
        dispatch({ type: 'SET_GAME_STATE', payload: 'event' });
        dispatch({ type: 'SET_AI_THINKING', payload: true });
        addLog('loading', '❓ 기이한 기운이 느껴집니다...');
        const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid);
        dispatch({ type: 'SET_AI_THINKING', payload: false });

        if (eventData && eventData.desc && eventData.choices) {
          dispatch({ type: 'SET_EVENT', payload: eventData });
          addLog('event', eventData.desc);
        } else {
          // Fallback if AI fails
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' }); // Fallback to idle if event generation fails
          addLog('info', '아무것도 발견하지 못했습니다.');
        }
        return;
      }

      if (Math.random() < 0.3) {
        addLog('info', '아무것도 발견하지 못했습니다.');
      } else {
        // Spawn Monster
        const mName = mapData.monsters[Math.floor(Math.random() * mapData.monsters.length)];

        const monStats = { name: mName, hp: 100 + (mapData.level * 20), maxHp: 100 + (mapData.level * 20), atk: 10 + (mapData.level * 2), exp: 10 + mapData.level * 5, gold: 10 + mapData.level * 2, turn: 0 };

        dispatch({ type: 'SET_ENEMY', payload: monStats });
        dispatch({ type: 'SET_GAME_STATE', payload: 'combat' });
        addLog('combat', `⚠️ [${mName}] 출현!`);
        addStoryLog('encounter', { loc: player.loc, name: mName });
      }
    },
    handleEventChoice: (idx) => {
      if (!currentEvent) return;
      const outcome = Math.random();
      let resultLog = "";
      let resultType = "success";

      if (outcome > 0.4) { // Success
        const rewardGold = player.level * 50;
        const rewardExp = player.level * 20;
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + rewardGold, exp: p.exp + rewardExp }) });
        resultLog = `성공! ${rewardGold}G와 ${rewardExp}EXP를 얻었습니다.`;
        resultType = "success";
        addLog('success', resultLog);
      } else { // Fail
        const dmg = Math.floor(player.maxHp * 0.1);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(1, p.hp - dmg) }) });
        resultLog = `실패... ${dmg}의 피해를 입었습니다.`;
        resultType = "error";
        addLog('error', resultLog);
      }

      // Feature: History Ledger & Archiving
      let newHistory = [...player.history, { timestamp: Date.now(), event: currentEvent.desc, choice: currentEvent.choices[idx], outcome: resultLog, type: resultType }];
      let newArchived = player.archivedHistory || [];

      if (newHistory.length > 50) {
        const overflow = newHistory.shift(); // Remove oldest
        newArchived = [...newArchived, overflow]; // Archive it
      }

      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, history: newHistory, archivedHistory: newArchived }) });

      dispatch({ type: 'SET_EVENT', payload: null });
      dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
    },
    rest: () => {
      if (gameState !== 'idle') return;
      const cost = player.level * 10;

      const mapData = DB.MAPS[player.loc];
      if (mapData.type !== 'safe') return addLog('error', '⚠️ 휴식은 안전한 지역(마을)에서만 가능합니다.');

      if (player.gold < cost) return addLog('error', `🚫 골드가 부족합니다! (필요: ${cost}G)`);

      dispatch({
        type: 'SET_PLAYER', payload: p => ({
          ...p,
          gold: p.gold - cost,
          hp: p.maxHp,
          mp: p.maxMp,
        })
      });
      addLog('success', `💤 푹 쉬었습니다. 체력과 마력이 모두 회복되었습니다. (-${cost}G)`);
      addStoryLog('rest', { loc: player.loc });
    },
    combat: (type) => {
      if (gameState !== 'combat' || !enemy) return addLog('error', '전투 중이 아닙니다.');

      const stats = getFullStats();

      // Skill MP Check
      if (type === 'skill') {
        const mpCost = 10;
        if (player.mp < mpCost) {
          return addLog('error', `🚫 마나가 부족합니다! (필요: ${mpCost})`);
        }
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, mp: p.mp - mpCost }) });
      }

      if (type === 'escape') {
        if (Math.random() < 0.5) {
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          dispatch({ type: 'SET_ENEMY', payload: null });
          addLog('info', '🏃‍♂️ 도망쳤습니다!');
        } else {
          addLog('error', '🚫 도망 실패!');
          const enemyDmg = Math.max(1, enemy.atk - stats.def);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
          addLog('warning', `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.`);
          dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
          setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 500);
        }
        return;
      }

      if (type === 'attack' || type === 'skill') {
        let mult = type === 'skill' ? 1.5 : 1.0;
        let isCrit = Math.random() < 0.1;
        if (isCrit) {
          mult *= 2.0;
          dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
          setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 500);
        }

        const dmg = Math.floor(stats.atk * (0.9 + Math.random() * 0.2) * mult);
        const newHp = enemy.hp - dmg;

        let logText = `⚔️ ${enemy.name}에게 ${dmg} 피해!`;
        if (isCrit) logText = `⚡ 치명타! ${enemy.name}에게 ${dmg} 피해!`;

        addLog(isCrit ? 'critical' : 'combat', logText);

        if (newHp <= 0) {
          // Victory...
          dispatch({ type: 'SET_ENEMY', payload: null });
          dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, exp: p.exp + Math.floor(enemy.exp * (liveConfig?.eventMultiplier || 1)), gold: p.gold + enemy.gold }) });
          addLog('success', `🎉 승리! EXP +${enemy.exp}, Gold +${enemy.gold}`);
          addStoryLog('victory', { name: enemy.name });

          // --- MILESTONE & RANKING LOGIC ---
          // 1. Update Registry
          const currentRegistry = player.stats.killRegistry || {};
          const newCount = (currentRegistry[enemy.name] || 0) + 1;
          const newRegistry = { ...currentRegistry, [enemy.name]: newCount };

          // 2. Check Milestones
          const milestones = checkMilestones(newRegistry, enemy.name, player);
          milestones.forEach(m => {
            addLog('event', m.msg);
            if (m.type === 'item') {
              const item = generateDrop(m.val);
              if (item) dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, inv: [...p.inv, item] }) });
            }
            if (m.type === 'gold') {
              dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + m.val }) });
            }
          });

          // 3. Update Stats & Player
          dispatch({
            type: 'SET_PLAYER', payload: p => ({
              ...p,
              stats: {
                ...p.stats,
                kills: p.stats.kills + 1,
                killRegistry: newRegistry,
                bossKills: (['화염의 군주', '마왕'].includes(enemy.name)) ? (p.stats.bossKills || 0) + 1 : (p.stats.bossKills || 0)
              }
            })
          });

          // 4. Update Global Leaderboard (Fire & Forget)
          if (uid) {
            const lbDoc = doc(db, 'artifacts', APP_ID, 'public', 'data', 'leaderboard', uid);
            // We calculate new values based on current state + this kill
            // Note: state.player.stats is OLD state here. 
            const newTotalKills = player.stats.kills + 1;
            const newBossKills = (['화염의 군주', '마왕'].includes(enemy.name)) ? (player.stats.bossKills || 0) + 1 : (player.stats.bossKills || 0);

            setDoc(lbDoc, {
              nickname: player.name,
              job: player.job,
              level: player.level,
              totalKills: newTotalKills,
              bossKills: newBossKills,
              lastUpdate: serverTimestamp()
            }, { merge: true }).catch(e => console.error("LB Update Failed", e));

            // Visual Feedback
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'ranking_update' });
            setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'synced' }), 2000);

            // Refresh local leaderboard occasionally? Or wait for effect?
            // Let's refresh it casually
            if (Math.random() < 0.2) fetchLeaderboard();
          }

          // Drop logic...
          const dropTable = DB.LOOT_TABLE[enemy.name];
          if (dropTable && Math.random() < 0.4) {
            const dropName = dropTable[Math.floor(Math.random() * dropTable.length)];
            const item = generateDrop(dropName);
            if (item) {
              dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, inv: [...p.inv, item] }) });
            }
          }
        } else {
          dispatch({ type: 'SET_ENEMY', payload: prev => ({ ...prev, hp: newHp }) });
          const enemyDmg = Math.max(1, enemy.atk - stats.def);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.max(0, p.hp - enemyDmg) }) });
          addLog('warning', `💥 ${enemy.name}의 반격! ${enemyDmg} 피해.`);
          // Death check...
          if ((player.hp - enemyDmg) <= 0) {
            dispatch({ type: 'SET_PLAYER', payload: { hp: player.maxHp, gold: Math.floor(player.gold * 0.9), loc: '시작의 마을', exp: 0 } });
            dispatch({ type: 'SET_GAME_STATE', payload: 'idle' });
            dispatch({ type: 'SET_ENEMY', payload: null });
            addLog('error', '💀 사망했습니다. 마을에서 부활합니다.');
            addStoryLog('death', {});
            dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'shake' });
            setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 1000);
          }
        }
      }
    },
    market: (type, item) => {
      if (gameState !== 'shop') return addLog('error', '상점을 이용할 수 없는 상태입니다.');
      if (type === 'buy') {
        if (player.gold >= item.price) {
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - item.price, inv: [...p.inv, generateDrop(item.name)] }) });
          addLog('success', `💰 ${item.name} 구매 완료.`);
        } else addLog('error', '골드가 부족합니다.');
      } else if (type === 'sell') {
        const idx = player.inv.findIndex(i => i === item);
        if (idx > -1) {
          const newInv = [...player.inv];
          newInv.splice(idx, 1);
          dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + Math.floor(item.price / 2), inv: newInv }) });
          addLog('success', `💰 ${item.name} 판매 완료.`);
        }
      }
    },
    useItem: (item) => {
      if (gameState === 'combat') return addLog('error', '전투 중에는 장비를 변경하거나 사용할 수 없습니다.'); // Strict Combat Lock

      const idx = player.inv.findIndex(i => i === item);
      if (idx === -1) return;

      if (item.type === 'hp') {
        const newInv = [...player.inv];
        newInv.splice(idx, 1);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, hp: Math.min(p.maxHp, p.hp + item.val), inv: newInv }) });
        addLog('success', `🧪 ${item.name} 사용.`);
      } else if (item.type === 'weapon' || item.type === 'armor') {
        // Data Integrity Check
        if (item.jobs && !item.jobs.includes(player.job)) {
          return addLog('error', `🚫 [${player.job}] 직업은 착용할 수 없습니다.`);
        }
        if (item.tier > DB.CLASSES[player.job].tier + 1) { // Implicit tier check possibility
          // Optional advanced check
        }

        const newInv = [...player.inv];
        newInv.splice(idx, 1);
        if (player.equip[item.type]) newInv.push(player.equip[item.type]);
        dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, equip: { ...p.equip, [item.type]: item }, inv: newInv }) });
        addLog('success', `🛡️ ${item.name} 장착.`);
      }
    },
    jobChange: (jobName) => {
      if (gameState !== 'job_change') return;
      dispatch({ type: 'SET_PLAYER', payload: { job: jobName } });
      addLog('success', `✨ ${jobName} 전직 완료!`);
      addStoryLog('jobChange', { job: jobName });
    },
    acceptQuest: (qId) => {
      if (gameState !== 'quest_board') return;
      const qData = DB.QUESTS.find(q => q.id === qId);
      if (!qData) return;
      if (player.quests.some(q => q.id === qId)) return addLog('error', '이미 수락한 퀘스트입니다.');
      if (player.level < qData.minLv) return addLog('error', '레벨이 부족합니다.');

      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, quests: [...p.quests, { id: qId, progress: 0, completed: false }] }) });
      addLog('event', `📜 퀘스트 수락: ${qData.title}`);
      dispatch({ type: 'SET_SIDE_TAB', payload: 'quest' });
    },
    lootGrave: () => {
      if (gameState === 'combat') return addLog('error', '전투 중에는 할 수 없습니다.');
      if (!grave || grave.loc !== player.loc) return addLog('info', '회수할 유해가 없습니다.');
      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold + grave.gold, inv: grave.item ? [...p.inv, grave.item] : p.inv }) });
      addLog('success', `유해를 수습했습니다. (${grave.gold}G${grave.item ? ', ' + grave.item.name : ''})`);
      dispatch({ type: 'SET_GRAVE', payload: null });
    },
    // Crafting System (Phase 2.2)
    craft: (recipeId) => {
      if (gameState !== 'crafting') return addLog('error', '제작소를 먼저 열어주세요.');
      const recipe = DB.ITEMS.recipes?.find(r => r.id === recipeId);
      if (!recipe) return addLog('error', '잘못된 레시피입니다.');

      // Check gold
      if (player.gold < recipe.gold) return addLog('error', `골드가 부족합니다. (필요: ${recipe.gold}G)`);

      // Check materials
      for (const input of recipe.inputs) {
        const count = player.inv.filter(i => i.name === input.name).length;
        if (count < input.qty) {
          return addLog('error', `재료 부족: ${input.name} ${input.qty}개 필요 (보유: ${count}개)`);
        }
      }

      // Deduct materials and gold
      let newInv = [...player.inv];
      for (const input of recipe.inputs) {
        let remaining = input.qty;
        newInv = newInv.filter(item => {
          if (item.name === input.name && remaining > 0) {
            remaining--;
            return false;
          }
          return true;
        });
      }

      // Create output item
      const outputItem = generateDrop(recipe.name);
      if (outputItem) {
        newInv.push(outputItem);
      }

      dispatch({ type: 'SET_PLAYER', payload: p => ({ ...p, gold: p.gold - recipe.gold, inv: newInv }) });
      addLog('success', `🔨 ${recipe.name} 제작 완료!`);
      dispatch({ type: 'SET_VISUAL_EFFECT', payload: 'flash' });
      setTimeout(() => dispatch({ type: 'SET_VISUAL_EFFECT', payload: null }), 300);
    },
    // Engine Utils exposed for UI
    setGameState: (val) => dispatch({ type: 'SET_GAME_STATE', payload: val }),
    setSideTab: (val) => dispatch({ type: 'SET_SIDE_TAB', payload: val }),
    setShopItems: (val) => dispatch({ type: 'SET_SHOP_ITEMS', payload: val }),
  };

  return {
    player, gameState, logs, enemy, actions, getFullStats, sideTab, grave, shopItems, isAiThinking,
    currentEvent,
    visualEffect,
    syncStatus,
    leaderboard,
    liveConfig,
    getUid: () => uid,
    isAdmin: () => ADMIN_UIDS.includes(uid)
  };
};

/* ======================================================================================================================
   LAYER 3: PRESENTATION (UI)
   ====================================================================================================================== */

const MainLayout = ({ children, visualEffect }) => (
  <div className={`flex flex-col h-screen bg-slate-950 text-slate-200 font-mono p-2 md:p-4 overflow-hidden relative ${visualEffect === 'shake' ? 'animate-shake' : ''}`}>
    {children}
    <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; background: #1e293b; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; radius: 4px; }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
    `}</style>
  </div>
);

const TerminalView = ({ logs, gameState }) => {
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [logs]);

  // Contextual Background Transition
  const bgClass = gameState === 'event'
    ? "bg-purple-950/20 border-purple-800/50"
    : "bg-black/80 border-slate-800";

  return (
    <div className={`flex-1 ${bgClass} border rounded-lg p-4 relative shadow-2xl overflow-y-auto custom-scrollbar font-mono transition-colors duration-1000`}>
      {logs.map((log) => {
        let logStyle = "text-slate-300";
        let bgStyle = "transparent";
        let anim = "";
        if (log.type === 'combat') { logStyle = "text-red-400"; bgStyle = "bg-red-900/10"; }
        if (log.type === 'critical') { logStyle = "text-red-500 font-bold text-lg"; bgStyle = "bg-red-950/40"; anim = "animate-bounce"; }
        if (log.type === 'story') { logStyle = "text-emerald-300 italic"; bgStyle = "bg-emerald-900/10 border-l-2 border-emerald-500 pl-2"; }
        if (log.type === 'system') logStyle = "text-blue-300 font-bold";
        if (log.type === 'error') { logStyle = "text-red-500 font-bold"; bgStyle = "bg-red-950/30"; }
        if (log.type === 'success') logStyle = "text-yellow-400";
        if (log.type === 'event') logStyle = "text-purple-400";
        if (log.type === 'loading') logStyle = "text-slate-500 animate-pulse";
        if (log.type === 'warning') logStyle = "text-orange-400";

        return (
          <div key={log.id} className={`text-sm mb-1 p-1 rounded ${logStyle} ${bgStyle} ${anim}`}>
            {log.type === 'story' && <Bot size={14} className="inline mr-2" />}
            {log.text}
          </div>
        );
      })}
      {logs.length > 0 && logs[logs.length - 1].type === 'loading' && <div className="text-xs text-slate-600 animate-pulse mt-2">에테르니아의 의지가 운명을 기록 중입니다...</div>}
      <div ref={endRef} />
    </div>
  );
};

const Dashboard = ({ player, sideTab, setSideTab, actions, stats }) => {
  // Inventory Grouping
  const groupedInv = player.inv.reduce((acc, item) => {
    acc[item.name] = (acc[item.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="w-1/3 min-w-[300px] hidden md:flex flex-col gap-4">
      {/* STATUS PANEL */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg">
        <h3 className="text-emerald-400 font-bold mb-3 text-sm flex items-center gap-2"><User size={16} /> STATUS</h3>
        <div className="space-y-2 text-xs text-slate-300">
          <div className="flex justify-between"><span>Lv.{player.level} {player.job}</span> <span className="text-yellow-400">{player.gold} G</span></div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
            <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div>
          </div>
          <div className="text-center text-[10px] text-slate-500">{player.hp} / {player.maxHp} HP</div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(player.mp / player.maxMp) * 100}%` }}></div>
          </div>
          <div className="text-center text-[10px] text-slate-500">{player.mp} / {player.maxMp} MP</div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
            <div><div className="text-slate-500">ATK</div><div className="text-white">{stats.atk} <span className="text-[10px] text-slate-400">({stats.elem})</span></div></div>
            <div><div className="text-slate-500">DEF</div><div className="text-white">{stats.def}</div></div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 truncate">W: {player.equip.weapon.name}</div>
          <div className="text-[10px] text-slate-400 truncate">A: {player.equip.armor.name}</div>
        </div>
      </div>

      {/* TABS */}
      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="flex gap-4 mb-3 border-b border-slate-700 pb-2">
          {['inventory', 'quest', 'system'].map(tab => (
            <button key={tab} onClick={() => setSideTab(tab)} className={`text-xs font-bold uppercase ${sideTab === tab ? 'text-indigo-400' : 'text-slate-500'}`}>{tab}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {sideTab === 'inventory' && Object.entries(groupedInv).map(([name, count], i) => {
            const item = player.inv.find(it => it.name === name);
            return (
              <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 flex justify-between items-center group">
                <span className={`text-sm ${item.tier >= 2 ? 'text-purple-300' : 'text-slate-300'}`}>{name} x{count}</span>
                <button onClick={() => actions.useItem(item)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">사용</button>
              </div>
            );
          })}
          {sideTab === 'quest' && player.quests.length === 0 && <div className="text-slate-500 text-center py-4">진행 중인 의뢰가 없습니다.</div>}

          {sideTab === 'system' && (
            <div className="space-y-4 p-2">
              <div className="text-xs text-slate-400 mb-2">
                <p>Session ID: {Date.now().toString(36).toUpperCase()}</p>
                <p>User ID: {actions.getUid()}</p>
                <p>Client Ver: v3.1 (Global Ranking)</p>
              </div>

              {/* HONOR OF FAME */}
              <div className="bg-slate-900/80 p-3 rounded border border-yellow-900/30 mb-2">
                <div className="text-xs font-bold text-yellow-500 mb-2 flex items-center gap-2"><Crown size={12} /> 명예의 전당 (Top 10)</div>
                <div className="space-y-1">
                  {actions.leaderboard && actions.leaderboard.length > 0 ? actions.leaderboard.map((ranker, i) => (
                    <div key={i} className="flex justify-between text-[10px] text-slate-300 border-b border-slate-800/50 pb-1 last:border-0 hover:bg-slate-800/50 p-1 rounded transition-colors">
                      <span className="flex gap-2">
                        <span className={`w-3 text-center font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                        <span>{ranker.nickname} (Lv.{ranker.level})</span>
                      </span>
                      <span className="flex gap-2 items-center">
                        <span className="text-red-400 flex items-center gap-0.5"><Skull size={8} /> {ranker.totalKills}</span>
                        <span className="text-yellow-500 flex items-center gap-0.5"><Crown size={8} /> {ranker.bossKills || 0}</span>
                      </span>
                    </div>
                  )) : <div className="text-[10px] text-slate-600 text-center">랭킹 정보 불러오는 중...</div>}
                </div>
              </div>

              <button
                onClick={() => {
                  const exportData = {
                    timestamp: new Date().toISOString(),
                    summary: {
                      name: player.name,
                      level: player.level,
                      job: player.job,
                      gold: player.gold,
                      playtime: "N/A"
                    },
                    stats: stats,
                    equipment: player.equip,
                    history: [...(player.archivedHistory || []), ...player.history]
                  };
                  exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded border border-slate-600 flex items-center justify-center gap-2"
              >
                <Save size={16} /> <span>전투 기록 다운로드 (JSON)</span>
              </button>
              <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-500">
                * 기록 다운로드는 현재 세션의 모든 이벤트와 선택, 전투 결과를 포함합니다. 클라우드 분석을 위해 주기적으로 백업하세요.
              </div>

              {/* ADMIN PANEL (Hidden) */}
              {actions.isAdmin() && (
                <div className="bg-red-950/30 p-3 rounded border border-red-800/50 mt-4">
                  <div className="text-xs font-bold text-red-400 mb-2">🔐 운영자 패널</div>
                  <div className="text-[10px] text-slate-400 space-y-2">
                    <p>UID: {actions.getUid()}</p>
                    <p>Event Multiplier: {actions.liveConfig?.eventMultiplier || 1}x</p>
                    <button
                      onClick={async () => {
                        const newMult = prompt('새 경험치 배율 (1~5):', '1');
                        if (newMult) {
                          const val = parseFloat(newMult);
                          if (isNaN(val) || val < 1 || val > 5) {
                            alert('⚠️ 배율은 1~5 사이여야 합니다.');
                            return;
                          }
                          const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config');
                          await setDoc(configRef, { eventMultiplier: val }, { merge: true });
                        }
                      }}
                      className="w-full bg-red-900 hover:bg-red-800 py-1 rounded text-white"
                    >
                      배율 변경
                    </button>
                    <button
                      onClick={async () => {
                        const newAnn = prompt('공지사항 (최대 100자):');
                        if (newAnn !== null) {
                          if (newAnn.length > 100) {
                            alert('⚠️ 공지는 100자 이하로 작성해주세요.');
                            return;
                          }
                          const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config');
                          await setDoc(configRef, { announcement: newAnn }, { merge: true });
                        }
                      }}
                      className="w-full bg-red-900 hover:bg-red-800 py-1 rounded text-white"
                    >
                      공지 설정
                    </button>
                  </div>
                </div>
              )}

              {/* FEEDBACK FORM */}
              <div className="bg-slate-900/80 p-3 rounded border border-slate-700 mt-4">
                <div className="text-xs font-bold text-slate-400 mb-2">📨 신고/제안</div>
                <textarea
                  id="feedbackInput"
                  placeholder="버그 신고, 기능 제안 등을 작성해주세요..."
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-300 h-20 resize-none focus:outline-none focus:border-indigo-500"
                  maxLength={500}
                />
                <button
                  onClick={async () => {
                    const input = document.getElementById('feedbackInput');
                    const msg = input?.value?.trim();
                    if (!msg) return alert('내용을 입력해주세요.');
                    try {
                      const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
                      await addDoc(feedbackCol, {
                        uid: actions.getUid(),
                        nickname: player.name,
                        message: msg,
                        statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                        timestamp: serverTimestamp()
                      });
                      input.value = '';
                      alert('✅ 제출 완료! 감사합니다.');
                    } catch {
                      alert('❌ 제출 실패. 다시 시도해주세요.');
                    }
                  }}
                  className="w-full mt-2 bg-indigo-800 hover:bg-indigo-700 py-2 rounded text-white text-xs"
                >
                  제출하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

const ControlPanel = ({ gameState, player, actions, setGameState, shopItems, grave, isAiThinking }) => {
  const mapData = DB.MAPS[player.loc];

  if (gameState === 'combat') {
    return (
      <div className="grid grid-cols-3 gap-2 mt-4">
        <button disabled={isAiThinking} onClick={() => actions.combat('attack')} className="bg-red-900/40 hover:bg-red-800 border border-red-700 p-4 rounded text-red-200 font-bold flex flex-col items-center disabled:opacity-50"><Sword /> 공격</button>
        <button disabled={isAiThinking} onClick={() => actions.combat('skill')} className="bg-blue-900/40 hover:bg-blue-800 border border-blue-700 p-4 rounded text-blue-200 font-bold flex flex-col items-center disabled:opacity-50"><Zap /> 기술 (10MP)</button>
        <button disabled={isAiThinking} onClick={() => actions.combat('escape')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-4 rounded text-slate-300 font-bold flex flex-col items-center disabled:opacity-50"><ArrowRight /> 도망</button>
      </div>
    );
  }

  // EVENT MODE (DynaEvent)
  if (gameState === 'event' && isAiThinking) {
    return <div className="mt-4 p-4 border border-slate-700 rounded bg-slate-900 text-center animate-pulse text-purple-400">운명의 갈림길이 생성되고 있습니다...</div>;
  }
  if (gameState === 'event' && !isAiThinking) {
    // In a real scenario, we'd pass event data here. For now, assuming event description is in logs and we need buttons.
    // But we stored event in state.currentEvent!
    // We need to access it. App -> Panel passes generic props. We need to add 'currentEvent' to ControlPanel props.
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
        <h2 className="text-xl text-purple-500 font-bold mb-4">🔮 운명의 선택</h2>
        <div className="flex-1 flex flex-col justify-center gap-4">
          <button onClick={() => actions.handleEventChoice(0)} className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left">
            <span className="font-bold text-slate-200">1. {player.currentEvent?.choices?.[0] || "선택지 1"}</span>
          </button>
          <button onClick={() => actions.handleEventChoice(1)} className="p-4 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded text-left">
            <span className="font-bold text-slate-200">2. {player.currentEvent?.choices?.[1] || "선택지 2"}</span>
          </button>
        </div>
      </div>
    );
  }

  // SHOP MODE
  if (gameState === 'shop') {
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
        <h2 className="text-xl text-yellow-500 font-bold mb-4">🛒 상점</h2>
        <div className="flex-1 overflow-y-auto grid grid-cols-1 gap-2">
          {shopItems.map((item, i) => (
            <button key={i} onClick={() => actions.market('buy', item)} className="flex justify-between p-3 bg-slate-800 rounded border border-slate-600 hover:bg-slate-700">
              <span className="font-bold">{item.name}</span>
              <span className="text-yellow-400">{item.price}G</span>
            </button>
          ))}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded">나가기</button>
      </div>
    );
  }

  // JOB CHANGE MODE
  if (gameState === 'job_change') {
    const current = DB.CLASSES[player.job];
    const avail = current.next || [];
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col items-center justify-center">
        <h2 className="text-2xl text-purple-400 font-bold mb-4">전직의 제단</h2>
        <div className="flex gap-2 flex-wrap justify-center">
          {avail.map(job => (
            <button key={job} onClick={() => actions.jobChange(job)} disabled={player.level < DB.CLASSES[job].reqLv} className="p-4 bg-slate-800 border border-purple-500 rounded hover:bg-slate-700 disabled:opacity-50">
              <div className="text-lg font-bold">{job}</div>
              <div className="text-xs">Lv.{DB.CLASSES[job].reqLv} 필요</div>
            </button>
          ))}
          {avail.length === 0 && <div className="text-slate-500">더 이상 전직할 수 없습니다.</div>}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 text-slate-400">나가기</button>
      </div>
    );
  }

  // QUEST BOARD MODE
  if (gameState === 'quest_board') {
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-slate-700 flex flex-col">
        <h2 className="text-xl text-indigo-400 font-bold mb-4">📜 의뢰 게시판</h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {DB.QUESTS.map(q => (
            <div key={q.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
              <div>
                <div className="font-bold">{q.title} <span className="text-xs text-slate-500">Lv.{q.minLv}+</span></div>
                <div className="text-xs text-slate-400">{q.desc}</div>
              </div>
              <button onClick={() => actions.acceptQuest(q.id)} disabled={player.quests.some(pq => pq.id === q.id)} className="px-3 py-1 bg-indigo-600 rounded disabled:bg-slate-700 text-xs">
                {player.quests.some(pq => pq.id === q.id) ? '수락됨' : '수락'}
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded">나가기</button>
      </div>
    );
  }

  // CRAFTING MODE (Phase 2.2)
  if (gameState === 'crafting') {
    const recipes = DB.ITEMS.recipes || [];
    return (
      <div className="absolute inset-x-4 bottom-4 top-20 bg-slate-900/95 z-20 p-4 rounded border border-amber-700 flex flex-col">
        <h2 className="text-xl text-amber-400 font-bold mb-4">🔨 제작소</h2>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
          {recipes.map(recipe => {
            const canCraft = player.gold >= recipe.gold && recipe.inputs.every(input => {
              return player.inv.filter(i => i.name === input.name).length >= input.qty;
            });
            return (
              <div key={recipe.id} className={`bg-slate-800 p-3 rounded border ${canCraft ? 'border-amber-500' : 'border-slate-700'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-amber-200">{recipe.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      재료: {recipe.inputs.map(i => `${i.name} x${i.qty}`).join(', ')} | {recipe.gold}G
                    </div>
                  </div>
                  <button
                    onClick={() => actions.craft(recipe.id)}
                    disabled={!canCraft}
                    className="px-4 py-2 bg-amber-600 rounded disabled:bg-slate-700 disabled:text-slate-500 text-sm font-bold hover:bg-amber-500"
                  >
                    제작
                  </button>
                </div>
              </div>
            );
          })}
          {recipes.length === 0 && <div className="text-slate-500 text-center py-4">레시피가 없습니다.</div>}
        </div>
        <button onClick={() => setGameState('idle')} className="mt-4 w-full bg-slate-700 py-3 rounded">나가기</button>
      </div>
    );
  }

  // IDLE / MOVING
  return (
    <div className="mt-4">
      {gameState === 'moving' ? (
        <div className="flex flex-wrap gap-2">
          {mapData.exits.map(exit => (
            <button key={exit} disabled={isAiThinking} onClick={() => actions.move(exit)} className="px-4 py-3 bg-emerald-900/40 border border-emerald-700 rounded text-emerald-200 flex items-center gap-2 disabled:opacity-50"><MapIcon size={14} /> {exit}</button>
          ))}
          {player.loc !== '시작의 마을' && <button disabled={isAiThinking} onClick={() => actions.move('시작의 마을')} className="px-4 py-3 bg-yellow-900/40 border border-yellow-700 rounded text-yellow-200 disabled:opacity-50"><Home size={14} /> 마을로</button>}
          <button onClick={() => setGameState('idle')} className="px-4 py-3 bg-slate-800 rounded">취소</button>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <button disabled={isAiThinking} onClick={actions.explore} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><MapIcon size={16} /> <span className="text-[10px]">탐색</span></button>
          <button disabled={isAiThinking} onClick={() => setGameState('moving')} className="bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ArrowRight size={16} /> <span className="text-[10px]">이동</span></button>
          {mapData.type === 'safe' && (
            <>
              <button disabled={isAiThinking} onClick={() => { actions.setShopItems([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]); actions.setGameState('shop'); }} className="bg-yellow-900/30 hover:bg-yellow-800 border border-yellow-700 text-yellow-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ShoppingBag size={16} /> <span className="text-[10px]">상점</span></button>
              <button disabled={isAiThinking} onClick={actions.rest} className="bg-emerald-900/30 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Moon size={16} /> <span className="text-[10px]">휴식</span></button>
              <button disabled={isAiThinking} onClick={() => setGameState('job_change')} className="bg-purple-900/40 hover:bg-purple-800 border border-purple-700 text-purple-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><GraduationCap size={16} /> <span className="text-[10px]">전직</span></button>
              <button disabled={isAiThinking} onClick={() => setGameState('quest_board')} className="bg-indigo-900/40 hover:bg-indigo-800 border border-indigo-700 text-indigo-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><ScrollText size={16} /> <span className="text-[10px]">의뢰</span></button>
              <button disabled={isAiThinking} onClick={() => setGameState('crafting')} className="bg-amber-900/40 hover:bg-amber-800 border border-amber-700 text-amber-200 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Hammer size={16} /> <span className="text-[10px]">제작</span></button>
            </>
          )}
          {grave && grave.loc === player.loc && (
            <button disabled={isAiThinking} onClick={actions.lootGrave} className="bg-slate-700 text-slate-300 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><Ghost size={16} /> <span className="text-[10px]">유해수습</span></button>
          )}
          <button disabled={isAiThinking} onClick={actions.reset} className="col-start-4 bg-red-950/30 text-red-500 p-2 rounded flex flex-col items-center gap-1 disabled:opacity-50"><X size={16} /> <span className="text-[10px]">초기화</span></button>
        </div>
      )}
    </div>
  );
};

const App = () => {
  const { player, gameState, logs, actions, getFullStats, sideTab, shopItems, grave, isAiThinking, currentEvent, visualEffect, syncStatus, liveConfig } = useGameEngine();

  // Augment player with currentEvent for ControlPanel access (since we kept logic inside engine state)
  const playerWithEvent = { ...player, currentEvent };

  return (
    <MainLayout visualEffect={visualEffect}>
      <header className="flex justify-between items-center mb-2 bg-slate-900 p-3 rounded border border-slate-800">
        <div className={`font-bold flex items-center gap-2 ${isAiThinking || gameState === 'moving' ? 'animate-pulse text-emerald-400' : 'text-emerald-500'}`}>
          <Sword size={20} /> AETHERIA: ROGUELIKE
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {syncStatus === 'syncing' && <span className="text-blue-400 animate-pulse flex items-center gap-1"><Cloud size={12} /> Syncing...</span>}
          {syncStatus === 'synced' && <span className="text-emerald-500 flex items-center gap-1"><Wifi size={12} /> Synced</span>}
          {syncStatus === 'ranking_update' && <span className="text-yellow-400 animate-bounce flex items-center gap-1"><Sparkles size={12} /> Rank Up!</span>}
          {syncStatus === 'offline' && <span className="text-red-500 flex items-center gap-1"><WifiOff size={12} /> Offline</span>}
          {(isAiThinking || gameState === 'moving') && <span className="text-yellow-400 animate-pulse">⚡ ACTION...</span>}
          <span>v3.0</span>
        </div>
      </header>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <TerminalView logs={logs} gameState={gameState} />
        <Dashboard player={player} sideTab={sideTab} setSideTab={actions.setSideTab} actions={actions} stats={getFullStats()} />
      </div>

      {/* Live Announcement Banner */}
      {liveConfig?.announcement && (
        <div className="bg-indigo-900/50 border border-indigo-700 p-2 rounded text-center text-xs text-indigo-200 animate-pulse">
          📢 {liveConfig.announcement}
        </div>
      )}

      {/* Offline Branding */}
      {syncStatus === 'offline' && (
        <div className="bg-red-950/80 border border-red-900 p-2 rounded text-center text-xs text-red-400">
          ⚠️ 심연과의 연결이 불안정합니다 (Offline Mode). 데이터는 로컬에만 저장됩니다.
        </div>
      )}

      <ControlPanel
        gameState={gameState}
        player={playerWithEvent}
        actions={actions}
        shopItems={shopItems}
        grave={grave}
        isAiThinking={isAiThinking}
      />
    </MainLayout>
  );
};

/* ======================================================================================================================
   FIRESTORE SECURITY RULES (Reference Documentation)
   ====================================================================================================================== 
   
   IMPORTANT: These rules should be deployed via Firebase Console or firebase-tools CLI.
   Path: firestore.rules

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       
       // --- USER DATA (Private) ---
       // Each user can only read/write their own document.
       match /artifacts/{appId}/users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         
         // History subcollection
         match /history/{historyId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
       
       // --- PUBLIC DATA (Read Only for Users) ---
       // Config, Leaderboard, Feedback are publicly readable. 
       // Write access should be restricted to Admin or Cloud Functions.
       match /artifacts/{appId}/public/data/config {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid in ['YOUR_ADMIN_UID_HERE'];
       }
       
       match /artifacts/{appId}/public/data/leaderboard/{userId} {
         allow read: if true;
         // Users can only update their own leaderboard entry
         allow write: if request.auth != null && request.auth.uid == userId;
       }

       match /artifacts/{appId}/public/data/feedback/{feedbackId} {
         allow read: if request.auth != null && request.auth.uid in ['YOUR_ADMIN_UID_HERE'];
         // Anyone authenticated can submit feedback
         allow create: if request.auth != null;
       }
     }
   }

   ====================================================================================================================== */

export default App;