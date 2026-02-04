import { ITEMS } from '../data/items';

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

    return savedData;
};
