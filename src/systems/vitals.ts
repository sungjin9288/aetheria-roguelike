import { BALANCE } from '../data/constants.js';
import { calculateFullStats } from '../utils/statsCalculator.js';
import type { Player, Relic } from '../types/index.js';

/**
 * 2026-10 Wave 56: 회복의 상한 — 회복은 생명을 줄이지 않고, 상한은 실효 최대 생명이다.
 *
 * 저장된 `maxHp`는 기본 최대 생명이고, 장비 · 유물 · 칭호 · 직업 약점이 바꾼 실효 최대 생명은 `calculateFullStats().maxHp`
 * (전투 수식의 `FullStats.maxHp`)다. 물약 · 휴식 · 전투 시작 회복은 실효 최대까지 채우는데, 처치 회복 · 흡혈 ·
 * 기술 흡수 · 회복 기술은 저장값으로 상한을 걸어 생명을 오히려 깎았다(실효 최대 696에서 처치 회복 뒤 500).
 * 이 함수는 상한을 실효 최대로 하고, 현재 생명이 상한보다 높으면 그대로 둔다.
 */
export const healWithinMax = (hp: number | undefined, heal: number, max: number | undefined): number => {
    const current = Math.max(0, Number(hp) || 0);
    const cap = Math.max(current, Number(max) || current);
    return Math.min(cap, current + Math.max(0, Math.floor(heal) || 0));
};

/**
 * 실효 최대 생명 — `calculateFullStats().maxHp`. 저장값보다 작을 수 있다(직업 약점 "낮은 생명" × 0.8) —
 * 둘 중 큰 값을 쓰던 첫 구현은 회복 틱 · 레벨업이 생명을 실효 최대 위로 올렸다(자연 플레이 드라이버 `hpAboveFullMaxHp`).
 * 계산할 수 없는 입력(최소 픽스처)만 저장값이다.
 */
export const getEffectiveMaxHp = (player: Player): number => {
    try {
        const full = player ? calculateFullStats(player)?.maxHp : 0;
        if (typeof full === 'number' && full > 0) return full;
    } catch {
        // 최소 픽스처 — 저장값으로 읽는다.
    }
    return player?.maxHp || BALANCE.DEFAULT_MAX_HP;
};

/** 실효 최대 기력 — `calculateFullStats().maxMp`(전투 중 유물 목록 기준). 계산할 수 없으면 `fallback`. */
export const getEffectiveMaxMpFull = (player: Player, relics: Relic[], fallback: number): number => {
    try {
        const full = player ? calculateFullStats({ ...player, relics })?.maxMp : 0;
        if (typeof full === 'number' && full > 0) return full;
    } catch {
        // 최소 픽스처 — fallback.
    }
    return fallback;
};
