import { useMemo, useState } from 'react';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../utils/avatarSpriteCandidates';
import type { Player } from '../types/index.js';

/** deriveCharacterAppearance의 실제 반환 모양 — 재선언 없이 producer의 ReturnType을 그대로 쓴다. */
type CharacterAppearance = ReturnType<typeof deriveCharacterAppearance>;

const SIZE_MAP: Record<string, { frame: string; inner: string; badge: string }> = {
    sm: {
        frame: 'h-[4.6rem] w-[4.6rem] rounded-ae-lg p-1.5',
        inner: 'rounded-ae-md',
        badge: 'text-[11px] px-1.5 py-[1px]',
    },
    md: {
        frame: 'h-[5.45rem] w-[5.45rem] rounded-ae-lg p-2',
        inner: 'rounded-ae-md',
        badge: 'text-[11px] px-1.5 py-0.5',
    },
    lg: {
        frame: 'h-[6.95rem] w-[6.95rem] rounded-ae-xl p-2.5',
        inner: 'rounded-ae-lg',
        badge: 'text-[11px] px-2 py-0.5',
    },
};

// 2026-10 에테르 유리(VD-06): 계열 색은 `.ae-avatar-frame`(index.css w3:archive-a)의 토큰 별칭이다 — 바탕은 표면 톤(s3 → sunk),
//   계열은 위쪽 광채와 림 한 줄에만 남는다.
const FRAME_TONE_CLASS: Record<string, string> = {
    화염: 'is-fire',
    냉기: 'is-frost',
    어둠: 'is-shadow',
    빛: 'is-holy',
    자연: 'is-nature',
    대지: 'is-earth',
};

// cycle 529: alpha default 0.24 제거 — 1 internal callsite (line 89)
//   softenColor(palette.glow || palette.accent, 0.28) 명시 전달이라 default
//   도달 불가. components/ private helper로 lens 확장 (cycle 502-528 utils
//   메가 시리즈 26번째).
const softenColor = (hex: string | null | undefined, alpha: number) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
        return `rgba(255,255,255,${alpha})`;
    }

    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

// cycle 499: 5 redundant default 제거 — 2 callsite 모두 명시 전달이라 default
//   도달 불가 (player / size / className / dataTestId / label). 활성 default
//   보존: providedAppearance / onClick / interactive / showEnhanceBadge (호출자
//   부분 누락 path). cycle 451-452/467 패턴 회귀.
interface PixelCharacterAvatarProps {
    player: Player;
    appearance?: Partial<CharacterAppearance> | null;
    size: 'sm' | 'md' | 'lg';
    className?: string;
    onClick?: (() => void) | null;
    interactive?: boolean;
    showEnhanceBadge?: boolean;
    dataTestId?: string;
    label: string;
}

const PixelCharacterAvatar = ({
    player,
    appearance: providedAppearance = null,
    size,
    className,
    onClick = null,
    interactive = false,
    showEnhanceBadge = true,
    dataTestId,
    label,
}: PixelCharacterAvatarProps) => {
    const appearance = useMemo(() => {
        const appearancePlayer = providedAppearance?.job
            ? { ...player, job: providedAppearance.job }
            : player;
        const derivedAppearance = deriveCharacterAppearance(appearancePlayer);

        if (!providedAppearance) return derivedAppearance;

        return {
            ...derivedAppearance,
            ...providedAppearance,
            palette: {
                ...derivedAppearance.palette,
                ...providedAppearance.palette,
            },
        };
    }, [player, providedAppearance]);

    const sizeConfig = SIZE_MAP[size] || SIZE_MAP.sm;
    const totalEnhance = (appearance.weapon?.enhance || 0) + (appearance.offhand?.enhance || 0) + (appearance.armor?.enhance || 0);
    const frameToneClass = FRAME_TONE_CLASS[appearance.frameTone ?? ''] || '';

    const spriteCandidates = useMemo(
        () => getAvatarSpriteCandidates(appearance),
        [appearance]
    );
    const spriteSignature = spriteCandidates.join('|');
    const [spriteState, setSpriteState] = useState({ signature: '', index: 0 });
    const activeSpriteState = spriteState.signature === spriteSignature ? spriteState : { signature: spriteSignature, index: 0 };
    const activeSpriteSrc = spriteCandidates[Math.min(activeSpriteState.index, spriteCandidates.length - 1)] || '/assets/avatars/adventurer.png';

    const avatar = (
        <div
            data-testid={dataTestId}
            data-avatar-weapon={appearance.weapon?.art?.key || appearance.weapon?.visual || 'none'}
            data-avatar-offhand={appearance.offhand?.art?.key || appearance.offhand?.visual || 'none'}
            data-avatar-armor={appearance.armor?.art?.key || appearance.armor?.visual || 'none'}
            data-avatar-headgear={appearance.armor?.art?.headgearStyle || 'none'}
            className={`ae-avatar-frame relative overflow-hidden ${sizeConfig.frame} ${frameToneClass} ${className ?? ''}`.trim()}
            aria-label={`${label} · ${appearance.job}`}
        >
            <div className="pointer-events-none absolute -right-1 top-1 h-5 w-5 rounded-full blur-[10px]" style={{ backgroundColor: softenColor(appearance.palette.glow || appearance.palette.accent, 0.28) }} />
            <div className={`relative h-full w-full overflow-hidden ${sizeConfig.inner}`}>
                {/* cycle 56+: avatar = cycle 46 직업별 sprite (망토+갑옷+무기 baked-in).
                    장비 변화는 슬롯 UI + 스탯 + 세트 효과(직업 호환 카탈로그)로만 표현. */}
                <img
                    src={activeSpriteSrc}
                    alt=""
                    aria-hidden="true"
                    className="ae-avatar-sprite h-full w-full object-contain pixelated"
                    onError={() => {
                        setSpriteState((current) => {
                            const currentState = current.signature === spriteSignature ? current : { signature: spriteSignature, index: 0 };
                            return {
                                signature: spriteSignature,
                                index: currentState.index < spriteCandidates.length - 1 ? currentState.index + 1 : currentState.index,
                            };
                        });
                    }}
                />
            </div>
            {showEnhanceBadge && totalEnhance > 0 && (
                <span
                    data-testid="avatar-enhance-badge"
                    aria-label={`장비 강화 합계 ${totalEnhance}`}
                    className={`ae-chip ae-chip-gold absolute bottom-1 right-1 whitespace-nowrap font-readable font-bold ${sizeConfig.badge}`}
                >
                    강화 +{totalEnhance}
                </span>
            )}
        </div>
    );

    if (interactive && onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="pointer-events-auto rounded-ae-lg transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none"
                aria-label={label}
            >
                {avatar}
            </button>
        );
    }

    return avatar;
};

export default PixelCharacterAvatar;
