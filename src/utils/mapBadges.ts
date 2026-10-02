/**
 * mapBadges.ts — MapNavigator 목적지 카드에 표시할 위험/보상 배지 계산 순수 함수.
 *
 * maps.ts의 exit별 데이터(eventChance, shopBonus, graveDropBonus)와 플레이어 상태를 읽어
 * "저 지역에 갈 이유"를 짧은 배지로 요약한다. 레벨 락/위험 경고는 MapNavigator가
 * 이미 별도로 표시하므로 여기서는 중복하지 않는다.
 *
 * 2026-07 — 원정 보스 접근 게이지: 미격파 구역 보스 배지 옆에 진행도(%) 배지를
 * 추가로 얹는다. 게이지(player.stats.bossGauge)가 없거나 0이면 표시하지 않는다.
 *
 * 2026-10 Wave 61 — 두 배지가 엔진과 같은 판정을 읽는다.
 *  - '보스': 지역의 `boss` 필드가 아니라 `canBossAppearInMap`(이 플레이어에게 실제로 보스가 나올 수 있는가).
 *    `boss: true`만 보던 동안 해금 전의 지하 미궁 · 공중 신전 · 금지된 도서관에도 붙었다.
 *  - '이벤트↑': 설정값 `eventChance`가 아니라 엔진이 굴리는 서사 이벤트 확률(`getNarrativeEventChance` — ×0.25에
 *    지역 성격 배율 보스 ×0.82 · 변칙 ×1.12). 설정값으로 붙이던 동안 배지 15곳 중 10곳(5.74~6.56%)이 배지 없는
 *    3곳(어둠의 지하 감옥 7.28% · 화염의 사원 7.00% · 고대 마법 탑 7.00%)보다 낮았다.
 */
import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { GameMap, Player } from '../types/index.js';
import { getBossGaugeValue, isAreaBossUndefeated } from './bossGauge.js';
import { canBossAppearInMap } from './bossPresence.js';
import { getNarrativeEventChance } from './explorationPacing.js';

export interface Badge {
    id: string;
    label: string;
}

/**
 * 지역 고유의 서사 이벤트 확률 — 엔진(`exploreActions`)이 탐험마다 굴리는 같은 계산에서 플레이어 몫
 * (유물 보너스 · 진행 배율 · 연속 탐험 보정)만 뺀 값이다. 플레이어 몫은 모든 지역에 같은 배율로 곱해지므로
 * 지역 사이의 순서는 이 값이 정한다.
 */
export const getMapBaseNarrativeEventChance = (map: GameMap | null | undefined): number => (
    getNarrativeEventChance(map?.eventChance || 0, 0, undefined, map ?? null)
);

/**
 * '이벤트↑' 문턱(실제 확률) — 지역 성격 보정이 없는(×1) 지역이 설정값 문턱
 * (`BALANCE.MAP_HIGH_EVENT_CHANCE_THRESHOLD`)에서 받는 실제 확률이다. 배지는 실제 확률이 이 값 이상인 지역에만
 * 붙으므로 배지가 붙은 지역의 확률은 언제나 배지가 없는 지역의 확률 이상이다.
 */
export const getHighEventChanceThreshold = (): number => (
    BALANCE.MAP_HIGH_EVENT_CHANCE_THRESHOLD * BALANCE.SPECIAL_EVENT_BASE_MULT
);

/**
 * 주어진 지역(map)의 exit 카드에 표시할 배지 목록을 계산한다.
 * @param map - DB.MAPS[exitName] 형태의 지역 데이터.
 * @param player - 보스 출현(숨은 보스 해금 · 구역 보스 처치 · 심연 층)과 게이지를 읽는 플레이어.
 * @param mapName - 지역 이름(DB.MAPS의 데이터에는 `name`이 없다). 생략하면 `map.name`.
 */
export function getExitBadges(
    map: GameMap | null | undefined,
    player: Player | null | undefined,
    mapName: string | null | undefined = map?.name,
): Badge[] {
    if (!map) return [];

    const badges: Badge[] = [];

    if (canBossAppearInMap(mapName, map, player)) {
        badges.push({ id: 'boss', label: MSG.MAP_BADGE_BOSS });

        // 게이지는 미격파 구역 보스에만 쌓인다(bossGauge.ts).
        const gaugeValue = mapName && isAreaBossUndefeated(map, player) ? getBossGaugeValue(player, mapName) : 0;
        if (gaugeValue > 0) {
            const pct = Math.min(100, Math.round(gaugeValue * 100));
            badges.push({ id: 'bossGauge', label: MSG.MAP_BADGE_BOSS_GAUGE(pct) });
        }
    }

    if (getMapBaseNarrativeEventChance(map) >= getHighEventChanceThreshold()) {
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
