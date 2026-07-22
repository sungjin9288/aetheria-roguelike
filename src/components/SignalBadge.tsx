
// cycle 419: md / lg 제거 — SignalBadge 73 호출 사이트 모두 size="sm" 명시.
//   default param도 'sm'로 변경 + fallback도 SIZE_CLASS.sm.
const SIZE_CLASS: any = {
    sm: 'min-h-[24px] px-2 py-0.5 aether-type-label tracking-normal',
};

const TONE_CLASS: any = {
    neutral: 'border-white/8 bg-white/[0.035] text-slate-300',
    recommended: 'border-[#7dd4d8]/28 bg-[#7dd4d8]/10 text-[#dff7f5] shadow-[0_10px_24px_rgba(125,212,216,0.12)]',
    resonance: 'border-[#9a8ac0]/28 bg-[#9a8ac0]/10 text-[#e3dcff] shadow-[0_10px_24px_rgba(154,138,192,0.12)]',
    upgrade: 'border-[#d5b180]/28 bg-[#d5b180]/10 text-[#f6e7c8] shadow-[0_10px_24px_rgba(213,177,128,0.12)]',
    success: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100 shadow-[0_10px_24px_rgba(110,231,183,0.1)]',
    warning: 'border-amber-300/24 bg-amber-300/10 text-amber-100 shadow-[0_10px_24px_rgba(252,211,77,0.1)]',
    danger: 'border-rose-300/24 bg-rose-400/10 text-rose-100 shadow-[0_10px_24px_rgba(251,113,133,0.1)]',
    equipped: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
    spotlight: 'border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]',
    // cycle 330: 'signature' tone 제거 — cycle 310 FocusPanel 제거 후 dispatch path 0건이던 dead.
    //   cycle 23 시점 적립된 signature pity '확률 증폭' emphasis surface가 유일 consumer였으나
    //   FocusPanel 자체 제거 → tone class도 cascade dead.
};

// cycle 433: default tone / size 제거 — 모든 73 호출자가 두 prop 명시 전달이라
//   default 도달 불가 (cycle 419 paired completion). SIZE_CLASS / TONE_CLASS
//   fallback `|| ...sm/.neutral`은 방어용 + cycle 419 회귀 가드로 보존.
// cycle 501: 외부 보조 클래스 prop 제거 — 77 호출자 모두 전달 0건이라 보간 결과
//   ''만 추가되는 unreachable. cycle 463/465/466/493/495/496/498 lens 회귀.
const SignalBadge = ({ tone, size, children, ...rest }: any) => (
    <span
        className={`inline-flex items-center justify-center rounded-full border font-fira uppercase backdrop-blur-md ${SIZE_CLASS[size] || SIZE_CLASS.sm} ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}
        {...rest}
    >
        {children}
    </span>
);

export default SignalBadge;
