const CURE_COPY: Record<string, { compact: string; detail: string }> = {
    poison: { compact: '해독', detail: '독 해제' },
    burn: { compact: '화상', detail: '화상 해제' },
    freeze: { compact: '해빙', detail: '빙결 해제' },
    curse: { compact: '저주', detail: '저주 해제' },
};

const isElixir = (item: any) => item?.type === 'hp' && item?.name === '엘릭서';

export const getConsumableCompactLabel = (item: any) => {
    if (item?.type === 'hp') return isElixir(item) ? 'HP∞' : `HP${item.val ?? ''}`;
    if (item?.type === 'mp') return `MP${item.val ?? ''}`;
    if (item?.type === 'cure') return CURE_COPY[item.effect]?.compact || '치료';
    if (item?.type === 'buff') {
        if (item.effect === 'atk_up') return 'ATK';
        if (item.effect === 'def_up') return 'DEF';
        if (item.effect === 'all_up') return 'ALL';
    }
    return item?.name || '소모품';
};

export const getConsumableDescription = (item: any, { includeTurnCost = false } = {}) => {
    let detail = '';
    if (item?.type === 'hp') detail = isElixir(item) ? 'HP 완전 회복' : `HP ${item.val ?? 0} 회복`;
    if (item?.type === 'mp') detail = `MP ${item.val ?? 0} 회복`;
    if (item?.type === 'cure') detail = CURE_COPY[item.effect]?.detail || '상태이상 해제';
    if (item?.type === 'buff') {
        const target = item.effect === 'atk_up' ? 'ATK' : item.effect === 'def_up' ? 'DEF' : 'ALL';
        const percent = Number.isFinite(item.val) ? Math.round((item.val - 1) * 100) : 0;
        detail = `${target} +${percent}% · ${item.turn ?? 0}턴`;
    }
    return includeTurnCost && detail ? `${detail} · 전투 턴 1회 소모` : detail;
};
