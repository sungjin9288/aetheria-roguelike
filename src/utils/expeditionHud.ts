import { BALANCE, CONSTANTS } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { DB } from '../data/db.js';
import { getAreaBossName, getBossGaugeValue, isAreaBossUndefeated } from './bossGauge.js';
import { getAbyssDailyDiveRemaining } from './abyssDailyDive.js';
import { getProtocolDayKey } from './protocolCycle.js';
import type { Player } from '../types/index.js';

/**
 * expeditionHud.ts — 상시 HUD(StatusBar)에 띄울 원정 진행 신호의 뷰모델 계산 (순수 함수).
 *
 * 2026-09 감사 G10: 보스 접근 게이지는 MapNavigator의 *선택된* 목적지 카드에서만
 *   보였고, 심연 데일리 다이브는 TSX 소비처가 0건이라 로그 한 줄이 전부였다.
 *   탐험 중인 플레이어가 "지금 무엇에 가까워지고 있는가"를 읽을 수 없었다.
 *
 * 컴포넌트는 렌더링만 하도록 지역 조회/게이지 환산/문구 선택을 전부 여기서 끝낸다
 * (mapBadges.ts와 같은 순수 뷰모델 빌더 패턴).
 */

export interface ExpeditionHudChip {
    id: 'bossGauge' | 'abyssDive';
    label: string;
    /** SignalBadge tone으로 그대로 전달 가능한 값. */
    tone: 'warning' | 'resonance';
}

/**
 * 게이지(0~1)를 "탐험 N회 / 총 M회" 눈금으로 환산. 눈금 수는
 * BALANCE.BOSS_GAUGE_PER_EXPLORE에서 파생되므로 밸런스 수정이 표시에 바로 반영된다.
 */
export const getBossGaugeTicks = (value: number): { ticks: number; total: number } => {
    const perExplore = BALANCE.BOSS_GAUGE_PER_EXPLORE;
    const total = Math.max(1, Math.ceil(1 / perExplore));
    if (value >= 1) return { ticks: total, total };
    const ticks = Math.min(total - 1, Math.max(0, Math.floor(value / perExplore + 1e-9)));
    return { ticks, total };
};

/** 현재 지역의 보스 접근 게이지 칩. 미격파 구역 보스가 없으면 null. */
export const getBossGaugeChip = (player: Player | null | undefined): ExpeditionHudChip | null => {
    const loc = player?.loc || '';
    if (!loc) return null;
    if (player?.challengeModifiers?.includes('blindMap')) return null;

    const mapData = DB.MAPS[loc];
    if (!isAreaBossUndefeated(mapData, player)) return null;

    const bossName = getAreaBossName(mapData);
    if (!bossName) return null;

    const { ticks, total } = getBossGaugeTicks(getBossGaugeValue(player, loc));
    return {
        id: 'bossGauge',
        label: ticks >= total ? MSG.HUD_BOSS_GAUGE_FULL(bossName) : MSG.HUD_BOSS_GAUGE(ticks, total),
        tone: 'warning',
    };
};

/** 혼돈의 심연에 있을 때만 노출되는 "오늘의 다이브" 잔여 칩. 소진되면 null. */
export const getAbyssDiveChip = (
    player: Player | null | undefined,
    now: Date = new Date(),
): ExpeditionHudChip | null => {
    if (!player?.loc || player.loc !== CONSTANTS.ABYSS_MAP_NAME) return null;

    const remaining = getAbyssDailyDiveRemaining(player, getProtocolDayKey(now));
    if (remaining <= 0) return null;

    return {
        id: 'abyssDive',
        label: MSG.HUD_ABYSS_DAILY_DIVE(remaining, BALANCE.ABYSS_DAILY_DIVE_MULT),
        tone: 'resonance',
    };
};

/** 상시 HUD에 표시할 원정 신호 전체 (순서 = 표시 순서). */
export const getExpeditionHudChips = (
    player: Player | null | undefined,
    now: Date = new Date(),
): ExpeditionHudChip[] => {
    const chips: ExpeditionHudChip[] = [];
    const boss = getBossGaugeChip(player);
    if (boss) chips.push(boss);
    const abyss = getAbyssDiveChip(player, now);
    if (abyss) chips.push(abyss);
    return chips;
};
