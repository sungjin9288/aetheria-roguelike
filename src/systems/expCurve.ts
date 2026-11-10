/**
 * 경험 요구량 곡선의 유일한 정본(2026-11 H2 커밋 1).
 *
 * 곡선은 저장된 `player.nextExp`의 점화식이다: 레벨업마다 이전 요구량 × `EXP_SCALE_RATE`(내림),
 * `EXP_LEVEL_HARD_CAP`에서 멈춘다. 이 식이 엔진(`applyExpGain`) · 초반 임무 보상 완화 · 원정 결산 경험 ·
 * QA 시드 네 곳에 따로 적혀 있었다 — 한 곳만 바뀌면 같은 플레이어의 레벨업 시점을 화면 · 결산 · 보상이
 * 서로 다르게 셌다. 이 두 상수를 읽는 src 파일은 이 모듈 하나다(`tests/exp-curve-single-source.test.js`).
 */
import { BALANCE, CONSTANTS } from '../data/constants.js';

/**
 * 레벨 `newLevel`에 막 올라선 플레이어의 다음 요구량(`newLevel` → `newLevel + 1`).
 * `prevRequirement`는 방금 채운 요구량(`newLevel - 1` → `newLevel`)이다.
 * 레벨 인자는 구간 배율(H2 커밋 2)의 자리라 지금은 읽지 않는다 — 호출처는 지금부터 올바른 레벨을 넘긴다.
 */
export const getNextExpRequirement = (_newLevel: number, prevRequirement: number): number => Math.min(
    Math.floor(prevRequirement * BALANCE.EXP_SCALE_RATE),
    BALANCE.EXP_LEVEL_HARD_CAP,
);

/** 새 캐릭터(`START_NEXT_EXP`)부터 굴린 레벨 `level`의 요구량(`level` → `level + 1`). */
export const getLevelExpRequirement = (level: number): number => {
    let requirement: number = CONSTANTS.START_NEXT_EXP;
    for (let current = 1; current < level; current += 1) {
        requirement = getNextExpRequirement(current + 1, requirement);
    }
    return requirement;
};
