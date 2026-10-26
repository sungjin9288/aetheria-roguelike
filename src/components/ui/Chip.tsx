import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Chip — 짧은 상태 표시(2026-10 디자인 기반). 조작이 아니므로 최소 높이 22px, 글자 11px.
 * 누를 수 있는 칩이 필요하면 버튼으로 감싸 44px을 부르는 쪽이 준다.
 *
 * 의미 색: neutral(기본) · ether(정보 · 진행) · gold(보상) · threat(위험) · good(좋음 · 완료).
 */
export type ChipTone = 'neutral' | 'ether' | 'gold' | 'threat' | 'good';

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    tone?: ChipTone;
    /** 글자 앞 아이콘 — 장식이므로 보조 기술에는 숨긴다. */
    icon?: ReactNode;
    children: ReactNode;
    'data-testid'?: string;
}

const TONE_CLASS: Readonly<Record<ChipTone, string>> = Object.freeze({
    neutral: '',
    ether: 'ae-chip-ether',
    gold: 'ae-chip-gold',
    threat: 'ae-chip-threat',
    good: 'ae-chip-good',
});

const Chip = ({ tone = 'neutral', icon, children, className, ...spanProps }: ChipProps) => {
    const classes = ['ae-chip', TONE_CLASS[tone], className].filter(Boolean).join(' ');
    return (
        <span {...spanProps} data-tone={tone} className={classes}>
            {icon ? <span className="ae-chip-icon" aria-hidden="true">{icon}</span> : null}
            {children}
        </span>
    );
};

export default Chip;
