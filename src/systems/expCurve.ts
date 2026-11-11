/**
 * 경험 요구량 곡선의 유일한 정본(2026-11 H2).
 *
 * 곡선은 레벨의 함수다: Lv1 요구량 `START_NEXT_EXP`에서 레벨마다 배율(내림)을 곱하고 `EXP_LEVEL_HARD_CAP`에서 멈춘다.
 * 배율은 `EXP_SCALE_RATE`이고, 레벨 `EXP_LATE_BAND.from` → `.to` 사이의 레벨업만 `EXP_SCALE_RATE_LATE`다(소유자 결정 S1 —
 * 1회차 Lv41-48 비중을 줄인다). 레벨업한 플레이어의 `nextExp`는 저장된 이전 요구량이 아니라 새 레벨의 요구량이다 —
 * 그래서 압축 전 곡선 · 손으로 만든 큰 요구량을 든 옛 세이브도 레벨업 한 번 뒤 이 곡선에 맞춰진다(`DATA_VERSION` 불변).
 *
 * 이 식이 엔진(`applyExpGain`) · 초반 임무 보상 완화 · 원정 결산 경험 · QA 시드 네 곳에 따로 적혀 있었다(H2 커밋 1).
 * 곡선 상수를 읽는 src 파일은 이 모듈 하나다(`tests/exp-curve-single-source.test.js`).
 */
import { BALANCE, CONSTANTS } from '../data/constants.js';

/** 레벨 `newLevel`에 막 올라선 플레이어의 다음 요구량(`newLevel` → `newLevel + 1`). `prevRequirement`는 `newLevel - 1` → `newLevel`. */
export const getNextExpRequirement = (newLevel: number, prevRequirement: number): number => {
    const { from, to } = BALANCE.EXP_LATE_BAND;
    const rate = newLevel > from && newLevel <= to ? BALANCE.EXP_SCALE_RATE_LATE : BALANCE.EXP_SCALE_RATE;
    return Math.min(Math.floor(prevRequirement * rate), BALANCE.EXP_LEVEL_HARD_CAP);
};

const buildRequirementTable = (): readonly number[] => {
    const table = [0, CONSTANTS.START_NEXT_EXP];
    for (let level = 2; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        table[level] = getNextExpRequirement(level, table[level - 1]);
    }
    return Object.freeze(table);
};
const REQUIREMENT_BY_LEVEL = buildRequirementTable();

/** 레벨 `level`의 요구량(`level` → `level + 1`). 범위 밖 레벨은 가까운 끝으로 접는다. */
export const getLevelExpRequirement = (level: number): number => {
    const index = Math.min(CONSTANTS.MAX_LEVEL, Math.max(1, Math.floor(Number(level) || 1)));
    return REQUIREMENT_BY_LEVEL[index];
};
