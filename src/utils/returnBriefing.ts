/**
 * returnBriefing.ts — 복귀 브리핑 카드 데이터 빌더 (순수 함수).
 *
 * 부팅 완료(bootStage 'ready') 후 마지막 플레이로부터 BALANCE.RETURN_BRIEFING_HOURS
 * 이상 지났으면 표시할 요약 정보를 만든다. player.stats.lastSeenAt(ms)이 없거나
 * 임계값 미만이면 null을 반환해 카드 자체를 렌더링하지 않는다.
 */
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { isMainStoryQuest } from '../data/storyChapters';
import { buildChainJournal } from './chainJournal';
import { getBagCraftReadiness } from './bagCrafting';
import { getBossGaugeChip } from './expeditionHud';
import { getHuntContractRows } from './huntContracts';
import { getActiveQuestEntries } from './gameUtils';
import {
    getCurrentWeeklyProtocol,
    getDailyMissionSummary,
    getWeeklyMissionRows,
} from './protocolCycle';
import type { Player } from '../types/index.js';
import { getVisibleLocationName } from './challengeRules.js';
import { getBossGaugeValue } from './bossGauge.js';

export type BriefingResumeKind = 'story' | 'hunt' | 'bossGauge' | 'bag';

/** "멈춘 자리" 한 줄 — 저장된 상태에서 도출한 사실만 담는다(추천 · 경로 없음). */
export interface BriefingResumeLine {
    kind: BriefingResumeKind;
    text: string;
}

