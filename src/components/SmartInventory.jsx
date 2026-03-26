import React, { useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Star, Package, AlertCircle } from 'lucide-react';
import { QuickSlotAssigner } from './QuickSlot';
import { getEquipmentIdentity, getEquipmentProfile, getItemStatText, getNextEquipmentState, getWeaponStyleLabel, isWeapon } from '../utils/equipmentUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';
import SignalBadge from './SignalBadge';

/**
 * EquipCompare — 장비 비교 미리보기 (ATK/DEF 증감)
 */
const StatDiff = ({ val, label }) => {
    if (val === 0) return <span className="text-slate-500 text-[11px]">{label} ±0</span>;
    const up = val > 0;
    return (
        <span className={`text-[11px] font-bold flex items-center gap-0.5 ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
            {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {label} {up ? '+' : ''}{val}
        </span>
    );
};

/**
 * SmartInventory — 인벤토리 스마트 필터 + 장비 비교 (시나리오 2)
 */
const FILTERS = [
    { id: 'all', label: '전체' },
    { id: 'weapon', label: '무기' },
    { id: 'armor', label: '방어구' },
    { id: 'shield', label: '보조' },
    { id: 'hp', label: '회복' },
    { id: 'material', label: '재료' },
];

const ITEM_TYPE_TO_FILTER = {
    weapon: 'weapon',
    armor: 'armor',
    shield: 'shield',
    hp: 'hp',
    mp: 'hp',
    buff: 'hp',
    cure: 'hp',
    mat: 'material',
};
const MAX_COMPACT_ITEMS = 3;

const canEquipItem = (item, job) => !Array.isArray(item.jobs) || item.jobs.includes(job);

const getItemTags = (item) => {
    const tags = [];
    if (isWeapon(item) || item?.type === 'shield') tags.push(getWeaponStyleLabel(item));
    return tags;
};

const SmartInventory = ({ player, actions, quickSlots = [null, null, null], onAssignQuickSlot, spotlight = null, onClearSpotlight = null, compact = false }) => {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const [showAllItems, setShowAllItems] = React.useState(false);
    const spotlightNames = useMemo(() => spotlight?.names || [], [spotlight]);
    const spotlightSet = useMemo(() => new Set(spotlightNames), [spotlightNames]);
    const traitProfile = useMemo(
        () => getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player]
    );

    const grouped = useMemo(() => {
        const map = {};
        for (const item of player.inv) {
            // Enhanced items are unique — group by name+enhance; non-equipment groups by name only
            const enhance = item.enhance || 0;
            const isEquipType = ['weapon', 'armor', 'shield'].includes(item.type);
            const key = isEquipType ? `${item.name}__+${enhance}__${item.id}` : item.name;
            if (!map[key]) map[key] = { item, count: 0 };
            map[key].count++;
        }
        return Object.values(map);
    }, [player.inv]);

    const filtered = useMemo(() => {
        if (activeFilter === 'all') return grouped;
        return grouped.filter(({ item }) => {
            const f = ITEM_TYPE_TO_FILTER[item.type] || item.type;
            return f === activeFilter;
        });
    }, [grouped, activeFilter]);

    // 추천 장착 계산 (최고 val 기준)
    const getEquipPreview = useCallback((item) => {
        const currentProfile = getEquipmentProfile(player.equip);
        const nextEquip = getNextEquipmentState(player.equip, item);
        const nextProfile = getEquipmentProfile(nextEquip);

        return {
            atk: (nextProfile.mainAttack + nextProfile.offhandAttack) - (currentProfile.mainAttack + currentProfile.offhandAttack),
            def: ((nextEquip.armor?.val || 0) + nextProfile.shieldDef) - ((player.equip?.armor?.val || 0) + currentProfile.shieldDef),
            crit: Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100),
            mp: nextProfile.mpBonus - currentProfile.mpBonus,
            score: (nextProfile.mainAttack + nextProfile.offhandAttack) + (nextProfile.critBonus * 120) + (nextProfile.mpBonus * 0.3),
        };
    }, [player.equip]);

    const bestWeapon = useMemo(() =>
        player.inv
            .filter(i => i.type === 'weapon' && canEquipItem(i, player.job))
            .sort((a, b) => getEquipPreview(b).score - getEquipPreview(a).score)[0],
        [player.inv, player.job, getEquipPreview]
    );
    const bestArmor = useMemo(() =>
        player.inv
            .filter(i => i.type === 'armor' && canEquipItem(i, player.job))
            .sort((a, b) => (b.val || 0) - (a.val || 0))[0],
        [player.inv, player.job]
    );

    const getCompareDiff = useCallback((item) => {
        if (!item) return null;
        if (['weapon', 'armor', 'shield'].includes(item.type)) return getEquipPreview(item);
        return null;
    }, [getEquipPreview]);

    const isEquipUpgrade = useCallback((item) => {
        const diff = getCompareDiff(item);
        if (!diff) return false;
        return (diff.atk + diff.def + (diff.crit * 2) + Math.floor(diff.mp / 5)) > 0;
    }, [getCompareDiff]);

    const handleSmartEquip = () => {
        if (bestWeapon && isEquipUpgrade(bestWeapon)) actions.useItem(bestWeapon);
        if (bestArmor && isEquipUpgrade(bestArmor)) actions.useItem(bestArmor);
    };

    // 시나리오 2: 인벤토리 과밀 감지 (최대의 90%)
    const INV_FULL_THRESHOLD = 18;
    const isInvNearFull = player.inv.length >= INV_FULL_THRESHOLD;
    const sellableMatCount = useMemo(() =>
        player.inv.filter(i => i.type === 'mat' && (i.price || 0) <= 30).length,
        [player.inv]
    );
    const activeFilterLabel = FILTERS.find((entry) => entry.id === activeFilter)?.label || '전체';
    const visibleFiltered = (() => {
        if (!compact || showAllItems || filtered.length <= MAX_COMPACT_ITEMS) return filtered;

        return filtered
            .map(({ item, count }, index) => {
                let priority = 0;
                if (spotlightSet.has(item.name)) priority += 100;
                if (quickSlots?.some((slot) => slot?.id === item?.id)) priority += 80;
                if (isEquipUpgrade(item)) priority += 55;
                if (['hp', 'mp', 'buff', 'cure'].includes(item.type)) priority += 28;
                if (['weapon', 'armor', 'shield'].includes(item.type)) priority += 16;
                if (count > 1) priority += Math.min(count, 6);
                return { item, count, index, priority };
            })
            .sort((a, b) => b.priority - a.priority || a.index - b.index)
            .slice(0, MAX_COMPACT_ITEMS)
            .map(({ item, count }) => ({ item, count }));
    })();
    const hiddenItemCount = Math.max(0, filtered.length - visibleFiltered.length);
    const useSummaryCards = compact && !showAllItems && filtered.length > MAX_COMPACT_ITEMS;
    const useDenseCompactInventory = compact && !showAllItems;
    const inventorySectionLabel = showAllItems
        ? (activeFilter === 'all' ? '전체 보관품' : `${activeFilterLabel} 전체`)
        : (activeFilter === 'all' ? '우선 보관품' : `${activeFilterLabel} 우선 보관품`);

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
            {spotlightNames.length > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="inventory-spotlight-detail"
                    className={`flex items-start justify-between gap-3 rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/10 ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}
                >
                    <div className="min-w-0">
                        <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-[#e3dcff]/72">
                            {spotlight?.title || '전리품 주목'}
                        </div>
                        <div className={`${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]'} font-fira text-slate-200/82 leading-snug`}>
                            {spotlight?.detail || '이번 전투 보상과 관련된 장비를 먼저 확인하세요.'}
                        </div>
                        <div className={`${compact ? 'mt-1.5' : 'mt-2'} flex flex-wrap gap-1`}>
                            {spotlightNames.slice(0, 3).map((name) => (
                                <SignalBadge key={`spotlight_${name}`} tone="spotlight" size="sm">{name}</SignalBadge>
                            ))}
                        </div>
                    </div>
                    {onClearSpotlight && (
                        <button
                            onClick={() => onClearSpotlight()}
                            className={`shrink-0 rounded-full border border-white/8 bg-black/18 ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'} font-fira text-slate-300/76 hover:bg-white/[0.04]`}
                        >
                            닫기
                        </button>
                    )}
                </Motion.div>
            )}

            {/* Filter Bar */}
            <div className={`rounded-[1rem] border border-white/8 bg-black/16 ${compact ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}>
                <div className={`${useDenseCompactInventory ? 'flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5' : 'flex flex-wrap items-center gap-1.5'}`}>
                {FILTERS.map(f => (
                    <button
                        key={f.id}
                        onClick={() => {
                            setActiveFilter(f.id);
                            setShowAllItems(false);
                        }}
                        className={`${compact ? 'min-h-[26px] px-2 py-0.5 text-[10px]' : 'min-h-[30px] px-2.5 py-1 text-[11px]'} rounded-full border font-rajdhani font-bold transition-all
                            ${useDenseCompactInventory ? 'shrink-0 whitespace-nowrap' : ''}
                            ${activeFilter === f.id
                                ? 'bg-[#7dd4d8]/14 border-[#7dd4d8]/30 text-[#dff7f5]'
                                : 'bg-black/18 border-white/8 text-slate-400 hover:border-white/14 hover:text-slate-200'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}

                {/* Smart Equip Button */}
                {(bestWeapon || bestArmor) && (
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSmartEquip}
                        className={`${useDenseCompactInventory ? 'shrink-0 whitespace-nowrap' : 'ml-auto'} rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8] font-rajdhani font-bold flex items-center gap-1 hover:bg-[#d5b180]/16 transition-all ${compact ? 'min-h-[26px] px-2 py-0.5 text-[10px]' : 'min-h-[30px] px-2.5 py-1 text-[11px]'}`}
                        title="최적 장비 자동 장착"
                    >
                        <Star size={compact ? 10 : 11} /> {compact ? '추천' : '추천 장착'}
                    </Motion.button>
                )}
                </div>
            </div>

            {/* 시나리오 2: 인벤토리 과밀 배너 + 일괄 판매 */}
            {isInvNearFull && sellableMatCount > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center justify-between rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/8 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
                >
                    <div className={`flex items-center gap-2 text-[#f6e7c8] font-fira ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                        <AlertCircle size={compact ? 12 : 13} className="shrink-0 animate-pulse" />
                        <span>인벤토리 {player.inv.length}/20 — 저가 재료 {sellableMatCount}개 정리 가능</span>
                    </div>
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => actions.autoSell?.()}
                        className={`flex items-center gap-1 font-rajdhani font-bold text-[#f6e7c8] bg-black/18 hover:bg-white/[0.04] border border-white/8 rounded-full transition-all shrink-0 ml-2 ${compact ? 'min-h-[26px] px-2 py-0.5 text-[10px]' : 'min-h-[30px] px-2.5 py-1 text-[11px]'}`}
                    >
                        <Package size={compact ? 10 : 11} /> 일괄 정리
                    </Motion.button>
                </Motion.div>
            )}

            {compact && (hiddenItemCount > 0 || showAllItems) && (
                <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                    <span className="text-slate-500">{inventorySectionLabel}</span>
                    {hiddenItemCount > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowAllItems(true)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            +{hiddenItemCount} 더 보기
                        </button>
                    ) : showAllItems ? (
                        <button
                            type="button"
                            onClick={() => setShowAllItems(false)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            요약 보기
                        </button>
                    ) : null}
                </div>
            )}

            {/* Item List */}
            <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
                {filtered.length === 0 && (
                    <div className={`rounded-[1rem] border border-white/8 bg-black/16 text-center font-rajdhani tracking-widest text-slate-500 ${compact ? 'py-5 text-[13px]' : 'py-6 text-sm'}`}>
                        해당 카테고리의 아이템이 없습니다
                    </div>
                )}
                {visibleFiltered.map(({ item, count }, i) => {
                    const diff = getCompareDiff(item);
                    const canEquip = !['weapon', 'armor', 'shield'].includes(item.type) || canEquipItem(item, player.job);
                    const itemIdentity = getEquipmentIdentity(item);
                    const assignedQuickSlots = quickSlots
                        ?.map((slot, index) => (slot?.id === item?.id ? index + 1 : null))
                        .filter(Boolean) || [];
                    const isCurrentEquip =
                        getEquipmentIdentity(player.equip?.weapon) === itemIdentity ||
                        getEquipmentIdentity(player.equip?.armor) === itemIdentity ||
                        getEquipmentIdentity(player.equip?.offhand) === itemIdentity;
                    const isSpotlighted = spotlightSet.has(item.name);
                    const resonance = getTraitItemResonance(item, traitProfile, player);

                    return (
                        <Motion.div
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`${useSummaryCards ? 'min-h-[44px] p-2' : compact ? 'min-h-[48px] p-2.5' : 'min-h-[54px] p-3'} rounded-[1rem] border flex justify-between items-center group transition-all cursor-pointer
                                ${isSpotlighted
                                    ? 'border-[#9a8ac0]/30 bg-[#9a8ac0]/10 shadow-[0_0_16px_rgba(154,138,192,0.12)]'
                                    : isCurrentEquip
                                        ? 'border-emerald-300/24 bg-emerald-300/[0.06]'
                                        : 'border-white/8 bg-black/18 hover:border-[#7dd4d8]/18 hover:bg-white/[0.03]'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`${compact ? 'text-[12px]' : 'text-sm'} font-fira ${item.tier >= 2 ? 'text-[#e3dcff]' : 'text-white/86'}`}>
                                        {item.name}
                                    </span>
                                    {(item.enhance || 0) > 0 && (
                                        <span className="text-[10px] font-bold font-fira text-[#d5b180]">+{item.enhance}</span>
                                    )}
                                    {count > 1 && <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500`}>x{count}</span>}
                                    {isSpotlighted && <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>}
                                    {isCurrentEquip && <SignalBadge tone="equipped" size="sm">장착 중</SignalBadge>}
                                    {resonance.label && <SignalBadge tone={resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{resonance.label}</SignalBadge>}
                                    {!canEquip && <SignalBadge tone="danger" size="sm">직업 제한</SignalBadge>}
                                </div>

                                {/* Compare diff (on hover or always for equip items) */}
                                {diff && !useSummaryCards && (hoveredItem === item.name || isCurrentEquip) && (
                                    <div className={`mt-1 flex ${compact ? 'gap-1.5 flex-wrap' : 'gap-2'}`}>
                                        {diff.atk !== 0 && <StatDiff val={diff.atk} label="ATK" />}
                                        {diff.def !== 0 && <StatDiff val={diff.def} label="DEF" />}
                                        {diff.crit !== 0 && <StatDiff val={diff.crit} label="CRIT%" />}
                                        {diff.mp !== 0 && <StatDiff val={diff.mp} label="MP" />}
                                        {diff.atk === 0 && diff.def === 0 && diff.crit === 0 && diff.mp === 0 && <Minus size={11} className="text-cyber-blue/30" />}
                                    </div>
                                )}
                                {(getItemStatText(item) || item.desc_stat) && (
                                    <div className={`mt-0.5 truncate font-fira text-slate-400/72 ${compact ? 'text-[10px]' : 'text-xs'}`}>{getItemStatText(item) || item.desc_stat}</div>
                                )}
                                {useSummaryCards && assignedQuickSlots.length > 0 && (
                                    <div className="mt-0.5 text-[9px] font-fira uppercase tracking-[0.12em] text-slate-500">
                                        슬롯 {assignedQuickSlots.join(', ')}
                                    </div>
                                )}
                                {getItemTags(item).length > 0 && (
                                    <div className={`${compact ? 'mt-0.5' : 'mt-1'} flex flex-wrap gap-1`}>
                                        {getItemTags(item).map((tag) => (
                                            <SignalBadge key={`${item.name}_${tag}`} tone="neutral" size="sm">{tag}</SignalBadge>
                                        ))}
                                    </div>
                                )}
                                {onAssignQuickSlot && !useSummaryCards && (
                                    <QuickSlotAssigner
                                        item={item}
                                        currentSlots={quickSlots}
                                        onAssign={onAssignQuickSlot}
                                        compact={compact}
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                {['weapon', 'armor', 'shield'].includes(item.type) && actions.enhanceItem && (item.enhance || 0) < 10 && (
                                    <Motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => actions.enhanceItem(item.id)}
                                        className={`bg-[#d5b180]/10 hover:bg-[#d5b180]/18 text-[#f6e7c8] rounded-full border border-[#d5b180]/22 font-bold font-fira ${useSummaryCards ? 'min-h-[30px] px-2 py-0.5 text-[9px]' : compact ? 'min-h-[32px] px-2 py-1 text-[9px]' : 'min-h-[38px] px-2.5 py-2 text-[10px]'}`}
                                        title={`강화 +${(item.enhance || 0) + 1}`}
                                    >
                                        +강화
                                    </Motion.button>
                                )}
                                <Motion.button
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!canEquip}
                                    onClick={() => actions.useItem(item)}
                                    className={`bg-[#7dd4d8]/10 hover:bg-[#7dd4d8]/16 disabled:opacity-30 disabled:hover:bg-[#7dd4d8]/10 text-[#dff7f5] rounded-full border border-[#7dd4d8]/22 font-bold ${useSummaryCards ? 'min-h-[30px] px-2 py-0.5 text-[10px]' : compact ? 'min-h-[32px] px-2.5 py-1 text-[10px]' : 'min-h-[38px] px-3 py-2 text-[11px]'}`}
                                >
                                    {!canEquip ? '제한' : ['weapon', 'armor', 'shield'].includes(item.type) ? (isCurrentEquip ? '장착됨' : '장착') : '사용'}
                                </Motion.button>
                            </div>
                        </Motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default SmartInventory;
