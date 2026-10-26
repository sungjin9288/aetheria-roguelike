import type { HTMLAttributes, ReactNode } from 'react';
import Chip, { type ChipTone } from '../ui/Chip';

/**
 * SignalChip — 기록 탭 A(장비 · 가방 · 기술 · 상태 · 지도)의 상태 칩. 2026-10 에테르 유리.
 *
 * 이 화면들은 예전 `SignalBadge`의 의미 이름(recommended · equipped · warning …)으로 칩을 고른다. 그 이름을 그대로 받아
 * 디자인 기반의 `Chip` 다섯 색 가운데 하나로 옮긴다 — 색은 토큰뿐이고(원시 hex · 대문자 변환 없음), 의미 이름은 화면 코드에 남는다.
 */
export type SignalTone =
    | 'neutral'
    | 'recommended'
    | 'resonance'
    | 'upgrade'
    | 'success'
    | 'warning'
    | 'danger'
    | 'equipped'
    | 'spotlight';

const TONE_TO_CHIP: Readonly<Record<SignalTone, ChipTone>> = Object.freeze({
    neutral: 'neutral',
    recommended: 'ether',
    resonance: 'ether',
    upgrade: 'gold',
    success: 'good',
    warning: 'neutral',
    danger: 'threat',
    equipped: 'good',
    spotlight: 'gold',
});

const toChipTone = (tone: string | null | undefined): ChipTone => (
    TONE_TO_CHIP[(tone ?? 'neutral') as SignalTone] ?? 'neutral'
);

interface SignalChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    tone?: string | null;
    icon?: ReactNode;
    children: ReactNode;
    'data-testid'?: string;
}

const SignalChip = ({ tone, ...chipProps }: SignalChipProps) => (
    <Chip {...chipProps} tone={toChipTone(tone)} data-signal-tone={tone ?? 'neutral'} />
);

export default SignalChip;
