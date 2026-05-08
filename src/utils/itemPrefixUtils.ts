import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { getItemStatText } from './equipmentUtils';
import type { Item } from '../types/index.js';

const normalizeItemType = (type: any) => {
    if (type === 'shield') return 'armor';
    return type;
};

const supportsPrefixStat = (normalizedType: any, prefixStat: any) => {
    if (prefixStat === 'atk') return normalizedType === 'weapon';
    if (prefixStat === 'def') return normalizedType === 'armor';
    if (prefixStat === 'hp') return ['hp', 'mp'].includes(normalizedType);
    if (prefixStat === 'all') return ['weapon', 'armor', 'hp', 'mp'].includes(normalizedType);
    return false;
};

const formatStatText = (item: Item, normalizedType: any) => {
    if (normalizedType === 'weapon' || normalizedType === 'armor') return getItemStatText(item);
    if (normalizedType === 'hp') return `HP+${item.val}`;
    if (normalizedType === 'mp') return `MP+${item.val}`;
    return item.desc_stat || '';
};

const getPrefixCandidates = (item: Item | null | undefined) => {
    const normalizedType = normalizeItemType(item?.type);
    const supportedTypes = ['weapon', 'armor', 'hp', 'mp'];
    if (!supportedTypes.includes(normalizedType)) return [];
    const prefixes = Array.isArray(DB.ITEMS?.prefixes) ? DB.ITEMS.prefixes : [];

    return prefixes.filter((prefix: any) => {
        if (!prefix?.type) return false;
        const typeMatch = prefix.type === 'all' || prefix.type === normalizedType;
        if (!typeMatch) return false;
        return supportsPrefixStat(normalizedType, prefix.stat);
    });
};

const applyPrefixStats = (item: Item, prefix: any) => {
    const next: Record<string, any> = { ...item };
    const normalizedType = normalizeItemType(next.type);

    if (prefix.stat === 'atk' && normalizedType === 'weapon') {
        next.val = Math.max(1, (next.val || 0) + (prefix.val || 0));
    } else if (prefix.stat === 'def' && normalizedType === 'armor') {
        next.val = Math.max(1, (next.val || 0) + (prefix.val || 0));
    } else if (prefix.stat === 'hp' && ['hp', 'mp'].includes(next.type)) {
        next.val = Math.max(1, (next.val || 0) + (prefix.val || 0));
    } else if (prefix.stat === 'all' && typeof next.val === 'number') {
        next.val = Math.max(1, next.val + (prefix.val || 0));
    }

    if (prefix.elem && !next.elem) next.elem = prefix.elem;
    if (prefix.price) next.price = Math.max(1, Math.floor((next.price || 0) * prefix.price));

    return next;
};

export const applyItemPrefix = (item: any): any => {
    if (!item || item.prefixed) return item;

    if (Math.random() >= BALANCE.ITEM_PREFIX_CHANCE) return item;

    const candidates = getPrefixCandidates(item);
    if (!candidates.length) return item;

    const prefix = candidates[Math.floor(Math.random() * candidates.length)];
    const withStats = applyPrefixStats(item, prefix);
    const normalizedType = normalizeItemType(withStats.type);
    const statText = formatStatText(withStats, normalizedType);

    return {
        ...withStats,
        name: `${prefix.name} ${withStats.name}`,
        desc_stat: statText ? `${statText} | ${prefix.name}` : prefix.name,
        prefixed: true,
        prefixName: prefix.name
    };
};
