import React, { useMemo, useState } from 'react';
import { deriveCharacterAppearance } from '../utils/characterAppearance';
import { getAvatarSpriteCandidates } from '../utils/avatarSpriteCandidates';
import { resolveCharacterLayers } from '../utils/layeredCharacter.js';
import LayeredCharacter from './LayeredCharacter.jsx';

const SIZE_MAP = {
    sm: {
        frame: 'h-[4.6rem] w-[4.6rem] rounded-[1.25rem] p-1.5',
        inner: 'rounded-[0.95rem]',
        badge: 'text-[8px] px-1.5 py-[1px]',
    },
    md: {
        frame: 'h-[5.45rem] w-[5.45rem] rounded-[1.35rem] p-2',
        inner: 'rounded-[1.05rem]',
        badge: 'text-[8px] px-1.5 py-0.5',
    },
    lg: {
        frame: 'h-[6.95rem] w-[6.95rem] rounded-[1.55rem] p-2.5',
        inner: 'rounded-[1.2rem]',
        badge: 'text-[9px] px-2 py-0.5',
    },
};

const FRAME_TONE_CLASS = {
    화염: 'border-orange-300/28 bg-[radial-gradient(circle_at_76%_16%,rgba(251,146,60,0.26),transparent_26%),linear-gradient(180deg,rgba(35,20,12,0.98)_0%,rgba(8,8,8,1)_100%)]',
    냉기: 'border-cyan-300/24 bg-[radial-gradient(circle_at_76%_16%,rgba(103,232,249,0.22),transparent_28%),linear-gradient(180deg,rgba(14,22,34,0.98)_0%,rgba(7,10,16,1)_100%)]',
    어둠: 'border-violet-300/26 bg-[radial-gradient(circle_at_76%_16%,rgba(167,139,250,0.24),transparent_28%),linear-gradient(180deg,rgba(23,17,36,0.98)_0%,rgba(7,7,16,1)_100%)]',
    빛: 'border-[#d5b180]/24 bg-[radial-gradient(circle_at_76%_16%,rgba(246,231,200,0.18),transparent_26%),linear-gradient(180deg,rgba(34,26,18,0.98)_0%,rgba(12,11,10,1)_100%)]',
    자연: 'border-emerald-300/24 bg-[radial-gradient(circle_at_76%_16%,rgba(134,239,172,0.2),transparent_28%),linear-gradient(180deg,rgba(16,28,22,0.98)_0%,rgba(7,10,9,1)_100%)]',
    대지: 'border-amber-300/22 bg-[radial-gradient(circle_at_76%_16%,rgba(214,179,139,0.2),transparent_28%),linear-gradient(180deg,rgba(31,25,21,0.98)_0%,rgba(10,9,8,1)_100%)]',
};

const softenColor = (hex, alpha = 0.24) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
        return `rgba(255,255,255,${alpha})`;
    }

    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const PixelCharacterAvatar = ({
    player = null,
    appearance: providedAppearance = null,
    size = 'sm',
    className = '',
    onClick = null,
    interactive = false,
    showEnhanceBadge = true,
    dataTestId = null,
    label = '캐릭터 외형',
}) => {
    const appearance = useMemo(
        () => providedAppearance || deriveCharacterAppearance(player),
        [player, providedAppearance]
    );

    const sizeConfig = SIZE_MAP[size] || SIZE_MAP.sm;
    const totalEnhance = (appearance.weapon?.enhance || 0) + (appearance.offhand?.enhance || 0) + (appearance.armor?.enhance || 0);
    const frameToneClass = FRAME_TONE_CLASS[appearance.frameTone]
        || 'border-white/10 bg-[radial-gradient(circle_at_76%_16%,rgba(125,212,216,0.16),transparent_28%),linear-gradient(180deg,rgba(18,24,32,0.98)_0%,rgba(8,12,18,1)_100%)]';

    const spriteCandidates = useMemo(
        () => getAvatarSpriteCandidates(appearance),
        [appearance]
    );
    const spriteSignature = spriteCandidates.join('|');
    const [spriteState, setSpriteState] = useState({ signature: '', index: 0 });
    const activeSpriteState = spriteState.signature === spriteSignature ? spriteState : { signature: spriteSignature, index: 0 };
    const activeSpriteSrc = spriteCandidates[Math.min(activeSpriteState.index, spriteCandidates.length - 1)] || '/assets/avatars/adventurer.png';

    // cycle 47: layered character system. body 자산이 manifest에 있으면 layered 합성,
    // 없으면 폴백 (직업 sprite, cycle 46).
    const layers = useMemo(() => resolveCharacterLayers(player), [player]);

    const avatar = (
        <div
            data-testid={dataTestId}
            data-avatar-weapon={appearance.weapon?.art?.key || appearance.weapon?.visual || 'none'}
            data-avatar-offhand={appearance.offhand?.art?.key || appearance.offhand?.visual || 'none'}
            data-avatar-armor={appearance.armor?.art?.key || appearance.armor?.visual || 'none'}
            data-avatar-headgear={appearance.armor?.art?.headgearStyle || 'none'}
            className={`panel-noise relative overflow-hidden border shadow-[0_14px_28px_rgba(3,8,16,0.34),inset_0_1px_0_rgba(255,255,255,0.05)] ${sizeConfig.frame} ${frameToneClass} ${className}`.trim()}
            aria-label={`${label} · ${appearance.job}`}
        >
            <div className="pointer-events-none absolute inset-x-2 top-1 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
            <div className="pointer-events-none absolute inset-[3px] rounded-[inherit] border border-white/[0.04]" />
            <div className="pointer-events-none absolute -right-1 top-1 h-5 w-5 rounded-full blur-[10px]" style={{ backgroundColor: softenColor(appearance.palette.glow || appearance.palette.accent, 0.28) }} />
            <div className={`relative h-full w-full overflow-hidden ${sizeConfig.inner}`}>
                {/* cycle 55: avatar = job skin (단일 body PNG).
                    장비는 슬롯 UI + 스탯 + 세트 효과로만 표현 (avatar에 합성 X).
                    layered 활성 시 LayeredCharacter (body 한 장) 렌더,
                    폴백 시 cycle 46 직업 sprite 렌더. AvatarEquipmentOverlay
                    (cycle 35 SVG 덧그리기)는 양쪽 모두에서 비활성. */}
                {layers ? (
                    <LayeredCharacter layers={layers} />
                ) : (
                    <img
                        src={activeSpriteSrc}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full scale-[1.04] object-contain pixelated drop-shadow-[0_10px_16px_rgba(0,0,0,0.28)]"
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
                )}
            </div>
            {showEnhanceBadge && totalEnhance > 0 && (
                <span className={`absolute bottom-1 right-1 rounded-full border border-[#d5b180]/28 bg-[#d5b180]/16 font-fira font-bold text-[#f6e7c8] shadow-[0_6px_18px_rgba(213,177,128,0.22)] ${sizeConfig.badge}`}>
                    +{totalEnhance}
                </span>
            )}
        </div>
    );

    if (interactive && onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="pointer-events-auto rounded-[1rem] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                aria-label={label}
            >
                {avatar}
            </button>
        );
    }

    return avatar;
};

export default PixelCharacterAvatar;
