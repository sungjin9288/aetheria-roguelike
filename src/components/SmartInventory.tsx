import React, { useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Star, Package, AlertCircle } from 'lucide-react';
import { QuickSlotAssigner } from './QuickSlot';
import { getEquipmentIdentity, getEquipmentProfile, getItemStatText, getNextEquipmentState, getWeaponStyleLabel, isWeapon } from '../utils/equipmentUtils';
import { getEnhanceAvailability } from '../utils/enhancementUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';
import { MSG } from '../data/messages';
import { BALANCE } from '../data/constants';
import { isSignatureItem } from '../data/signatureItems.js';
import SignalBadge from './SignalBadge';
import ItemIcon from './icons/ItemIcon';
import type { Player } from '../types/index.js';

// cycle 482: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 + 33 ternary + 5 const 일괄 정리
//   (cycle 472-479/481 paired의 11번째 / 마지막 panel cleanup으로 cascade 완료).
interface SmartInventoryProps {
    player: Player;
    actions?: any;
    quickSlots?: any[];
    onAssignQuickSlot?: any;
    spotlight?: any;
    onClearSpotlight?: any;
}

/**
 * EquipCompare — 장비 비교 미리보기 (ATK/DEF 증감)
 */
const StatDiff = ({ val, label }: any) => {
    if (val === 0) return <span className="text-slate-500 text-xs">{label} ±0</span>;
    const up = val > 0;
    return (
        <span className={`text-xs font-bold flex items-center gap-0.5 ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
            {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {label} {up ? '+' : ''}{val}
        </span>
    );
};

/**
 * SmartInventory — 인벤토리 스마트 필터 + 장비 비교 (시나리오 2)
 */
const FILTERS: any = [
    { id: 'all', label: MSG.INV_FILTER_ALL },
    { id: 'weapon', label: MSG.INV_FILTER_WEAPON },
    { id: 'armor', label: MSG.INV_FILTER_ARMOR },
    { id: 'shield', label: MSG.INV_FILTER_SHIELD },
    { id: 'hp', label: MSG.INV_FILTER_CONSUMABLE },
    { id: 'material', label: MSG.INV_FILTER_MATERIAL },
];

const ITEM_TYPE_TO_FILTER: any = {
    weapon: 'weapon',
    armor: 'armor',
    shield: 'shield',
    hp: 'hp',
    mp: 'hp',
    buff: 'hp',
    cure: 'hp',
    mat: 'material',
};
const canEquipItem = (item: any, job: any) => !Array.isArray(item.jobs) || item.jobs.includes(job);

const getItemTags = (item: any) => {
    const tags: any[] = [];
    if (isWeapon(item) || item?.type === 'shield') tags.push(getWeaponStyleLabel(item));
    return tags;
};

// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
// cycle 574: quickSlots / spotlight / onClearSpotlight 3 defaults batch 제거 —
//   cycle 452 주석의 future-proof 보존이 audit 결과 1 production caller
//   (Dashboard:162) 모두 명시 전달이라 도달 불가. 청소 메가 시리즈 66번째.
const SmartInventory = ({ player, actions, quickSlots, onAssignQuickSlot, spotlight, onClearSpotlight }: SmartInventoryProps) => {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [hoveredItem, setHoveredItem] = React.useState<any>(null);
    const spotlightNames = useMemo(() => spotlight?.names || [], [spotlight]);
    const spotlightSet = useMemo(() => new Set(spotlightNames), [spotlightNames]);
    const traitProfile = useMemo(
        () => getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player]
    );

    const grouped = useMemo(() => {
        const map: Record<string, any> = {};
        for (const item of (player.inv || [])) {
            // Enhanced items are unique — group by name+enhance; non-equipment groups by name only
            const enhance = item.enhance || 0;
            const isEquipType = ['weapon', 'armor', 'shield'].includes(item.type as string);
            const key = (isEquipType ? `${item.name}__+${enhance}__${item.id}` : item.name) as string;
            if (!map[key]) map[key] = { item, count: 0 };
            map[key].count++;
        }
        return Object.values(map);
    }, [player.inv]);

    const filtered = useMemo(() => {
        if (activeFilter === 'all') return grouped;
        return grouped.filter(({ item }: any) => {
            const f = ITEM_TYPE_TO_FILTER[item.type] || item.type;
            return f === activeFilter;
        });
    }, [grouped, activeFilter]);

    // 추천 장착 계산 (최고 val 기준)
    const getEquipPreview = useCallback((item: any) => {
        const currentProfile = getEquipmentProfile(player.equip || {});
        const nextEquip = getNextEquipmentState(player.equip || {}, item);
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
        (player.inv || [])
            .filter((i: any) => i.type === 'weapon' && canEquipItem(i, player.job))
            .sort((a: any, b: any) => getEquipPreview(b).score - getEquipPreview(a).score)[0],
        [player.inv, player.job, getEquipPreview]
    );
    const bestArmor = useMemo(() =>
        (player.inv || [])
            .filter((i: any) => i.type === 'armor' && canEquipItem(i, player.job))
            .sort((a: any, b: any) => (b.val || 0) - (a.val || 0))[0],
        [player.inv, player.job]
    );

    const getCompareDiff = useCallback((item: any) => {
        if (!item) return null;
        if (['weapon', 'armor', 'shield'].includes(item.type)) return getEquipPreview(item);
        return null;
    }, [getEquipPreview]);

    const isEquipUpgrade = useCallback((item: any) => {
        const diff = getCompareDiff(item);
        if (!diff) return false;
        return (diff.atk + diff.def + (diff.crit * 2) + Math.floor(diff.mp / 5)) > 0;
    }, [getCompareDiff]);

    const handleSmartEquip = () => {
        if (bestWeapon && isEquipUpgrade(bestWeapon)) actions.useItem(bestWeapon);
        if (bestArmor && isEquipUpgrade(bestArmor)) actions.useItem(bestArmor);
    };

    // 시나리오 2: 인벤토리 과밀 감지 (최대의 90%)
    const isInvNearFull = (player.inv || []).length >= BALANCE.INV_FULL_THRESHOLD;
    const sellableMatCount = useMemo(() =>
        (player.inv || []).filter((i: any) => i.type === 'mat' && (i.price || 0) <= 30).length,
        [player.inv]
    );

    return (
        <div className="space-y-3">
            {spotlightNames.length > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-testid="inventory-spotlight-detail"
                    className="flex items-start justify-between gap-3 rounded-[1rem] border border-[#9a8ac0]/20 bg-[radial-gradient(circle_at_top_right,rgba(154,138,192,0.16),transparent_24%),linear-gradient(180deg,rgba(33,22,46,0.22)_0%,rgba(16,10,20,0.1)_100%)] px-3 py-2.5"
                >
                    <div className="min-w-0">
                        <div className="text-xs font-fira uppercase tracking-[0.16em] text-[#e3dcff]/72">
                            {spotlight?.title || MSG.UI_LOOT_FOCUS}
                        </div>
                        <div className="mt-1 text-sm font-fira text-slate-200/82 leading-snug">
                            {spotlight?.detail || MSG.UI_LOOT_FOCUS_HINT}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {spotlightNames.slice(0, 3).map((name: any) => (
                                <SignalBadge key={`spotlight_${name}`} tone="spotlight" size="sm">{name}</SignalBadge>
                            ))}
                        </div>
                    </div>
                    {onClearSpotlight && (
                        <button
                            onClick={() => onClearSpotlight()}
                            className="shrink-0 rounded-full border border-white/8 bg-black/18 px-2.5 py-1 text-xs font-fira text-slate-300/76 hover:bg-white/[0.04]"
                        >
                            {MSG.UI_CLOSE}
                        </button>
                    )}
                </Motion.div>
            )}

            {/* Filter Bar */}
            <div className="rounded-[1rem] border border-white/8 bg-black/16 px-2 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                {FILTERS.map((f: any) => (
                    <button
                        key={f.id}
                        onClick={() => {
                            setActiveFilter(f.id);
                        }}
                        className={`min-h-[30px] px-2.5 py-1 text-sm rounded-full border font-rajdhani font-bold transition-all
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
                        className="ml-auto rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8] font-rajdhani font-bold flex items-center gap-1 hover:bg-[#d5b180]/16 transition-all min-h-[30px] px-2.5 py-1 text-sm"
                        title={MSG.UI_AUTO_EQUIP_BEST}
                    >
                        <Star size={11} /> 추천 장착
                    </Motion.button>
                )}
                </div>
            </div>

            {/* 시나리오 2: 인벤토리 과밀 배너 + 일괄 판매 */}
            {isInvNearFull && sellableMatCount > 0 && (
                <Motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-[1rem] border border-[#d5b180]/18 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.14),transparent_24%),linear-gradient(180deg,rgba(41,29,14,0.22)_0%,rgba(18,13,8,0.1)_100%)] px-3 py-2"
                >
                    <div className="flex items-center gap-2 text-[#f6e7c8] font-fira text-sm">
                        <AlertCircle size={13} className="shrink-0 animate-pulse" />
                        <span>인벤토리 {(player.inv || []).length}/20 — 저가 재료 {sellableMatCount}개 정리 가능</span>
                    </div>
                    <Motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => actions.autoSell?.()}
                        className="flex items-center gap-1 font-rajdhani font-bold text-[#f6e7c8] bg-black/18 hover:bg-white/[0.04] border border-white/8 rounded-full transition-all shrink-0 ml-2 min-h-[30px] px-2.5 py-1 text-sm"
                    >
                        <Package size={11} /> 일괄 정리
                    </Motion.button>
                </Motion.div>
            )}

            {/* Item List */}
            <div className="space-y-1.5">
                {filtered.length === 0 && (
                    <div className="rounded-[1rem] border border-white/8 bg-black/16 py-6 text-sm text-center font-rajdhani tracking-widest text-slate-500">
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
                    const isSignature = isSignatureItem(item);
                    const resonance = getTraitItemResonance(item, traitProfile, player);
                    const enhanceState = getEnhanceAvailability(item, player.gold ?? 0, (player.inv || []));
                    const enhanceRequirement = enhanceState.requirement;

                    // 우선순위: spotlight > signature > currentEquip > default
                    const rowClass = isSpotlighted
                        ? 'border border-[#9a8ac0]/30 bg-[#9a8ac0]/10 shadow-[0_0_16px_rgba(154,138,192,0.12)]'
                        : isSignature
                            ? 'border shadow-[0_0_14px_rgba(246,231,162,0.10)]'
                            : isCurrentEquip
                                ? 'border border-emerald-300/24 bg-emerald-300/[0.06]'
                                : 'border border-white/8 aether-panel-muted hover:border-[#7dd4d8]/18 hover:bg-white/[0.03]';

                    const rowStyle = !isSpotlighted && isSignature
                        ? {
                            borderColor: 'rgba(246,231,162,0.42)',
                            background: 'linear-gradient(180deg, rgba(246,231,162,0.08) 0%, rgba(18,16,10,0.72) 100%)',
                        }
                        : undefined;

                    return (
                        <Motion.div
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            style={rowStyle}
                            className={`min-h-[54px] p-3 rounded-[1rem] flex justify-between items-center group transition-all cursor-pointer ${rowClass}`}
                        >
                            <ItemIcon item={item} size={36} showBorder className="mr-2 opacity-95" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                        className={`text-sm font-fira ${isSignature ? '' : (item.tier >= 2 ? 'text-[#e3dcff]' : 'text-white/86')}`}
                                        style={isSignature ? { color: '#f6e7a2' } : undefined}
                                    >
                                        {item.name}
                                    </span>
                                    {(item.enhance || 0) > 0 && (
                                        <span className="text-xs font-bold font-fira text-[#d5b180]">+{item.enhance}</span>
                                    )}
                                    {count > 1 && <span className="text-sm text-slate-500">x{count}</span>}
                                    {isSignature && (
                                        <span
                                            data-testid={`inventory-signature-chip-${item.id || item.name}`}
                                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em]"
                                            style={{
                                                color: '#f6e7a2',
                                                border: '1px solid rgba(246,231,162,0.42)',
                                                background: 'rgba(246,231,162,0.08)',
                                            }}
                                        >
                                            ✦ 전설 각인
                                        </span>
                                    )}
                                    {isSpotlighted && <SignalBadge tone="spotlight" size="sm">주목</SignalBadge>}
                                    {isCurrentEquip && <SignalBadge tone="equipped" size="sm">장착 중</SignalBadge>}
                                    {resonance.label && <SignalBadge tone={resonance.score >= 6 ? 'recommended' : 'resonance'} size="sm">{resonance.label}</SignalBadge>}
                                    {!canEquip && <SignalBadge tone="danger" size="sm">직업 제한</SignalBadge>}
                                    {canEquip && Array.isArray(item.jobs) && item.jobs.includes(player.job) && ['weapon', 'armor', 'shield'].includes(item.type) && (
                                        <span
                                            data-testid={`inventory-job-affinity-${item.id || item.name}`}
                                            title={`${player.job} 세트 매치 — 같은 직업 호환 장비를 모으면 세트 효과 발동`}
                                            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-fira font-bold uppercase tracking-[0.1em]"
                                            style={{
                                                color: '#d5b180',
                                                border: '1px solid rgba(213,177,128,0.42)',
                                                background: 'rgba(213,177,128,0.10)',
                                            }}
                                        >
                                            ⚔ {player.job} 세트
                                        </span>
                                    )}
                                </div>

                                {/* Compare diff (on hover or always for equip items) */}
                                {diff && (hoveredItem === item.name || isCurrentEquip) && (
                                    <div className="mt-1 flex gap-2">
                                        {diff.atk !== 0 && <StatDiff val={diff.atk} label="ATK" />}
                                        {diff.def !== 0 && <StatDiff val={diff.def} label="DEF" />}
                                        {diff.crit !== 0 && <StatDiff val={diff.crit} label="CRIT%" />}
                                        {diff.mp !== 0 && <StatDiff val={diff.mp} label="MP" />}
                                        {diff.atk === 0 && diff.def === 0 && diff.crit === 0 && diff.mp === 0 && <Minus size={11} className="text-cyber-blue/30" />}
                                    </div>
                                )}
                                {(getItemStatText(item) || item.desc_stat) && (
                                    <div className="mt-0.5 truncate font-fira text-slate-400/72 text-sm">{getItemStatText(item) || item.desc_stat}</div>
                                )}
                                {enhanceRequirement && (
                                    <div className="mt-0.5 space-y-0.5 text-[11px] font-fira">
                                        <div className="text-slate-500/88">
                                            강화 비용 {enhanceRequirement.gold.toLocaleString()}G · 강화 재료 {enhanceRequirement.materials}
                                        </div>
                                        <div className={enhanceState.affordable ? 'text-emerald-200/70' : 'text-amber-200/78'}>
                                            {enhanceState.hint}
                                        </div>
                                    </div>
                                )}
                                {getItemTags(item).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {getItemTags(item).map((tag: any) => (
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
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                {enhanceState.canEnhance && actions.enhanceItem && (
                                    <Motion.button
                                        whileTap={{ scale: 0.95 }}
                                        disabled={!enhanceState.affordable}
                                        onClick={() => actions.enhanceItem(item.id)}
                                        className={`rounded-full border font-bold font-fira ${enhanceState.affordable ? 'bg-[#d5b180]/10 hover:bg-[#d5b180]/18 text-[#f6e7c8] border-[#d5b180]/22' : 'border-white/8 bg-black/20 text-slate-500'} min-h-[38px] px-2.5 py-2 text-xs`}
                                        title={`강화 +${(item.enhance || 0) + 1}`}
                                    >
                                        +강화
                                    </Motion.button>
                                )}
                                <Motion.button
                                    whileTap={{ scale: 0.95 }}
                                    disabled={!canEquip}
                                    onClick={() => actions.useItem(item)}
                                    className="bg-[#7dd4d8]/10 hover:bg-[#7dd4d8]/16 disabled:opacity-30 disabled:hover:bg-[#7dd4d8]/10 text-[#dff7f5] rounded-full border border-[#7dd4d8]/22 font-bold min-h-[38px] px-3 py-2 text-sm"
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
