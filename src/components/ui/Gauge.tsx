import { getGaugePercent, toFiniteNumber } from './gaugeMath';

/**
 * Gauge — 생명 · 기력 · 경험 · 에테르 막대(2026-10 디자인 기반).
 *
 * - 홈은 sunk 톤, 채움은 lo → hi 그라데이션과 은은한 광채.
 * - `trail`(직전 값)이 지금 값보다 크면 그 사이를 잔상으로 그린다 — 맞은 만큼이 잠깐 남는다.
 * - `ticks`는 10% 눈금(적 생명 막대용), `size="lg"`는 12px 두께.
 * - 보조 기술에는 `role="meter"`로 읽힌다. 이름은 `label` 또는 `labelledBy` 중 하나가 반드시 있어야 한다(타입이 강제한다).
 */
export type GaugeKind = 'life' | 'will' | 'exp' | 'ether';
export type GaugeSize = 'md' | 'lg';

interface GaugeBaseProps {
    kind: GaugeKind;
    value: number;
    max: number;
    /** 직전 값 — 지금 값보다 클 때만 잔상으로 그린다. */
    trail?: number;
    /** 10% 눈금 */
    ticks?: boolean;
    size?: GaugeSize;
    /** 보조 기술이 읽는 값 문구(예: MSG로 만든 "생명 120 / 200"). */
    valueText?: string;
    className?: string;
    'data-testid'?: string;
}

type GaugeName =
    | { label: string; labelledBy?: never }
    | { labelledBy: string; label?: never };

export type GaugeProps = GaugeBaseProps & GaugeName;

const Gauge = ({
    kind,
    value,
    max,
    trail,
    ticks = false,
    size = 'md',
    valueText,
    className,
    label,
    labelledBy,
    'data-testid': testId,
}: GaugeProps) => {
    const safeMax = Math.max(0, toFiniteNumber(max));
    const safeValue = Math.min(safeMax, Math.max(0, toFiniteNumber(value)));
    const fillPercent = getGaugePercent(safeValue, safeMax);
    const trailPercent = trail === undefined ? null : getGaugePercent(trail, safeMax);
    const showTrail = trailPercent !== null && trailPercent > fillPercent;
    const classes = ['ae-gauge', `ae-gauge-${kind}`, 'ae-sunk', size === 'lg' ? 'ae-gauge-lg' : '', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            role="meter"
            aria-label={label}
            aria-labelledby={labelledBy}
            aria-valuemin={0}
            aria-valuemax={safeMax}
            aria-valuenow={safeValue}
            aria-valuetext={valueText}
            data-testid={testId}
            data-kind={kind}
            className={classes}
        >
            {showTrail ? (
                <div className="ae-gauge-trail" data-gauge-part="trail" style={{ width: `${trailPercent}%` }} />
            ) : null}
            <div className="ae-gauge-fill" data-gauge-part="fill" style={{ width: `${fillPercent}%` }} />
            {ticks ? <div className="ae-gauge-ticks" data-gauge-part="ticks" aria-hidden="true" /> : null}
        </div>
    );
};

export default Gauge;
