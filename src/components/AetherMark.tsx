
// cycle 418: sm 제거 — AetherMark consumers (IntroScreen / BootScreen)는
//   md / lg만 사용. size="sm" 호출 0건이라 SIZE_MAP.sm lookup 절대 hit 안 됨.
const SIZE_MAP: any = {
    md: {
        shell: 'h-10 w-10',
    },
    lg: {
        shell: 'h-16 w-16',
    },
};

// cycle 432: default size 값 제거 — 2 호출자 (IntroScreen "md" / BootScreen "lg")
//   모두 명시 전달이라 default 도달 불가. cycle 418 SIZE_MAP.sm 정리의 paired
//   completion (lookup table cleanup 후 잔존 default 정리). SIZE_MAP fallback도
//   방어용 보존.
// cycle 493: 외부 보조 클래스 prop 제거 — 2 호출자 모두 전달 0건이라 보간 결과
//   ''만 추가되는 unreachable. cycle 463/465/466 icons/ paired 패턴 회귀.
const AetherMark = ({ size }: any) => {
    const scale = SIZE_MAP[size] || SIZE_MAP.md;

    return (
        <img
            src="/icons/icon-192.png"
            alt=""
            className={`${scale.shell} shrink-0 rounded-[22%] object-cover shadow-[0_0_28px_rgba(125,212,216,0.18)]`}
            aria-hidden="true"
        />
    );
};

export default AetherMark;
