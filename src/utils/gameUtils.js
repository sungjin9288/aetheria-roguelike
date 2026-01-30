import { ITEMS } from '../data/items';

// Milestone Utility
export const checkMilestones = (killRegistry, lastKillName, player) => {
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
        savedData.equip.weapon = ITEMS.weapons.find(w => w.name === savedData.equip.weapon) || ITEMS.weapons[0];
    }
    if (typeof savedData.equip?.armor === 'string') {
        savedData.equip.armor = ITEMS.armors.find(a => a.name === savedData.equip.armor) || ITEMS.armors[0];
    }
    return savedData;
};
