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
    if (val === 0) return <span className="text-cyber-blue/30 text-xs">{label} ±0</span>;
    const up = val > 0;
    return (
        <span className={`text-xs font-bold flex items-center gap-0.5 ${up ? 'text-cyber-green' : 'text-red-400'}`}>
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

const canEquipItem = (item, job) => !Array.isArray(item.jobs) || item.jobs.includes(job);

const getItemTags = (item) => {
    const tags = [];
    if (isWeapon(item) || item?.type === 'shield') tags.push(getWeaponStyleLabel(item));
    return tags;
};

const SmartInventory = ({ player, actions, quickSlots = [null, null, null], onAssignQuickSlot, spotlight = null, onClearSpotlight = null }) => {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [hoveredItem, setHoveredItem] = React.useState(null);
    const spotlightNames = useMemo(() => spotlight?.names || [], [spotlight]);
    const spotlightSet = useMemo(() => new Set(spotlightNames), [spotlightNames]);
    const traitProfile = useMemo(
        () => getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player]
    );

    const grouped = useMemo(() => {
        const map = {};
        for (const item of player.inv) {
            if (!map[item.name]) map[item.name] = { item, count: 0 };
            map[item.name].count++;
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

    return (
        <div className="space-y-3">
            {spotlightNames.length > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="inventory-spotlight-detail"
                    className="flex items-start justify-between gap-3 rounded border border-cyber-purple/25 bg-cyber-purple/10 px-3 py-2.5"
                >
                    <div className="min-w-0">
                        <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-cyber-purple/75">
                            {spotlight?.title || '전리품 주목'}
                        </div>
                        <div className="mt-1 text-[11px] font-fira text-cyber-purple/90 leading-snug">
                            {spotlight?.detail || '이번 전투 보상과 관련된 장비를 먼저 확인하세요.'}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {spotlightNames.slice(0, 3).map((name) => (
                                <SignalBadge key={`spotlight_${name}`} tone="spotlight" size="sm">{name}</SignalBadge>
                            ))}
                        </div>
                    </div>
                    {onClearSpotlight && (
                        <button
                            onClick={() => onClearSpotlight()}
                            className="shrink-0 rounded border border-cyber-purple/20 bg-cyber-black/40 px-2 py-1 text-[10px] font-fira text-cyber-purple/75 hover:bg-cyber-purple/10"
                        >
                            닫기
                        </button>
                    )}
                </Motion.div>
            )}

            {/* Filter Bar */}
            <div className="flex gap-1 flex-wrap">
                {FILTERS.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id)}
                        className={`text-xs px-2.5 py-1 rounded border font-rajdhani font-bold transition-all min-h-[32px]
                            ${activeFilter === f.id
                                ? 'bg-cyber-blue/20 border-cyber-blue/60 text-cyber-blue'
                                : 'bg-cyber-dark/30 border-cyber-blue/10 text-cyber-blue/40 hover:border-cyber-blue/30'
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
                        className="ml-auto text-xs px-2.5 py-1 rounded border border-cyber-green/40 bg-cyber-green/10 text-cyber-green font-rajdhani font-bold flex items-center gap-1 min-h-[32px] hover:bg-cyber-green/20 transition-all"
                        title="최적 장비 자동 장착"
                    >
                        <Star size={11} /> 추천 장착
                    </Motion.button>
                )}
            </div>

            {/* 시나리오 2: 인벤토리 과밀 배너 + 일괄 판매 */}
            {isInvNearFull && sellableMatCount > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-orange-950/30 border border-orange-500/30 rounded px-3 py-2"
                >
                    <div className="flex items-center gap-2 text-orange-400 text-xs font-fira">
                        <AlertCircle size={13} className="shrink-0 animate-pulse" />
                        <span>인벤토리 {player.inv.length}/20 — 저가 재료 {sellableMatCount}개 정리 가능</span>
                    </div>
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => actions.autoSell?.()}
                        className="text-xs flex items-center gap-1 font-rajdhani font-bold text-orange-400 bg-orange-900/40 hover:bg-orange-800/50 border border-orange-500/40 px-2.5 py-1 rounded min-h-[32px] transition-all shrink-0 ml-2"
                    >
                        <Package size={11} /> 일괄 정리
                    </Motion.button>
                </Motion.div>
            )}

            {/* Item List */}
            <div className="space-y-1.5">
                {filtered.length === 0 && (
                    <div className="text-cyber-blue/30 text-center py-6 text-sm font-rajdhani tracking-widest">
                        해당 카테고리의 아이템이 없습니다
                    </div>
                )}
                {filtered.map(({ item, count }, i) => {
                    const diff = getCompareDiff(item);
                    const canEquip = !['weapon', 'armor', 'shield'].includes(item.type) || canEquipItem(item, player.job);
                    const itemIdentity = getEquipmentIdentity(item);
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
                            className={`bg-cyber-dark/40 p-3 rounded-sm border flex justify-between items-center group transition-all cursor-pointer min-h-[50px]
                                ${isSpotlighted
                                    ? 'border-cyber-purple/45 bg-cyber-purple/10 shadow-[0_0_16px_rgba(168,85,247,0.12)]'
                                    : isCurrentEquip
                                        ? 'border-cyber-green/40 bg-cyber-green/5'
                                        : 'border-cyber-blue/10 hover:border-cyber-green/50 hover:bg-cyber-green/5'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-fira ${item.tier >= 2 ? 'text-cyber-purple drop-shadow-sm' : 'text-cyber-blue/80'}`}>
                                        {item.name}
                                    </span>
                                    {count > 1 && <span className="text-cyber-blue/30 text-xs">x{count}</span>}
                                    {isSpotlighted && <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>}
                                    {isCurrentEquip && <SignalBadge tone="equipped" size="sm">장착 중</SignalBadge>}
                                    {resonance.label && <SignalBadge tone={resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{resonance.label}</SignalBadge>}
                                    {!canEquip && <SignalBadge tone="danger" size="sm">직업 제한</SignalBadge>}
                                </div>

                                {/* Compare diff (on hover or always for equip items) */}
                                {diff && (hoveredItem === item.name || isCurrentEquip) && (
                                    <div className="flex gap-2 mt-1">
                                        {diff.atk !== 0 && <StatDiff val={diff.atk} label="ATK" />}
                                        {diff.def !== 0 && <StatDiff val={diff.def} label="DEF" />}
                                        {diff.crit !== 0 && <StatDiff val={diff.crit} label="CRIT%" />}
                                        {diff.mp !== 0 && <StatDiff val={diff.mp} label="MP" />}
                                        {diff.atk === 0 && diff.def === 0 && diff.crit === 0 && diff.mp === 0 && <Minus size={11} className="text-cyber-blue/30" />}
                                    </div>
                                )}
                                {(getItemStatText(item) || item.desc_stat) && (
                                    <div className="text-cyber-blue/30 text-xs font-fira mt-0.5 truncate">{getItemStatText(item) || item.desc_stat}</div>
                                )}
                                {getItemTags(item).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {getItemTags(item).map((tag) => (
                                            <SignalBadge key={`${item.name}_${tag}`} tone="neutral" size="sm">{tag}</SignalBadge>
                                        ))}
                                    </div>
                                )}
                                {onAssignQuickSlot && (
                                    <QuickSlotAssigner
                                        item={item}
                                        currentSlots={quickSlots}
                                        onAssign={onAssignQuickSlot}
                                    />
                                )}
                            </div>
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                disabled={!canEquip}
                                onClick={() => actions.useItem(item)}
                                className="text-xs bg-cyber-blue/10 hover:bg-cyber-blue/30 disabled:opacity-30 disabled:hover:bg-cyber-blue/10 text-cyber-blue px-3 py-2 rounded border border-cyber-blue/30 font-bold min-h-[40px] ml-2 shrink-0"
                            >
                                {!canEquip ? '제한' : ['weapon', 'armor', 'shield'].includes(item.type) ? (isCurrentEquip ? '장착됨' : '장착') : '사용'}
                            </Motion.button>
                        </Motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default SmartInventory;
