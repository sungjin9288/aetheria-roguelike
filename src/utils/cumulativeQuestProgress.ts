import type { Player } from '../types/player.js';
import type { Quest } from '../types/quest.js';
import { getLowHpWinTotal } from '../systems/DifficultyManager.js';
import { countDiscoveredSignatures } from './signatureDiscovery.js';
import { countDiscoveredMaps } from './discoveredMaps.js';

const capProgress = (quest: Quest | undefined, current: unknown) => {
    const goal = Math.max(0, Number(quest?.goal) || 0);
    return Math.min(goal, Math.max(0, Number(current) || 0));
};

type LifetimeCounterReader = (player: Player) => unknown;

const statsOf = (player: Player) => player.stats || {};

/**
 * 이 임무의 진행도를 평생 누적 기록에서 읽는 리더 — 표에 없는 임무(null)는 수락 뒤부터 진행도를 쌓는다.
 * 진행도(`getCumulativeQuestProgress`)와 화면의 '누적' 표시(`isLifetimeCounterQuest`)가 이 표 하나를 읽으므로,
 * 새 누적 임무 종류는 여기에 한 줄을 넣으면 두 곳에 함께 반영된다.
 */
const getLifetimeCounterReader = (quest: Quest | undefined): LifetimeCounterReader | null => {
    if (quest?.type === 'combat_count' && quest.target === 'kills') return (player) => statsOf(player).kills;
    if (quest?.type === 'combat_count' && quest.target === 'bossKills') return (player) => statsOf(player).bossKills;
    if (quest?.type === 'craft' && quest.target === 'crafts') return (player) => statsOf(player).crafts;
    if (quest?.type === 'explore_count' && quest.target === 'explores' && !quest.location) {
        return (player) => statsOf(player).explores;
    }
    if (quest?.type === 'survive_low_hp' && quest.target === 'lowHpWins') {
        const threshold = quest.threshold || 0.2;
        return (player) => getLowHpWinTotal(statsOf(player), threshold);
    }
    if (quest?.type === 'bounty_count' && quest.target === 'bountiesCompleted') {
        return (player) => statsOf(player).bountiesCompleted;
    }
    if (quest?.type === 'build_victory') {
        const buildKey = quest.target ?? '';
        return (player) => statsOf(player).buildWins?.[buildKey];
    }
    if (quest?.type === 'discovery_count' && quest.target === 'discoveries') {
        return (player) => countDiscoveredMaps(statsOf(player));
    }
    if (quest?.type === 'escape_count' && quest.target === 'escapes') return (player) => statsOf(player).escapes;
    // 2026-10 Wave 64 (원장 §65): 누적 골드 — 업적 '거상' 계열과 같은 기록이다(번 골드는 전부 `stats.total_gold`에 쌓인다).
    if (quest?.type === 'gold_earned' && quest.target === 'total_gold') return (player) => statsOf(player).total_gold;
    if (quest?.type === 'signature_collect' && quest.target === 'signaturesDiscovered') {
        return (player) => countDiscoveredSignatures(player);
    }
    return null;
};

/** 진행도가 평생 누적 기록에서 오는 임무인가 — 수락 순간 이미 채워져 있을 수 있다(게시판·임무 탭의 '누적' 표시). */
export const isLifetimeCounterQuest = (quest: Quest | undefined): boolean => getLifetimeCounterReader(quest) !== null;

export const getCumulativeQuestProgress = (quest: Quest | undefined, player: Player): number | null => {
    const read = getLifetimeCounterReader(quest);
    if (!read) return null;
    const current = read(player);
    return current === null ? null : capProgress(quest, current);
};
