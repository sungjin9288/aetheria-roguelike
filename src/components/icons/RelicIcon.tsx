import type { CSSProperties } from 'react';
import type { Relic } from '../../types/relic';
import { getRelicVisual } from '../../utils/relicVisuals';

interface RelicIconProps {
    relic?: Relic | null;
    size: number;
    completesLegendary?: boolean;
    className?: string;
}

/**
 * RelicIcon — 유물 그림을 육각 메달에 담는다(2026-10 에테르 유리 · 설계 규격 "유물 그림 육각 틀").
 *   틀 · 광채 색은 계열 하나가 정한다(`relicVisuals`의 토큰 → `--ae-relic-tone`). 크기만 부르는 쪽이 정한다.
 */
const RelicIcon = ({ relic, size, completesLegendary = false, className = '' }: RelicIconProps) => {
    const visual = getRelicVisual(relic, completesLegendary);
    const style = { width: size, height: size, '--ae-relic-tone': visual.tone } as CSSProperties;

    return (
        <span
            data-relic-visual-category={visual.category}
            className={`ae-relic-medal ${className}`.trim()}
            style={style}
        >
            <img
                src={visual.src}
                alt=""
                aria-hidden="true"
                className="ae-relic-medal-art"
            />
        </span>
    );
};

export default RelicIcon;
