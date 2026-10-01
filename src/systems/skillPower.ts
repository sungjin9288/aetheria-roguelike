/**
 * 2026-10 Wave 52 (소유자 결정 "피해를 없앤다"): 위력(`mult`)이 있는 기술만 적에게 기본 피해를 준다.
 *
 * 보조 기술(버프 · 약화 · 회복 · 템포 — 직업 기술 42개와 특성 기술 4개)은 위력이 없다. 이전에는 엔진이
 * `mult || 1.5`로 그 기술들에도 설명에 없는 공격력 1.5배 피해를 줬다. 화면(`formatSkillPower`)과 엔진
 * (`performSkill`)이 같은 판정을 읽는다 — 위력이 보이지 않는 기술은 피해를 주지 않는다.
 */
export const isDamagingSkill = (skill: { mult?: number } | null | undefined): boolean =>
    typeof skill?.mult === 'number' && skill.mult > 0;
