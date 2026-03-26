import React from 'react';
import { BALANCE } from '../../data/constants';
import { getItemRarity } from '../../utils/gameUtils';

/**
 * SVG 아이콘 경로 — 장비 타입별 실루엣
 * viewBox="0 0 24 24", stroke-based
 */
const ICON_PATHS = {
    // 무기
    sword: 'M14.5 3.5 20 9l-7 7-5.5-5.5 7-7ZM3 21l3.5-3.5M7.5 16.5l2 2',
    dagger: 'M16 3 21 8l-9 9-4-4 8-10ZM3 21l4-4',
    staff: 'M12 2v18M8 4h8M9 20h6M12 8l3 3M12 8l-3 3',
    bow: 'M18 4c-4 2-6 6-6 10M18 4c-2 4-6 6-10 6M18 4 6 16M4 20l2-4',
    axe: 'M12 2v20M8 6c-3 0-5 2-5 5s2 5 5 5M16 6c3 0 5 2 5 5s-2 5-5 5',
    hammer: 'M12 12v10M6 6h12v6H6V6ZM10 2h4v4h-4V2Z',
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
};

/**
 * 아이템 타입 → 아이콘 키 매핑
 */
const getIconKey = (item) => {
    if (!item) return 'material';
    if (item.type === 'weapon') {
        if (item.hands === 2) {
            if (item.name?.includes('활') || item.name?.includes('궁')) return 'bow';
            if (item.name?.includes('지팡이') || item.name?.includes('스태프') || item.name?.includes('로드') || item.name?.includes('완드')) return 'staff';
            if (item.name?.includes('도끼') || item.name?.includes('해머') || item.name?.includes('망치')) return 'axe';
            if (item.name?.includes('창')) return 'sword';
            if (item.name?.includes('낫')) return 'scythe';
            return 'sword';
        }
        if (item.name?.includes('단검') || item.name?.includes('표창') || item.name?.includes('절멸기')) return 'dagger';
        if (item.name?.includes('지팡이') || item.name?.includes('완드') || item.name?.includes('로드')) return 'staff';
        if (item.name?.includes('채찍')) return 'whip';
        return 'sword';
    }
    if (item.type === 'armor') {
        if (item.name?.includes('로브') || item.name?.includes('예복')) return 'robe';
        if (item.name?.includes('망토') || item.name?.includes('외투')) return 'cloak';
        if (item.name?.includes('장화') || item.name?.includes('장갑')) return 'boots';
        return 'armor';
    }
    if (item.type === 'shield') {
        if (item.subtype === 'focus') return 'book';
        return 'shield';
    }
    if (item.type === 'hp' || item.type === 'mp' || item.type === 'cure' || item.type === 'buff') return 'potion';
    return 'material';
};

/**
 * ItemIcon — 아이템 아이콘 컴포넌트
 * @param {{ item: Object, size?: number, showBorder?: boolean, className?: string }} props
 */
const ItemIcon = ({ item, size = 24, showBorder = false, className = '' }) => {
    const iconKey = getIconKey(item);
    const path = ICON_PATHS[iconKey] || ICON_PATHS.material;
    const rarity = item ? getItemRarity(item) : 'common';
    const color = BALANCE.RARITY_COLORS[rarity] || '#9ca3af';

    return (
        <div
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={{
                width: size,
                height: size,
                ...(showBorder ? {
                    border: `1.5px solid ${color}40`,
                    borderRadius: 6,
                    background: `${color}10`,
                } : {}),
            }}
        >
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
        </div>
    );
};

export default ItemIcon;
