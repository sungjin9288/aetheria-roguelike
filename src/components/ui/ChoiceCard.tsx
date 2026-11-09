import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

/**
 * ChoiceCard — 선택 화면 하나의 문법(2026-11 디자인 고도화 A6).
 *
 * 유물 선택 · 이벤트 선택지(정찰 · 모닥불 · 이야기 포함) · 회차 규칙 카드 · 기술 분기가 같은 카드를 쓴다:
 *   아이콘 · 계열 빛(테두리 · 안쪽 번짐) · 머리 칩 · 이름 · 효과 한 줄 · 덧붙는 줄(조합 · 영향 점) · 대가 한 줄.
 * 판단 근거를 고르는 쪽이 정하고(유물 추천 · 조합, 이벤트 미리보기, 규칙 선택형), 카드는 그리기만 한다.
 *
 * 배치 두 가지 — `row`(아이콘 왼쪽, 세로 목록: 유물 · 이벤트)와 `tile`(아이콘 위, 2 ~ 3열: 규칙 · 기술 분기).
 * 강조는 하나다 — `recommended`(에테르 림) · `selected`(에테르 테두리) · `target`(금 림) · `confirming`(금빛 확정 박자).
 */
export type ChoiceCardLayout = 'row' | 'tile';
export type ChoiceCardEmphasis = 'recommended' | 'selected' | 'target' | 'confirming';

export interface ChoiceCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'children'> {
    layout?: ChoiceCardLayout;
    /** 왼쪽(row) · 위(tile) 아이콘 칸. 없으면 칸을 그리지 않는다. */
    icon?: ReactNode;
    /** 계열 빛의 RGB 세 값 — 토큰 변수(`var(--aether-gold-rgb)`)나 계열 표의 값. 없으면 에테르. */
    toneRgb?: string;
    /** 이름 위의 작은 머리(칩 · 눈썹 글자). */
    head?: ReactNode;
    title: ReactNode;
    titleClassName?: string;
    /** 효과 한 줄 — 이 선택이 하는 일. */
    effect?: ReactNode;
    effectClassName?: string;
    /** 효과 아래 덧붙는 줄(조합 · 영향 점 · 측정 값). `ChoiceCardLine`을 쓴다. */
    lines?: ReactNode;
    /** 대가 한 줄 — 위험 색. */
    cost?: ReactNode;
    costTestId?: string;
    emphasis?: ChoiceCardEmphasis | null;
    /** 다른 카드를 확정하는 동안 흐리게. */
    dimmed?: boolean;
    /** `row` 카드를 1024px 이상(세 열 배치)에서 `tile`처럼 아이콘 위로 쌓는다. */
    stackOnDesktop?: boolean;
    'data-testid'?: string;
}

type ToneStyle = CSSProperties & { '--ae-choice-tone'?: string };

const ChoiceCard = ({
    layout = 'row',
    icon,
    toneRgb,
    head,
    title,
    titleClassName = 'text-ae-ink',
    effect,
    effectClassName = 'text-ae-ink-2',
    lines,
    cost,
    costTestId,
    emphasis = null,
    dimmed = false,
    stackOnDesktop = false,
    className,
    style,
    type = 'button',
    ...buttonProps
}: ChoiceCardProps) => {
    const toneStyle: ToneStyle = toneRgb ? { ...style, '--ae-choice-tone': toneRgb } : { ...style };
    const classes = ['ae-card ae-choice-card', className].filter(Boolean).join(' ');
    return (
        <button
            {...buttonProps}
            type={type}
            data-choice-layout={layout}
            data-choice-emphasis={emphasis ?? undefined}
            data-choice-dimmed={dimmed ? 'true' : undefined}
            data-choice-stack={stackOnDesktop ? 'lg' : undefined}
            style={toneStyle}
            className={classes}
        >
            {icon ? <span className="ae-choice-card-icon" aria-hidden="true">{icon}</span> : null}
            <span className="ae-choice-card-body">
                {head ? <span className="ae-choice-card-head">{head}</span> : null}
                <span className={`ae-choice-card-title font-readable ${titleClassName}`}>{title}</span>
                {effect ? <span className={`ae-choice-card-effect font-readable ${effectClassName}`}>{effect}</span> : null}
                {lines}
                {cost ? (
                    <span data-testid={costTestId} className="ae-choice-card-line font-readable text-ae-threat">{cost}</span>
                ) : null}
            </span>
        </button>
    );
};

export interface ChoiceCardLineProps {
    icon?: ReactNode;
    /** 글자 색 클래스(토큰). */
    className?: string;
    children: ReactNode;
    'data-testid'?: string;
}

/** 카드 안의 덧붙는 한 줄 — 아이콘(장식) + 글. */
export const ChoiceCardLine = ({ icon, className = 'text-ae-ink-2', children, ...rest }: ChoiceCardLineProps) => (
    <span {...rest} className={`ae-choice-card-line font-readable ${className}`}>
        {icon ? <span className="ae-choice-card-line-icon" aria-hidden="true">{icon}</span> : null}
        <span className="min-w-0">{children}</span>
    </span>
);

export default ChoiceCard;
