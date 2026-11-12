/**
 * 강화 갈래 — 강화가 정해진 단계(`BALANCE.ENHANCE_BRANCH_LEVELS`)에 닿을 때 고르는 두 효과 (2026-11 H6, 소유자 결정 "권고안대로").
 *
 * 골드가 가장 많이 나가는 곳(강화)에 고를 것을 붙인다. 효과는 엔진이 이미 읽는 능력치만 쓴다 — 새 엔진 경로가 없으므로
 * 설명 = 동작이다(Wave 52 ~ 59). 효과는 장비 행(`items.ts`)이 아니라 이 표에 있고, 고른 갈래는 장비 인스턴스의
 * `enhanceBranches`에 남는다(장비와 함께 사라진다 — 영구 능력치가 아니다, E9 · Wave 114).
 *
 * - `atkPct`: 그 무기의 공격력 값(양손 · 보조 손 배율 포함, 강화 보너스 제외) × 값을 공격력에 더한다(배율 안 — 장비 몫).
 * - `crit`: 치명타 확률 + 값.
 * - `defPct`: 그 방어구의 방어력 값 × 값을 방어력에 더한다(배율 안 — 장비 몫).
 * - `hpPct`: 저장된 최대 생명 × 값을 최대 생명에 더한다(장비 생명 보너스와 같은 자리).
 * - `mpPct`: 저장된 최대 기력 × 값을 최대 기력에 더한다(장비 기력 보너스와 같은 자리).
 * - `regen`: 전투에서 행동마다 최대 생명의 값만큼 회복(재생 장비 · 대지의 심장과 같은 틱).
 *
 * 수치는 H6 측정(원장)으로 다시 볼 수 있다. `tests/enhance-branch-contract.test.js`가 표 · 판정 · 엔진을 대조한다.
 */

/** 갈래가 붙는 장비 종류 — 무기(어느 손이든) · 방어구 · 보조 장비(방패 · 마력 보조 장비). */
export type EnhanceBranchKind = 'weapon' | 'armor' | 'offhand';

export type EnhanceBranchStat = 'atkPct' | 'crit' | 'defPct' | 'hpPct' | 'mpPct' | 'regen';

export interface EnhanceBranchDef {
    kind: EnhanceBranchKind;
    level: number;
    stat: EnhanceBranchStat;
    value: number;
}

export const ENHANCE_BRANCHES = Object.freeze({
    weapon_edge_3: { kind: 'weapon', level: 3, stat: 'atkPct', value: 0.06 },
    weapon_vital_3: { kind: 'weapon', level: 3, stat: 'crit', value: 0.04 },
    weapon_edge_6: { kind: 'weapon', level: 6, stat: 'atkPct', value: 0.1 },
    weapon_vital_6: { kind: 'weapon', level: 6, stat: 'crit', value: 0.06 },
    armor_guard_3: { kind: 'armor', level: 3, stat: 'defPct', value: 0.1 },
    armor_vigor_3: { kind: 'armor', level: 3, stat: 'hpPct', value: 0.05 },
    armor_guard_6: { kind: 'armor', level: 6, stat: 'defPct', value: 0.15 },
    armor_vigor_6: { kind: 'armor', level: 6, stat: 'hpPct', value: 0.08 },
    offhand_focus_3: { kind: 'offhand', level: 3, stat: 'mpPct', value: 0.1 },
    offhand_mend_3: { kind: 'offhand', level: 3, stat: 'regen', value: 0.01 },
    offhand_focus_6: { kind: 'offhand', level: 6, stat: 'mpPct', value: 0.15 },
    offhand_mend_6: { kind: 'offhand', level: 6, stat: 'regen', value: 0.015 },
} as const satisfies Record<string, EnhanceBranchDef>);

export type EnhanceBranchId = keyof typeof ENHANCE_BRANCHES;

export const ENHANCE_BRANCH_IDS = Object.freeze(Object.keys(ENHANCE_BRANCHES) as EnhanceBranchId[]);