export interface Briefing {
    loc: string;
    level: number;
    hp: number;
    maxHp: number;
    dailyCompletedCount: number;
    dailyMissionCount: number;
    claimableRewardCount: number;
    activeChainCount: number;
    awayHours: number;
    /** "멈춘 자리"(2026-11 고도화 E1) — 빌더는 늘 채운다, 없으면 줄이 없다. */
    resumeLines?: BriefingResumeLine[];
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * 마지막 플레이로부터 now까지 경과한 시간(ms) — lastSeenAt이 없으면 null.
 */
const getElapsedMs = (player: Player, now: number): number | null => {
    const lastSeenAt = player?.stats?.lastSeenAt;
    if (typeof lastSeenAt !== 'number' || !Number.isFinite(lastSeenAt)) return null;
    return now - lastSeenAt;
};

/** 수락했고 아직 끝나지 않은 본편 장(끝난 장은 '받을 임무 보상'이 이미 센다). */
const getStoryResumeLine = (player: Player): BriefingResumeLine | null => {
    const entry = getActiveQuestEntries(player)
        .find((candidate) => !candidate.isBounty && !candidate.isComplete && isMainStoryQuest(candidate.quest));
    if (!entry) return null;
    return {
        kind: 'story',
        text: MSG.RETURN_BRIEFING_RESUME_STORY(entry.quest.title || '', entry.progress, entry.quest.goal || 0),
    };
};

/** 진행이 시작됐고 완수하지 않은 토벌 의뢰 — 지금 지역의 의뢰가 먼저다. */
const getHuntResumeLine = (player: Player): BriefingResumeLine | null => {
    const started = getHuntContractRows(player)
        .filter((row) => row.reachable && !row.done && (row.stage > 0 || row.progress > 0 || row.round > 1));
    const row = started.find((candidate) => candidate.map === player.loc) || started[0];
    if (!row) return null;
    const mapName = getVisibleLocationName(player, row.map) || row.map;
    return { kind: 'hunt', text: MSG.RETURN_BRIEFING_RESUME_HUNT(mapName, row.status) };
};

/** 지금 지역의 구역 보스 게이지가 차기 시작했을 때(원정 HUD 칩과 같은 판정 · 문구). */
const getBossGaugeResumeLine = (player: Player): BriefingResumeLine | null => {
    if (getBossGaugeValue(player, player.loc || '') <= 0) return null;
    const chip = getBossGaugeChip(player);
    return chip ? { kind: 'bossGauge', text: MSG.RETURN_BRIEFING_RESUME_BOSS(chip.label) } : null;
};

/** 다음 가방 단계의 재료를 모으기 시작했을 때(재료는 필요한 수까지만 센다). */
const getBagResumeLine = (player: Player): BriefingResumeLine | null => {
    const readiness = getBagCraftReadiness(player);
    if (!readiness) return null;
    const owned = readiness.inputs.reduce((sum, input) => sum + Math.min(input.owned, input.qty), 0);
    if (owned <= 0) return null;
    const total = readiness.inputs.reduce((sum, input) => sum + input.qty, 0);
    return { kind: 'bag', text: MSG.RETURN_BRIEFING_RESUME_BAG(readiness.recipe.name, owned, total) };
};

/**
 * 복귀 브리핑의 "멈춘 자리" — 본편 장 · 토벌 의뢰 · 구역 보스 게이지 · 다음 가방 순서로 해당하는 줄만,
 * 최대 `BALANCE.RETURN_BRIEFING_RESUME_LINES`줄(2026-11 고도화 E1). 가진 것 · 진행 중인 것만 말하고
 * 갈 곳이나 할 일을 권하지 않는다(Wave 88 · 원장 §138 "일지 한 줄").
 */
export const getBriefingResumeLines = (player: Player): BriefingResumeLine[] => [
    getStoryResumeLine(player),
    getHuntResumeLine(player),
    getBossGaugeResumeLine(player),
    getBagResumeLine(player),
]
    .filter((line): line is BriefingResumeLine => line !== null)
    .slice(0, BALANCE.RETURN_BRIEFING_RESUME_LINES);

/**
 * buildReturnBriefing — 복귀 브리핑 카드용 데이터를 만든다.
 *
 * @param player 현재 player 상태
 * @param now 기준 시각(ms, 보통 Date.now())
 * @returns `RETURN_BRIEFING_HOURS` 미만 경과했거나 lastSeenAt 필드 부재 시 null, 그 외에는 Briefing 객체
 */
export function buildReturnBriefing(
    player: Player | null | undefined,
    now: number,
    effectiveMaxHp?: number,
): Briefing | null {
    if (!player) return null;

    const elapsedMs = getElapsedMs(player, now);
    if (elapsedMs === null) return null;

    const thresholdMs = BALANCE.RETURN_BRIEFING_HOURS * MS_PER_HOUR;
    if (elapsedMs < thresholdMs) return null;

    const currentDate = new Date(now);
    const daily = getDailyMissionSummary(player, currentDate);
    const weeklyMissions = getWeeklyMissionRows(
        getCurrentWeeklyProtocol(player.weeklyProtocol, currentDate),
    );
    const claimableQuestCount = getActiveQuestEntries(player)
        .filter((entry) => entry.isComplete)
        .length;
    const claimableWeeklyCount = weeklyMissions
        .filter((mission) => mission.done && !mission.claimed)
        .length;
    const activeChainCount = buildChainJournal(player.eventChainProgress, undefined, player.stats?.claimedQuestIds).length;

    const maxHp = typeof effectiveMaxHp === 'number' && Number.isFinite(effectiveMaxHp) && effectiveMaxHp > 0
        ? effectiveMaxHp
        : (player.maxHp ?? 0);

    return {
        // Wave 62 A10: 길 잃은 여행이면 귀환 브리핑도 위치를 숨긴다.
        loc: getVisibleLocationName(player, player.loc) || '알 수 없는 곳',
        level: player.level || 1,
        hp: player.hp ?? 0,
        maxHp,
        dailyCompletedCount: daily.done,
        dailyMissionCount: daily.total,
        claimableRewardCount: claimableQuestCount + claimableWeeklyCount,
        activeChainCount,
        awayHours: Math.floor(elapsedMs / MS_PER_HOUR),
        resumeLines: getBriefingResumeLines(player),
    };
}
