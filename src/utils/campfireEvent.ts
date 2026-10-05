import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { FullStats } from './statsCalculator.js';

/**
 * 캠프파이어 이벤트 객체 생성 (Phase 2, B+ 2026-06 — Slay the Spire 캠프파이어).
 *
 * "휴식 vs 단련" 반복 결정 노드. fullStats 기준 회복량을 미리 계산해 일반 이벤트
 * outcome 스키마(hp/mp/buff)로 반환한다. 순수 함수 — 입력 → 새 객체, 부수효과 없음.
 *
 * - 휴식: maxHP/maxMP의 CAMPFIRE_HEAL_RATIO 만큼 회복 (즉시 생존)
 * - 단련: 다음 전투 ATK +CAMPFIRE_FORGE_ATK, CAMPFIRE_FORGE_TURNS 턴 (다가올 위험에 베팅)
 *
 * @param {{ maxHp: number, maxMp: number }} fullStats
 */
export const buildCampfireEvent = (fullStats: Pick<FullStats, 'maxHp' | 'maxMp'> | null | undefined) => {
    const maxHp = Math.max(1, Number(fullStats?.maxHp) || 1);
    const maxMp = Math.max(0, Number(fullStats?.maxMp) || 0);
    const healHp = Math.floor(maxHp * BALANCE.CAMPFIRE_HEAL_RATIO);
    const healMp = Math.floor(maxMp * BALANCE.CAMPFIRE_HEAL_RATIO);
    const forgePct = Math.round(BALANCE.CAMPFIRE_FORGE_ATK * 100);
    const forgeTurns = BALANCE.CAMPFIRE_FORGE_TURNS;
    return {
        isCampfire: true,
        desc: MSG.CAMPFIRE_DESC,
        choices: [MSG.CAMPFIRE_REST_CHOICE, MSG.CAMPFIRE_FORGE_CHOICE],
        outcomes: [
            // 2026-10 Wave 58: 모닥불 휴식도 휴식이다 — 마을 휴식만 세던 동안 업적 "N번 휴식"이 모닥불을 무시했다.
            //   로그의 회복량은 명목값이다 — 정산(eventActions)이 실효 최대치에서 멈춘 실제 회복량으로 고쳐 찍는다(U5).
            { choiceIndex: 0, hp: healHp, mp: healMp, rest: true, log: MSG.CAMPFIRE_REST_LOG(healHp, healMp) },
            {
                choiceIndex: 1,
                buff: { atk: BALANCE.CAMPFIRE_FORGE_ATK, def: 0, turn: forgeTurns, name: MSG.CAMPFIRE_FORGE_BUFF_NAME },
                log: MSG.CAMPFIRE_FORGE_LOG(forgePct, forgeTurns),
            },
        ],
    };
};
