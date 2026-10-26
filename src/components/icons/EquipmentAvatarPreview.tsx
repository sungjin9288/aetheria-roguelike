import { useMemo, useState } from 'react';
import { buildEquipmentPreviewAppearance, getEquipmentPreviewStage } from '../../utils/avatarEquipmentPreview.js';
import { getAvatarEquipmentPreviewCandidates } from '../../utils/avatarSpriteCandidates.js';
import AvatarEquipmentOverlay from './AvatarEquipmentOverlay.jsx';
import type { Item } from '../../types/index.js';

interface EquipmentAvatarPreviewProps {
    item?: Item | null;
    size: number;
    className?: string;
    variant?: string;
}

// cycle 434: 3 default 값 제거 — 1 호출자 (ItemIcon)가 size / variant / className
//   모두 명시 전달이라 default 도달 불가. variant ternary ('card' / else) 분기는
//   그대로 활성 (cycle 431-433에 이은 redundant default annotation 4-cycle 시리즈).
const EquipmentAvatarPreview = ({ item, size, className, variant }: EquipmentAvatarPreviewProps) => {
    const appearance = useMemo(() => buildEquipmentPreviewAppearance(item), [item]);
    const previewStage = useMemo(() => getEquipmentPreviewStage(item, appearance, variant), [item, appearance, variant]);
    const spriteCandidates = useMemo(
        () => getAvatarEquipmentPreviewCandidates(appearance),
        [appearance]
    );
    const spriteSignature = spriteCandidates.join('|');
    const [spriteState, setSpriteState] = useState({ signature: '', index: 0 });
    const activeSpriteState = spriteState.signature === spriteSignature ? spriteState : { signature: spriteSignature, index: 0 };
    const activeSpriteSrc = spriteCandidates[Math.min(activeSpriteState.index, spriteCandidates.length - 1)] || '/assets/avatars/canonical/adventurer.png';

    // 2026-10 에테르 유리(VD-06): 초점 광채 · 비네트는 토큰 채널이다. 이전 배경 선언은 `circle_at_…`(Tailwind 표기)가 섞여
    //   선언 전체가 무효였다 — 광채가 한 번도 그려지지 않았다. 이제 유효한 그라데이션 둘(초점 광채 + 가장자리 비네트)만 둔다.
    const glowTone = appearance.frameTone === '빛' ? 'var(--aether-gold-hi-rgb)' : 'var(--aether-ether-rgb)';
    const stageTransform = `translate(${previewStage.translateX}px, ${previewStage.translateY}px) scale(${previewStage.scale})`;
    const focusPoint = previewStage.focus === 'weapon'
        ? '72% 58%'
        : previewStage.focus === 'offhand'
            ? '28% 58%'
            : previewStage.focus === 'headgear'
                ? '50% 14%'
                : '50% 46%';
    const stageLight = `radial-gradient(circle at ${focusPoint}, rgb(${glowTone} / 0.14), transparent 40%), radial-gradient(circle at 50% 38%, transparent 44%, rgb(var(--aether-void-rgb) / 0.32) 100%)`;

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
                        setSpriteState((current) => {
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
                    background: stageLight,
                }}
            />
        </div>
    );
};

export default EquipmentAvatarPreview;
