import { getLocationVisual } from '../../utils/locationVisuals';

/**
 * 순간 카드의 지역 그림 틀(감사 VD-09) — 원정 정리 · 사망 화면이 이미 있는 지역 그림을 쓴다.
 *   발견 우선(Wave 103): 화면에 보이는 지역 이름으로만 찾는다 — '길 잃은 여행'처럼 이름을 가린 곳은 그림도 없다.
 *   그림은 장식이라 보조 기술에는 숨긴다.
 */
interface MomentRegionArtProps {
    location: string | null | undefined;
    className?: string;
}

const MomentRegionArt = ({ location, className }: MomentRegionArtProps) => {
    const visual = location ? getLocationVisual(location) : null;
    if (!visual) return null;
    return (
        <div
            data-testid="moment-region-art"
            data-location-visual={visual.key}
            aria-hidden="true"
            className={['ae-moment-region flex shrink-0 items-center justify-center overflow-hidden rounded-ae-md', className]
                .filter(Boolean)
                .join(' ')}
        >
            <img src={visual.src} alt="" className="h-full w-full object-contain p-1" />
        </div>
    );
};

export default MomentRegionArt;
