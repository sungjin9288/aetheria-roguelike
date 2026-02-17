import { DB } from '../data/db';
import { BALANCE } from '../data/constants';

const normalizeItemType = (type) => {
    if (type === 'shield') return 'armor';
    return type;
};

const supportsPrefixStat = (normalizedType, prefixStat) => {
    if (prefixStat === 'atk') return normalizedType === 'weapon';
    if (prefixStat === 'def') return normalizedType === 'armor';
    if (prefixStat === 'hp') return ['hp', 'mp'].includes(normalizedType);
    if (prefixStat === 'all') return ['weapon', 'armor', 'hp', 'mp'].includes(normalizedType);
    return false;
};

const formatStatText = (item, normalizedType) => {
    const elemSuffix = item.elem ? `(${item.elem})` : '';
    if (normalizedType === 'weapon') return `ATK+${item.val}${elemSuffix}`;
    if (normalizedType === 'armor') return `DEF+${item.val}${elemSuffix}`;
    if (normalizedType === 'hp') return `HP+${item.val}`;
    if (normalizedType === 'mp') return `MP+${item.val}`;
    return item.desc_stat || '';
};

const getPrefixCandidates = (item) => {
    const normalizedType = normalizeItemType(item?.type);
    const supportedTypes = ['weapon', 'armor', 'hp', 'mp'];
    if (!supportedTypes.includes(normalizedType)) return [];
    const prefixes = Array.isArray(DB.ITEMS?.prefixes) ? DB.ITEMS.prefixes : [];

    return prefixes.filter((prefix) => {
        if (!prefix?.type) return false;
        const typeMatch = prefix.type === 'all' || prefix.type === normalizedType;
        if (!typeMatch) return false;
        return supportsPrefixStat(normalizedType, prefix.stat);
    });
};

const applyPrefixStats = (item, prefix) => {
    const next = { ...item };
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

export const applyItemPrefix = (item, options = {}) => {
    if (!item || item.prefixed) return item;

    const chance = typeof options.chance === 'number' ? options.chance : BALANCE.ITEM_PREFIX_CHANCE;
    const shouldApply = options.force || Math.random() < chance;
    if (!shouldApply) return item;

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
