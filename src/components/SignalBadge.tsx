import type { ComponentPropsWithoutRef } from 'react';

// cycle 419: md / lg 제거 — SignalBadge 73 호출 사이트 모두 size="sm" 명시.
//   default param도 'sm'로 변경 + fallback도 SIZE_CLASS.sm.
const SIZE_CLASS: Record<string, string> = {
    sm: 'min-h-[24px] px-2 py-0.5 aether-type-label tracking-normal',
};

// 2026-10 에테르 유리 3차(shell): 톤은 테두리 없는 유리 칩이다 — 바탕 씻김 + 글자색 하나(토큰). 회색 테두리 · 그림자 · 흐림은 지웠다.
//   아홉 톤의 이름 · 뜻은 그대로다(추천 = 에테르, 공명 = 경험 보라, 강화 · 조명 = 금, 성공 · 장착 = 초록, 주의 = 금, 위험 = 붉음).
const TONE_CLASS: Record<string, string> = {
    neutral: 'bg-ae-ink/[0.08] text-ae-ink-2',
    recommended: 'bg-ae-ether/[0.12] text-ae-ether-hi',
    resonance: 'bg-ae-exp/[0.12] text-ae-exp',
    upgrade: 'bg-ae-gold/[0.12] text-ae-gold-text',
    success: 'bg-ae-good/[0.12] text-ae-good',
    warning: 'bg-ae-gold/[0.14] text-ae-gold-hi',
    danger: 'bg-ae-threat/[0.14] text-ae-threat',
    equipped: 'bg-ae-good/[0.1] text-ae-good',
    spotlight: 'bg-ae-gold/[0.1] text-ae-gold-text shadow-[inset_0_0_0_1px_rgb(var(--aether-gold-rgb)/0.24)]',
    // cycle 330: 'signature' tone 제거 — cycle 310 FocusPanel 제거 후 dispatch path 0건이던 dead.
    //   cycle 23 시점 적립된 signature pity '확률 증폭' emphasis surface가 유일 consumer였으나
    //   FocusPanel 자체 제거 → tone class도 cascade dead.
};

// cycle 433: default tone / size 제거 — 모든 73 호출자가 두 prop 명시 전달이라
//   default 도달 불가 (cycle 419 paired completion). SIZE_CLASS / TONE_CLASS
//   fallback `|| ...sm/.neutral`은 방어용 + cycle 419 회귀 가드로 보존.
// cycle 501: 외부 보조 클래스 prop 제거 — 77 호출자 모두 전달 0건이라 보간 결과
//   ''만 추가되는 unreachable. cycle 463/465/466/493/495/496/498 lens 회귀.
interface SignalBadgeProps extends ComponentPropsWithoutRef<'span'> {
    tone?: string;
    size?: string;
}

const SignalBadge = ({ tone, size, children, ...rest }: SignalBadgeProps) => (
    <span
        className={`inline-flex items-center justify-center rounded-full font-readable font-bold ${SIZE_CLASS[size ?? ''] || SIZE_CLASS.sm} ${TONE_CLASS[tone ?? ''] || TONE_CLASS.neutral}`}
        {...rest}
    >
        {children}
    </span>
);

export default SignalBadge;
