import { ITEMS } from '../data/items';
import { DB } from '../data/db';

// --- 공유 유틸리티 (Shared Utilities) ---
/** 배열이 아닌 값을 빈 배열로 안전하게 변환 */
export const toArray = (v) => (Array.isArray(v) ? v : []);

/** 플레이어의 직업 스킬 목록을 반환 */
export const getJobSkills = (player) => toArray(DB.CLASSES[player.job]?.skills);

/** 아이템 인스턴스 생성 (고유 ID 부여) */
export const makeItem = (template) => ({
    ...template,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

/** 전체 DB 아이템 목록을 하나의 배열로 반환 */
export const getAllItems = () => [
    ...toArray(DB.ITEMS?.consumables),
    ...toArray(DB.ITEMS?.weapons),
    ...toArray(DB.ITEMS?.armors),
    ...toArray(DB.ITEMS?.materials)
];

/** 이름으로 아이템을 찾아 반환 */
export const findItemByName = (name) => getAllItems().find((i) => i.name === name);

// Milestone Utility
export const checkMilestones = (killRegistry, lastKillName) => {
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
export const migrateData = (savedData) => {
    if (!savedData) return null;

    // Target the specific player object if clear structure exists
    // If savedData IS the player (old flat format?), use it.
    // But in this app, usually savedData matches App state structure.
    let target = savedData.player || savedData;

    // Version Limit
    if (!savedData.version || savedData.version < 2.7) {
        savedData.version = 2.7;

        target.mp = target.mp ?? 50;
        target.maxMp = target.maxMp ?? 50;
        target.history = target.history || [];
        target.archivedHistory = target.archivedHistory || []; // Ensure archivedHistory exists

        // New stats for v3.1
        target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0 };
        target.stats.killRegistry = target.stats.killRegistry || {};
        target.stats.bossKills = target.stats.bossKills || 0;
    }

    // Ensure equip is object not string (Old version compatibility)
    if (typeof target.equip?.weapon === 'string') {
        target.equip.weapon = ITEMS.weapons.find(w => w.name === target.equip.weapon) || ITEMS.weapons[0];
    }
    if (typeof target.equip?.armor === 'string') {
        target.equip.armor = ITEMS.armors.find(a => a.name === target.equip.armor) || ITEMS.armors[0];
    }

    // Modern runtime fields (safe defaults for older saves)
    target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
    target.tempBuff.atk = target.tempBuff.atk || 0;
    target.tempBuff.def = target.tempBuff.def || 0;
    target.tempBuff.turn = target.tempBuff.turn || 0;
    target.status = Array.isArray(target.status) ? target.status : [];
    target.skillLoadout = target.skillLoadout || { selected: 0, cooldowns: {} };
    target.skillLoadout.selected = Number.isInteger(target.skillLoadout.selected) ? target.skillLoadout.selected : 0;
    target.skillLoadout.cooldowns = target.skillLoadout.cooldowns || {};
    target.meta = target.meta || { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 };
    target.meta.essence = target.meta.essence || 0;
    target.meta.rank = target.meta.rank || 0;
    target.meta.bonusAtk = target.meta.bonusAtk || 0;
    target.meta.bonusHp = target.meta.bonusHp || 0;
    target.meta.bonusMp = target.meta.bonusMp || 0;

    return savedData;
};
