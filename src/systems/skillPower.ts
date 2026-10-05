/**
 * 2026-10 Wave 52 (소유자 결정 "피해를 없앤다"): 위력(`mult`)이 있는 기술만 적에게 기본 피해를 준다.
 *
 * 보조 기술(버프 · 약화 · 회복 · 템포 — 직업 기술 42개와 특성 기술 4개)은 위력이 없다. 이전에는 엔진이
 * `mult || 1.5`로 그 기술들에도 설명에 없는 공격력 1.5배 피해를 줬다. 화면(`formatSkillPower`)과 엔진
 * (`performSkill`)이 같은 판정을 읽는다 — 위력이 보이지 않는 기술은 피해를 주지 않는다.
 */
export const isDamagingSkill = (skill: { mult?: number } | null | undefined): boolean =>
    typeof skill?.mult === 'number' && skill.mult > 0;

/**
 * 2026-10 Wave 65 (원장 §61.5 · §66): 기술이 피해를 줄 때 쓰는 원소 — 기술 `type`이 없으면 무기 원소(`stats.elem`)다.
 * 엔진(`performSkill`)과 전투 예고의 "약점" 표시가 같은 판정을 읽는다. 예고가 `type`만 보던 동안 무기 원소를 쓰는
 * 위력 기술 24개(파워배시 · 암살 · 저격 …)는 약점을 찔러도 표시가 없었다.
 */
export function getSkillElement(skill: { type?: string } | null | undefined, stats: { elem: string }): string;
export function getSkillElement(skill: { type?: string } | null | undefined, stats: { elem?: string } | null | undefined): string | undefined;
export function getSkillElement(skill: { type?: string } | null | undefined, stats: { elem?: string } | null | undefined): string | undefined {
    return skill?.type || stats?.elem;
}
