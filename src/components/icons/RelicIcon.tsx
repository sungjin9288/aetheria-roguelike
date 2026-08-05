import type { Relic } from '../../types/relic';
import { getRelicVisual } from '../../utils/relicVisuals';

interface RelicIconProps {
    relic?: Relic | null;
    size: number;
    completesLegendary?: boolean;
    className?: string;
}

const RelicIcon = ({ relic, size, completesLegendary = false, className = '' }: RelicIconProps) => {
    const visual = getRelicVisual(relic, completesLegendary);

    return (
        <span
            data-relic-visual-category={visual.category}
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-black/28 ${className}`}
            style={{
                width: size,
                height: size,
                borderColor: `${visual.color}55`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px ${visual.glow}`,
            }}
        >
            <img
                src={visual.src}
                alt=""
                aria-hidden="true"
                className="pixelated h-[88%] w-[88%] object-contain"
            />
        </span>
    );
};

export default RelicIcon;
