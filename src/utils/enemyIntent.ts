import { MSG } from '../data/messages.js';
import { CombatEngine } from '../systems/CombatEngine.js';
import { getActiveHeavyStatus } from '../systems/bossMechanics.js';
import { getChargeBreakMult } from '../systems/relicBehaviorCombos.js';
import { getActiveRelicSynergies } from '../data/relics.js';
import type { Monster, Player, StatusId } from '../types/index.js';
import { estimateEnemyNextHit, type EnemyTelegraphType } from './enemyThreat.js';

/**
 * 적 무대의 의도 표시(2026-11 디자인 고도화 A4, 소유자 결정 Q2 "권장 대응 칩은 없앤다").
 *
 * 전투 조작판의 판단 요약 세 칸(위협 · 권장 대응 · 예상 흐름)을 대신한다. 다음 행동은 엔진의 예고(`predictEnemyNextAction`)
 * 그대로이고, 숫자는 그 행동 한 번의 예상 피해(`estimateEnemyNextHit` — 실제 엔진의 고정 굴림)다. 무엇을 하라고 권하지 않는다
 * — 반응은 플레이어 몫이다(Wave 88). 표시만이라 판정 · 난수 · 기록 줄은 바뀌지 않는다.
 */

/** 화면이 아이콘을 고르는 의도 종류 — 3페이즈 임박은 2페이즈 임박과 같은 '변신'이다. */
export type EnemyIntentKind = 'attack' | 'heavy' | 'guard' | 'stunned' | 'breath' | 'phase' | 'charge' | 'charging' | 'broken';

export interface EnemyIntent {
    kind: EnemyIntentKind;
    /** 예고 문구(`MSG.ENEMY_TELEGRAPH_*`) — 확률이 있으면 함께 말한다. */
    label: string;
    /** 그 행동 한 번의 예상 피해 — 기절이면 null. */
    hit: number | null;
    /** 맞으면 걸릴 수 있는 상태(일반 공격의 `statusOnHit`, 2페이즈 뒤 강타의 상태) — 기절이면 null. */
    status: string | null;
}

const TELEGRAPH_TYPES: readonly EnemyTelegraphType[] = [
    'normal', 'heavy', 'guard', 'stunned', 'breath', 'phase2_imminent', 'phase3_imminent', 'charge', 'charge_start', 'charge_broken',
];

const isTelegraphType = (value: string): value is EnemyTelegraphType => (TELEGRAPH_TYPES as readonly string[]).includes(value);

const INTENT_KIND: Record<EnemyTelegraphType, EnemyIntentKind> = {
    normal: 'attack',
    heavy: 'heavy',
    guard: 'guard',
    stunned: 'stunned',
    breath: 'breath',
    phase2_imminent: 'phase',
    phase3_imminent: 'phase',
    charge: 'charge',
    charge_start: 'charging',
    charge_broken: 'broken',
};

const getStatusThreat = (enemy: Monster): string | null => {
    const status = enemy.statusOnHit || getActiveHeavyStatus(enemy)?.status;
    if (!status) return null;
    return MSG.DOT_LABELS[status as StatusId] || null;
};

export const getEnemyIntent = (player: Player | null | undefined, enemy: Monster | null | undefined): EnemyIntent | null => {
    if (!player || !enemy) return null;
    // 2026-11 H4 끊는 일격: 충전 끊기까지 남은 피해는 그 조합의 배율로 센다(엔진의 끊김 판정과 같다).
    const telegraph = CombatEngine.predictEnemyNextAction(enemy, getChargeBreakMult(getActiveRelicSynergies(player.relics || [])));
    if (!telegraph || !isTelegraphType(telegraph.type)) return null;
    const kind = INTENT_KIND[telegraph.type];
    const hit = estimateEnemyNextHit(player, enemy, telegraph.type);
    const status = kind === 'stunned' || kind === 'charging' || kind === 'broken' ? null : getStatusThreat(enemy);
    return {
        kind,
        label: telegraph.label,
        hit,
        status,
    };
};
