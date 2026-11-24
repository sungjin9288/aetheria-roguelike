import type { RelicEffect } from '../types/relic.js';

/**
 * 오늘의 시련의 시작 조건 표(2026-11). 지역은 구역 보스가 있고 지도를 걷는 사냥 지역이고, 완주율은 여기의 시작 조건
 * (레벨 · 장비 강화 · 물약)으로만 맞춘다 — 몬스터 수치는 본편 그대로다(측정: 원장의 '오늘의 시련' 절).
 */
export interface DailyTrialRegion {
    region: string;
    /** 시작 레벨 */
    level: number;
    /** 무기는 그 레벨에 쓸 수 있는 등급보다 이만큼 아래다 — 한 방에 끝나는 전투를 줄인다 */
    weaponTierDown: number;
    /** 장비 강화 단계(무기 · 방어구 · 보조 장비 모두) */
    enhance: number;
    /** 생명 물약 · 기력 물약 수 */
    hpPotions: number;
    mpPotions: number;
}

export const DAILY_TRIAL_REGIONS: readonly DailyTrialRegion[] = [
    { region: '신성한 호수', level: 10, weaponTierDown: 1, enhance: 2, hpPotions: 5, mpPotions: 2 },
    { region: '고대 하수도', level: 13, weaponTierDown: 1, enhance: 2, hpPotions: 5, mpPotions: 2 },
    { region: '몰락한 전초기지', level: 27, weaponTierDown: 1, enhance: 3, hpPotions: 5, mpPotions: 2 },
    { region: '기계 폐도', level: 44, weaponTierDown: 0, enhance: 4, hpPotions: 5, mpPotions: 2 },
    { region: '저주받은 묘지', level: 47, weaponTierDown: 0, enhance: 5, hpPotions: 6, mpPotions: 2 },
    { region: '암흑 성', level: 41, weaponTierDown: 1, enhance: 3, hpPotions: 5, mpPotions: 2 },
    { region: '용암 지대', level: 52, weaponTierDown: 0, enhance: 5, hpPotions: 6, mpPotions: 2 },
    { region: '세계수 숲', level: 41, weaponTierDown: 1, enhance: 2, hpPotions: 5, mpPotions: 2 },
    { region: '폭풍의 고원', level: 58, weaponTierDown: 0, enhance: 4, hpPotions: 6, mpPotions: 2 },
    { region: '천공 정원', level: 47, weaponTierDown: 1, enhance: 2, hpPotions: 5, mpPotions: 2 },
];

/** 시련 직업에 따른 시작 레벨 보정 — 같은 지역 · 같은 레벨에서 벌어지는 직업 차이를 줄인다(측정으로 정한다). */
export const DAILY_TRIAL_JOB_LEVEL_OFFSET: Readonly<Record<string, number>> = { 성직자: 5, 레인저: 1, 나이트: 1, 전사: -2, 어쌔신: 1 };

/** 시련에서 쓸모가 없는 유물 효과 — 골드 · 경험 · 전리품 · 사건 · 심연 · 숨은 보스 */
export const DAILY_TRIAL_EXCLUDED_RELIC_EFFECTS: ReadonlySet<RelicEffect> = new Set<RelicEffect>([
    'event_chance', 'gold_mult', 'exp_mult', 'drop_rate', 'boss_hunter', 'abyss_atk_scale', 'abyss_crit_scale', 'abyss_floor_power',
]);
