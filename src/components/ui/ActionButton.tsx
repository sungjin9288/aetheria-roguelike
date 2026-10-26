import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * ActionButton — 에테르 유리 행동 버튼(2026-10 디자인 기반).
 *
 * - `primary`: 금빛 주 행동. 화면마다 하나만 쓴다(`.ae-btn-primary`).
 * - `glass`: 보조 행동(기본값 — 주 행동은 일부러 고른다).
 * - `ghost`: 낮은 위험 행동(닫기 · 도주 · 넘기기).
 * - `danger`: 되돌릴 수 없는 위험 행동.
 *
 * 크기는 `md` 48px · `lg` 56px — 둘 다 터치 하한(44px) 위다. 글자는 부르는 쪽이 MSG로 넘긴다.
 * 그 밖의 버튼 속성(onClick · disabled · aria-* · data-testid …)은 그대로 `<button>`에 넘어간다.
 */
export type ActionButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger';
export type ActionButtonSize = 'md' | 'lg';

export interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    variant?: ActionButtonVariant;
    size?: ActionButtonSize;
    /** 글자 앞 아이콘 — 장식이므로 보조 기술에는 숨긴다. */
    icon?: ReactNode;
    label: ReactNode;
    /** 목적지 부제 등 두 번째 줄(11px). */
    sublabel?: ReactNode;
    'data-testid'?: string;
}

const VARIANT_CLASS: Readonly<Record<ActionButtonVariant, string>> = Object.freeze({
    primary: 'ae-btn-primary',
    glass: 'ae-btn-glass',
    ghost: 'ae-btn-ghost',
    danger: 'ae-btn-danger',
});

const SIZE_CLASS: Readonly<Record<ActionButtonSize, string>> = Object.freeze({
    md: '',
    lg: 'ae-btn-lg',
});

const ActionButton = ({
    variant = 'glass',
    size = 'md',
    icon,
    label,
    sublabel,
    className,
    type = 'button',
    ...buttonProps
}: ActionButtonProps) => {
    const classes = ['ae-btn', VARIANT_CLASS[variant], SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(' ');

    return (
        <button
            {...buttonProps}
            type={type}
            data-variant={variant}
            data-size={size}
            className={classes}
        >
            {icon ? <span className="ae-btn-icon" aria-hidden="true">{icon}</span> : null}
            {sublabel ? (
                <span className="ae-btn-text">
                    <span>{label}</span>
                    <span className="ae-btn-sublabel">{sublabel}</span>
                </span>
            ) : label}
        </button>
    );
};

export default ActionButton;
