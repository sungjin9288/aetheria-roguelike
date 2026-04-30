import React, { useMemo, useState } from 'react';
import { buildEquipmentPreviewAppearance, getEquipmentPreviewStage } from '../../utils/avatarEquipmentPreview.js';
import { getAvatarEquipmentPreviewCandidates } from '../../utils/avatarSpriteCandidates.js';
import AvatarEquipmentOverlay from './AvatarEquipmentOverlay.jsx';

const EquipmentAvatarPreview = ({ item, size = 24, className = '', variant = 'default' }: any) => {
    const appearance = useMemo(() => buildEquipmentPreviewAppearance(item), [item]);
    const previewStage = useMemo(() => getEquipmentPreviewStage(item, appearance, variant), [item, appearance, variant]);
    const spriteCandidates = useMemo(
        () => getAvatarEquipmentPreviewCandidates(appearance),
        [appearance]
    );
    const spriteSignature = spriteCandidates.join('|');
    const [spriteState, setSpriteState] = useState({ signature: '', index: 0 });
    const activeSpriteState = spriteState.signature === spriteSignature ? spriteState : { signature: spriteSignature, index: 0 };
    const activeSpriteSrc = spriteCandidates[Math.min(activeSpriteState.index, spriteCandidates.length - 1)] || '/assets/avatars/adventurer.png';

    const glowColor = appearance.frameTone === '빛' ? 'rgba(246,231,200,0.12)' : 'rgba(125,212,216,0.12)';
    const stageTransform = `translate(${previewStage.translateX}px, ${previewStage.translateY}px) scale(${previewStage.scale})`;
    const focusAccent = previewStage.focus === 'weapon'
        ? 'radial-gradient(circle at 72% 58%, rgba(213,177,128,0.14), transparent 38%)'
        : previewStage.focus === 'offhand'
            ? 'radial-gradient(circle at 28% 58%, rgba(246,231,200,0.14), transparent 38%)'
            : previewStage.focus === 'headgear'
                ? 'radial-gradient(circle at 50% 14%, rgba(246,231,200,0.16), transparent 40%)'
                : previewStage.focus === 'armor'
                    ? 'radial-gradient(circle at 50% 48%, rgba(125,212,216,0.14), transparent 44%)'
                    : 'radial-gradient(circle at 50% 44%, rgba(125,212,216,0.12), transparent 42%)';

    return (
        <div
            data-item-icon-style="avatar-preview"
            data-item-icon-key={item?.name || item?.type || 'unknown'}
            data-preview-sprite={activeSpriteSrc}
            data-preview-focus={previewStage.focus}
            data-preview-variant={variant}
            className={`relative overflow-hidden ${className}`.trim()}
            style={{ width: size, height: size }}
        >
            <div
                className="absolute inset-0"
                style={{
                    transform: stageTransform,
                    transformOrigin: previewStage.origin || '50% 55%',
                }}
            >
                <AvatarEquipmentOverlay appearance={appearance} layer="back" />
                <img
                    src={activeSpriteSrc}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain pixelated opacity-[0.99]"
                    style={{
                        filter: variant === 'card'
                            ? 'brightness(0.98) saturate(1.02) contrast(1.08)'
                            : 'brightness(0.95) saturate(0.94) contrast(1.05)',
                    }}
                    onError={() => {
                        setSpriteState((current: any) => {
                            const currentState = current.signature === spriteSignature ? current : { signature: spriteSignature, index: 0 };
                            return {
                                signature: spriteSignature,
                                index: currentState.index < spriteCandidates.length - 1 ? currentState.index + 1 : currentState.index,
                            };
                        });
                    }}
                />
                <AvatarEquipmentOverlay appearance={appearance} layer="front" />
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                    background: `${previewStage.spotlight}, ${focusAccent}, radial-gradient(circle_at_50%_34%, ${glowColor} 0%, transparent 42%), radial-gradient(circle_at_50%_38%, transparent 0%, transparent 44%, rgba(6,10,15,0.14) 72%, rgba(6,10,15,0.34) 100%)`,
                }}
            />
        </div>
    );
};

export default EquipmentAvatarPreview;
