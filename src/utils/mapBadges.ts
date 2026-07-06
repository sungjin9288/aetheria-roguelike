/**
 * mapBadges.ts — MapNavigator 목적지 카드에 표시할 위험/보상 배지 계산 순수 함수.
 *
 * maps.ts의 exit별 데이터(boss, eventChance, shopBonus, graveDropBonus)를 읽어
 * "저 지역에 갈 이유"를 짧은 배지로 요약한다. 레벨 락/위험 경고는 MapNavigator가
 * 이미 별도로 표시하므로 여기서는 중복하지 않는다.
 *
 * 2026-07 — 원정 보스 접근 게이지: 미격파 구역 보스 배지 옆에 진행도(%) 배지를
 * 추가로 얹는다. bossGauge(player.stats.bossGauge)가 없거나 0이면 표시하지 않아
 * 기존 스냅샷/테스트(2-인자 호출)와 완전히 하위 호환.
 */
import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { GameMap } from '../types/index.js';

export interface Badge {
    id: string;
    label: string;
}

/**
 * 주어진 지역(map)의 exit 카드에 표시할 배지 목록을 계산한다.
 * @param map - DB.MAPS[exitName] 형태의 지역 데이터.
 * @param areaBossDefeated - player.stats.areaBossDefeated (보스 이름 → 처치 여부).
 * @param bossGauge - player.stats.bossGauge (지역명 → 0~1 게이지 값). 생략 가능(하위 호환).
 */
export function getExitBadges(
    map: GameMap | null | undefined,
    areaBossDefeated: Record<string, boolean> | null | undefined,
    bossGauge?: Record<string, number> | null | undefined,
): Badge[] {
    if (!map) return [];

    const badges: Badge[] = [];
    const defeatedMap = areaBossDefeated || {};

    if (map.boss) {
        // boss가 문자열(보스 이름)이면 처치 여부를 조회해 숨길 수 있음.
        // boolean(true)이면 이름을 알 수 없어 항상 표시.
        const bossAlreadyDefeated = typeof map.boss === 'string' && !!defeatedMap[map.boss];
        if (!bossAlreadyDefeated) {
            badges.push({ id: 'boss', label: MSG.MAP_BADGE_BOSS });

            const gaugeValue = typeof map.boss === 'string' ? (bossGauge?.[map.name || ''] ?? 0) : 0;
            if (gaugeValue > 0) {
                const pct = Math.min(100, Math.round(gaugeValue * 100));
                badges.push({ id: 'bossGauge', label: MSG.MAP_BADGE_BOSS_GAUGE(pct) });
            }
        }
    }

    if (typeof map.eventChance === 'number' && map.eventChance >= BALANCE.MAP_HIGH_EVENT_CHANCE_THRESHOLD) {
        badges.push({ id: 'highEvent', label: MSG.MAP_BADGE_HIGH_EVENT });
    }

    if (map.shopBonus) {
        badges.push({ id: 'shop', label: MSG.MAP_BADGE_SHOP });
    }

    if (map.graveDropBonus) {
        badges.push({ id: 'grave', label: MSG.MAP_BADGE_GRAVE });
    }

    return badges;
}
