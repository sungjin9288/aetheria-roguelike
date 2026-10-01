import { CONSTANTS } from '../data/constants.js';
import { ACHIEVEMENTS } from '../data/quests.js';
import type { Achievement, Player } from '../types/index.js';
import { countCompletedSignatureSets, countDiscoveredSignatures } from './signatureDiscovery.js';

/**
 * 업적 진행값 · 달성 판정(2026-10 Wave 58 — gameUtils에서 옮김).
 *
 * 영구 상태 선별(`pickPermanentPlayerState`)이 달성 기록을 남기려면 이 판정을 읽어야 하는데, gameUtils는 무거운
 * 의존(아이템 · 전투 난이도 · 액션 타입)을 끌고 온다. 판정만 따로 둬 계승 · 사망 경로가 가볍게 읽는다.
 */

/** 업적 진행값의 원값 — 달성 기록(래치)을 보지 않는다. */
const getRawAchievementValue = (achievement: Achievement, player: Player) => {
    const stats = player?.stats || {};
    const target = achievement?.target;
    if (target === 'level') return player?.level || 0;
    if (target === 'prestige') return player?.meta?.prestigeRank || 0;
    // 2026-10 Wave 58: `stats.syntheses`는 성공한 합성만 센다(업적 "합성 N회 성공").
    if (target === 'synths') return stats?.syntheses || 0;
    // 2026-10 Wave 58: "새 지역 N곳 발견" — 시작 마을은 발견한 곳이 아니다(처음부터 방문 목록에 있다).
    if (target === 'discoveries') {
        return (Array.isArray(stats?.visitedMaps) ? stats.visitedMaps : [])
            .filter((map) => map !== CONSTANTS.START_LOCATION).length;
    }
    // 2026-10 Wave 58: "혼돈의 심연 N층 도달" — `abyssRecord`는 돌파한 층 수이고(Wave 35) 돌파하면 다음 층에
    //   도달한다. 기록이 있으면 도달한 가장 깊은 층은 기록 + 1이다.
    if (target === 'abyssRecord') {
        const record = stats?.abyssRecord || 0;
        return record > 0 ? record + 1 : 0;
    }
    // cycle 95: 휘발성 killStreak는 매번 0으로 리셋되므로 max-ever 누적 카운터를 읽음.
    if (target === 'maxKillStreak') return stats?.maxKillStreak || 0;
    // cycle 101: stats.relicCount 단일 source of truth — ADD_RELIC handler가
    // player.relics에 push와 stats.relicCount++ 둘 다 수행하므로, relics.length를
    // 추가로 더하면 현재 런의 relic이 double count됨. 이전엔 ach_relic_5("유물 5개")
    // 가 실제로 3개에서 풀리던 부풀림 회귀를 fix. checkTitles('relicCount')와도 정합.
    if (target === 'relicCount') return stats?.relicCount || 0;
    // cycle 102: 발견 체인(BALANCE.DISCOVERY_CHAINS) 완료 카운트 — exploreUtils
    // checkDiscoveryChains가 stats.discoveryChains 배열에 완료 ID push.
    if (target === 'discoveryChains') return Array.isArray(stats?.discoveryChains) ? stats.discoveryChains.length : 0;
    if (target === 'signaturesDiscovered') return countDiscoveredSignatures(player);
    if (target === 'signatureSetsCompleted') return countCompletedSignatureSets(player);
    // B3-TODO(2026-09): achievement.target은 data-driven 문자열이라 PlayerStats 키로
    //   좁히려면 quests.ts ACHIEVEMENTS의 target 리터럴 유니온화가 선행돼야 한다.
    //   그때까지 이 한 곳만 동적 인덱스 캐스트를 유지한다(Number()로 number 반환형 보존,
    //   런타임 동작 동일 — PlayerStats 카운터는 항상 number|undefined다).
    return Number((stats as Record<string, unknown>)[target ?? '']) || 0;
};

/** 세이브에서 온 목록이라 배열 · 문자열만 믿는다. */
const readIdList = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
);

const isLatched = (achievement: Achievement, player: Player) => {
    const id = achievement?.id;
    return typeof id === 'string' && readIdList(player?.stats?.achievedAchievements).includes(id);
};

/**
 * 업적 진행값. 달성 기록이 있는 업적은 목표 이상으로 읽는다 — 레벨 · 방문 지역처럼 계승 · 사망 재시작에서
 * 줄어드는 값이 수령하지 않은 업적을 다시 잠그지 않게 한다(2026-10 Wave 58).
 */
export const getAchievementCurrentValue = (achievement: Achievement, player: Player) => {
    const raw = getRawAchievementValue(achievement, player);
    return isLatched(achievement, player) ? Math.max(raw, achievement?.goal || 0) : raw;
};

/** 업적 달성 여부 */
export const isAchievementUnlocked = (achievement: Achievement, player: Player) => (
    getAchievementCurrentValue(achievement, player) >= (achievement?.goal || 0)
);

/**
 * 계승 · 사망 재시작 직전에 남길 달성 기록 — 이미 남긴 기록 + 지금 달성했지만 아직 수령하지 않은 업적.
 * 수령한 업적은 `claimedAchievements`가 이미 영구 기록이라 다시 적지 않는다.
 */
export const collectAchievedAchievementIds = (player: Player): string[] => {
    const claimed = new Set(readIdList(player?.stats?.claimedAchievements));
    const latched = new Set(readIdList(player?.stats?.achievedAchievements));
    for (const achievement of ACHIEVEMENTS) {
        const id = achievement?.id;
        if (!id || claimed.has(id) || latched.has(id)) continue;
        if (getRawAchievementValue(achievement, player) >= (achievement.goal || 0)) latched.add(id);
    }
    return [...latched].filter((id) => !claimed.has(id));
};
