import { MSG } from '../data/messages';
import { CombatEngine } from './CombatEngine';
import type { Player } from '../types/index.js';

/**
 * 2026-10 Wave 52: 행동 끝 틱 — 이번 행동이 건 강화(`tempBuff`)는 이번 틱에 줄지 않는다.
 *
 * "N턴" 강화는 건 뒤 N번 작동한다 — 공격 강화는 내 행동 N번, 방어 · 반격 강화는 적 공격 N번이다.
 * 틱은 내 행동 직후 · 적 공격 전에 돈다. 그래서 건 행동의 틱에서 바로 1이 줄어 "3턴" 광폭화가 공격 2번,
 * "2턴" 방패 전술이 적 공격 1번만 작동했고, 1턴짜리 방어 보너스는 적이 치기 전에 사라졌다
 * (Wave 44가 적 약화에서 고친 것과 같은 모양이다). 전투 밖에서 마신 물약은 이미 N번이었다.
 *
 * 판정은 참조다: 행동 전과 다른 `tempBuff` 객체가 남아 있으면 이번 행동이 건 것이다(기술 · 소모품 모두
 * 새 객체를 만든다). 기술 쿨타임 · 상태이상 · 지속 회복 틱은 그대로 돈다.
 */
export const tickAfterAction = (before: Player, after: Player) => {
    const tick = CombatEngine.tickCombatState(after);
    const granted = Boolean(after.tempBuff) && after.tempBuff !== before.tempBuff && (after.tempBuff?.turn ?? 0) > 0;
    if (!granted) return tick;
    return {
        ...tick,
        updatedPlayer: { ...tick.updatedPlayer, tempBuff: after.tempBuff },
        logs: tick.logs.filter((log) => log.text !== MSG.BUFF_EXPIRED),
    };
};
