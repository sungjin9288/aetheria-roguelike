import type { Monster } from '../types/index.js';

/**
 * 보스 · 토벌 의뢰 우두머리가 처음 나타나는 순간의 띠 — 2026-10 (감사 GF-09).
 * 보스 단계 띠는 2 · 3단계 전환에만 있어서, 무게가 가장 큰 조우의 시작은 배지 하나와 기록 한 줄뿐이었다.
 * 띠는 누가 나타났는지만 말한다 — 위협 수치는 기록 줄(`getAppearThreatLine`)에 그대로 두고 권고는 붙이지 않는다(Wave 88 · 111).
 */
export type EncounterBannerKind = 'boss' | 'champion';

export interface EncounterBanner {
    kind: EncounterBannerKind;
    name: string;
}

/** 조우의 정체 — 종(`baseName`)이 기준이다. 격노 · 단계 전환으로 표시 이름이 바뀌어도 같은 조우다. */
export const getEncounterIdentity = (enemy: Monster | null | undefined): string | null => {
    if (!enemy) return null;
    return enemy.baseName || enemy.name || null;
};

/** 이 적이 등장 띠를 받는가 — 의뢰 우두머리 먼저(종은 일반 개체라 보스 표식이 없다), 그다음 보스. 정예 · 일반 적은 받지 않는다. */
export const getEncounterBanner = (enemy: Monster | null | undefined): EncounterBanner | null => {
    if (!enemy) return null;
    const name = enemy.name || enemy.baseName || '';
    if (!name) return null;
    if (enemy.huntChampion) return { kind: 'champion', name };
    if (enemy.isBoss) return { kind: 'boss', name };
    return null;
};

/**
 * 직전 조우의 정체 → 지금 적으로 바뀌며 새 조우가 시작됐다면 그 띠. 같은 조우가 이어지는 동안(턴마다 적 객체가 새로 만들어진다)은 null이다.
 * 전투가 끝나 적이 사라졌다가(정체 null) 같은 종이 다시 나타나면 새 조우다.
 * 이미 단계가 바뀐 적(2 · 3단계 · 격노)은 새로 나타난 적이 아니다 — 종 이름이 없는 적은 단계 전환이 표시 이름을 바꿔 정체가 달라 보인다.
 */
export const getEncounterBannerOnChange = (
    previousIdentity: string | null,
    enemy: Monster | null | undefined,
): EncounterBanner | null => {
    const identity = getEncounterIdentity(enemy);
    if (!identity || identity === previousIdentity) return null;
    if (enemy?.phase2Triggered || enemy?.phase3Triggered) return null;
    return getEncounterBanner(enemy);
};
