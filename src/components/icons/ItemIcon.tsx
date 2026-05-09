import { useMemo, useState } from 'react';
import { BALANCE } from '../../data/constants';
import { getItemRarity } from '../../utils/gameUtils';
import { getEquipmentVisualKey, getItemIconAssetSrc } from '../../utils/itemVisuals';
import { getSignatureMetadata, hasDedicatedSignatureArt } from '../../data/signatureItems.js';
import EquipmentAvatarPreview from './EquipmentAvatarPreview.jsx';
import SignatureBadge from './SignatureBadge.jsx';

// cycle 412: steel 제거 — signatureRegistry.json은 8 tone (arcane/earth/fire/
//   frost/holy/nature/rust/shadow)만 emit. SIGNATURE_TONE_RING.steel lookup 절대
//   hit 안 됨 (cycle 358 LegendaryDropOverlay/LegendaryCodex paired completion).
const SIGNATURE_TONE_RING: any = Object.freeze({
    holy: { border: '#f6e7a2', glow: 'rgba(246,231,162,0.45)' },
    fire: { border: '#ffb48a', glow: 'rgba(255,180,138,0.45)' },
    frost: { border: '#cce8f5', glow: 'rgba(204,232,245,0.4)' },
    shadow: { border: '#c7a4f0', glow: 'rgba(199,164,240,0.45)' },
    arcane: { border: '#c0b0e8', glow: 'rgba(192,176,232,0.45)' },
    nature: { border: '#a8d0a0', glow: 'rgba(168,208,160,0.45)' },
    earth: { border: '#d8b878', glow: 'rgba(216,184,120,0.4)' },
    rust: { border: '#d9a56c', glow: 'rgba(217,165,108,0.4)' },
});

/**
 * SVG 아이콘 경로 — 비-equipment 아이템 fallback paths.
 * viewBox="0 0 24 24", stroke-based.
 *
 * cycle 414: equipment-style 16 키 (sword/greatsword/dagger/staff/bow/axe/hammer/
 *   spear/scythe/whip/armor/robe/cloak/boots/shield/book) 제거 — SVG 분기는
 *   `!isEquipmentItem` 케이스만 진입 (equipment는 EquipmentAvatarPreview가 takeover).
 *   따라서 equipment-style ICON_PATHS lookup 절대 hit 안 됨.
 */
const ICON_PATHS: any = {
    // 소모품
    potion: 'M9 3h6v3l2 4v8c0 1-1 3-5 3s-5-2-5-3V10l2-4V3Z',
    material: 'M12 2l8 5v10l-8 5-8-5V7l8-5Z',
    ore: 'M6 16 8 7l4-3 4 2 2 8-4 5H9l-3-3Z',
    crystal: 'M12 2l5 6-2 10h-6L7 8l5-6Z',
    scale: 'M12 3c4 0 7 3 7 7 0 6-4 9-7 11-3-2-7-5-7-11 0-4 3-7 7-7Z',
    fang: 'M8 4h8l-1 9-3 7-3-7-1-9Z',
    bone: 'M7 6c0-1 1-2 2-2 1 0 2 1 2 2v2l4 4v6c0 1-1 2-2 2-1 0-2-1-2-2v-2l-4-4V6Z',
    core: 'M12 3l6 3v6c0 5-3 8-6 10-3-2-6-5-6-10V6l6-3Zm0 4-2 2v2l2 2 2-2V9l-2-2Z',
    relic: 'M12 3l7 4-3 4 1 8h-10l1-8-3-4 7-4Z',
    herb: 'M12 20V8M12 10c-2-4-5-5-7-5 0 4 2 7 7 9M12 10c2-4 5-5 7-5 0 4-2 7-7 9',
    pouch: 'M8 5c0-1 1-2 4-2s4 1 4 2v1h2v3c0 5-2 9-6 12-4-3-6-7-6-12V6h2V5Z',
    key: 'M8 13a4 4 0 1 1 3 3H4v-2h2v-2h2v1Z',
};

/**
 * 아이템 타입 → 아이콘 키 매핑
 */
/**
 * ItemIcon — 아이템 아이콘 컴포넌트
 * @param {{ item: Object, size?: number, showBorder?: boolean, className?: string }} props
 */
const ItemIcon = ({ item, size = 24, showBorder = false, className = '', hideSignatureBadge = false }: any) => {
    const iconKey = getEquipmentVisualKey(item);
    const path = ICON_PATHS[iconKey] || ICON_PATHS.material;
    const rarity = item ? getItemRarity(item) : 'common';
    const color = BALANCE.RARITY_COLORS[rarity] || '#9ca3af';
    const isEquipmentItem = ['weapon', 'armor', 'shield'].includes(item?.type);
    const assetSrc = useMemo(() => getItemIconAssetSrc(item), [item]);
    const [assetState, setAssetState] = useState({ key: iconKey, failed: false });
    const activeAssetState = assetState.key === iconKey ? assetState : { key: iconKey, failed: false };
    const previewVariant = size >= 34 ? 'card' : 'default';
    const isDedicatedSignature = hasDedicatedSignatureArt(item);
    const signatureRing = isDedicatedSignature
        ? SIGNATURE_TONE_RING[getSignatureMetadata(item)?.tone] || SIGNATURE_TONE_RING.holy
        : null;

    const baseShell = showBorder ? {
        border: `1.5px solid ${color}40`,
        borderRadius: 8,
        background: `radial-gradient(circle at 30% 24%, ${color}18, transparent 42%), linear-gradient(180deg, rgba(20,24,30,0.98) 0%, rgba(8,10,14,1) 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 12px ${color}14`,
    } : {
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        background: 'linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(8,10,14,1) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    };
    const shellStyle = signatureRing ? {
        ...baseShell,
        border: `1.5px solid ${signatureRing.border}`,
        boxShadow: `${baseShell.boxShadow}, 0 0 0 1px ${signatureRing.border}22, 0 0 12px ${signatureRing.glow}`,
    } : baseShell;

    const badgeSize = Math.max(8, Math.round(size * 0.32));

    return (
        <div
            className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
            data-item-icon-style={isEquipmentItem ? 'equipment-asset' : 'asset'}
            data-signature-item={isDedicatedSignature ? 'true' : undefined}
            style={{
                width: size,
                height: size,
                ...shellStyle,
            }}
        >
            {!activeAssetState.failed ? (
                <img
                    src={assetSrc}
                    alt=""
                    aria-hidden="true"
                    className="pixelated object-contain"
                    style={{
                        width: isEquipmentItem ? size * 0.92 : size * 0.78,
                        height: isEquipmentItem ? size * 0.92 : size * 0.78,
                        filter: `drop-shadow(0 0 6px ${color}35)`,
                    }}
                    onError={() => setAssetState({ key: iconKey, failed: true })}
                />
            ) : isEquipmentItem ? (
                <EquipmentAvatarPreview item={item} size={size} variant={previewVariant} className="h-full w-full" />
            ) : (
                <svg
                    width={size * 0.7}
                    height={size * 0.7}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d={path} />
                </svg>
            )}
            {!hideSignatureBadge && <SignatureBadge item={item} size={badgeSize} />}
        </div>
    );
};

export default ItemIcon;
