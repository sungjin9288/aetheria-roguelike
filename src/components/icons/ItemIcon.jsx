import React, { useMemo, useState } from 'react';
import { BALANCE } from '../../data/constants';
import { getItemRarity } from '../../utils/gameUtils';
import { getEquipmentVisualKey, getItemIconAssetSrc } from '../../utils/itemVisuals';
import EquipmentAvatarPreview from './EquipmentAvatarPreview.jsx';
import SignatureBadge from './SignatureBadge.jsx';

/**
 * SVG 아이콘 경로 — 장비 타입별 실루엣
 * viewBox="0 0 24 24", stroke-based
 */
const ICON_PATHS = {
    // 무기
    sword: 'M14.5 3.5 20 9l-7 7-5.5-5.5 7-7ZM3 21l3.5-3.5M7.5 16.5l2 2',
    greatsword: 'M13 2l9 9-9 9-3-3 9-9-3-3-6 6-3-3 6-6Z',
    dagger: 'M16 3 21 8l-9 9-4-4 8-10ZM3 21l4-4',
    staff: 'M12 2v18M8 4h8M9 20h6M12 8l3 3M12 8l-3 3',
    bow: 'M18 4c-4 2-6 6-6 10M18 4c-2 4-6 6-10 6M18 4 6 16M4 20l2-4',
    axe: 'M12 2v20M8 6c-3 0-5 2-5 5s2 5 5 5M16 6c3 0 5 2 5 5s-2 5-5 5',
    hammer: 'M12 12v10M6 6h12v6H6V6ZM10 2h4v4h-4V2Z',
    spear: 'M12 2l3 4-3 2-3-2 3-4Zm0 6v14M10 18h4M9 22h6',
    scythe: 'M18 3c-4 0-8 3-8 8l-6 6 2 2 6-6c5 0 8-4 8-8M5 19l2 2',
    whip: 'M5 19c3-3 4-7 7-9s6-1 8-3c2-2 1-4 1-4',
    // 방어구
    armor: 'M12 3 4 7v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V7l-8-4Z',
    robe: 'M8 3h8l2 7-2 11H8L6 10l2-7ZM8 3c-1 2-1 4 0 6M16 3c1 2 1 4 0 6',
    cloak: 'M8 4c-2 0-3 2-3 5v8c0 2 1.5 3 3 4h8c1.5-1 3-2 3-4V9c0-3-1-5-3-5',
    boots: 'M8 4v10c0 2 0 4-2 6h12c-2-2-2-4-2-6V4',
    // 방패
    shield: 'M12 3 4 7v5c0 5 3.5 8 8 11 4.5-3 8-6 8-11V7l-8-4Z',
    book: 'M4 4h6c1.1 0 2 .9 2 2v14c-1-1-2-1-3-1H4V4ZM20 4h-6c-1.1 0-2 .9-2 2v14c1-1 2-1 3-1h5V4Z',
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
const ItemIcon = ({ item, size = 24, showBorder = false, className = '', hideSignatureBadge = false }) => {
    const iconKey = getEquipmentVisualKey(item);
    const path = ICON_PATHS[iconKey] || ICON_PATHS.material;
    const rarity = item ? getItemRarity(item) : 'common';
    const color = BALANCE.RARITY_COLORS[rarity] || '#9ca3af';
    const isEquipmentItem = ['weapon', 'armor', 'shield'].includes(item?.type);
    const assetSrc = useMemo(() => getItemIconAssetSrc(item), [item]);
    const [assetState, setAssetState] = useState({ key: iconKey, failed: false });
    const activeAssetState = assetState.key === iconKey ? assetState : { key: iconKey, failed: false };
    const previewVariant = size >= 34 ? 'card' : 'default';
    const shellStyle = showBorder ? {
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

    const badgeSize = Math.max(8, Math.round(size * 0.32));

    return (
        <div
            className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
            data-item-icon-style={isEquipmentItem ? 'equipment-asset' : 'asset'}
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
