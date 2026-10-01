/**
 * 2026-10 Wave 56: 회복의 상한 — 회복은 생명을 줄이지 않고, 상한은 실효 최대 생명이다.
 *
 * 저장된 `maxHp`는 기본 최대 생명이고, 장비 · 유물 · 칭호가 올린 실효 최대 생명은 `calculateFullStats().maxHp`
 * (전투 수식의 `FullStats.maxHp`)다. 물약 · 휴식 · 전투 시작 회복은 실효 최대까지 채우는데, 처치 회복 · 흡혈 ·
 * 기술 흡수 · 회복 기술은 저장값으로 상한을 걸어 생명을 오히려 깎았다(실효 최대 696에서 처치 회복 뒤 500).
 * 이 함수는 상한을 실효 최대로 하고, 현재 생명이 상한보다 높으면 그대로 둔다.
 */
export const healWithinMax = (hp: number | undefined, heal: number, max: number | undefined): number => {
    const current = Math.max(0, Number(hp) || 0);
    const cap = Math.max(current, Number(max) || current);
    return Math.min(cap, current + Math.max(0, Math.floor(heal) || 0));
};
