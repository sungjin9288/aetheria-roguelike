/**
 * DamageNumber — 데미지/회복 float 숫자 오버레이 (slice 29 개선).
 *
 * 기존엔 미정의 keyframe `floatUp`을 참조해 애니메이션이 죽어 있었고 위치도
 * 컨테이너 상단 밖(-top-6)이라 잘 안 보였다. floatUp 키프레임을 index.css에
 * 정의하고, 전투 영역(상단 38%) 중앙에 크게 띄워 타격감을 살린다.
 */
const DamageNumber = ({ amount }: any) => {
    if (!amount) return null;

    const isHeal = amount.isHeal;

    return (
        <span
            data-testid="damage-number"
            data-heal={isHeal ? 'true' : undefined}
            className={`pointer-events-none fixed left-1/2 top-[38%] z-[55] font-rajdhani text-2xl font-black ${
                isHeal ? 'text-emerald-300' : 'text-rose-300'
            }`}
            style={{
                animation: 'floatUp 1.2s ease-out forwards',
                whiteSpace: 'nowrap',
                textShadow: isHeal
                    ? '0 0 12px rgba(16,185,129,0.6), 0 2px 4px rgba(0,0,0,0.7)'
                    : '0 0 12px rgba(244,63,94,0.55), 0 2px 4px rgba(0,0,0,0.7)',
            }}
        >
            {isHeal ? '+' : '-'}{amount.value}
        </span>
    );
};

export default DamageNumber;
