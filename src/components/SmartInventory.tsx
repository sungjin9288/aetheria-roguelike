import React, { useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Star, Package, AlertCircle, ListTree, Sparkles, Swords } from 'lucide-react';
import { QuickSlotAssigner } from './QuickSlot';
import { getEquipmentDecision, getEquipmentDisclosure, getEquipmentIdentity, getItemStatText, getWeaponStyleLabel, isWeapon, pickBestEquippable } from '../utils/equipmentUtils';
import { getEnhanceAvailability, getEnhancePreview, type EnhanceItemSlot } from '../utils/enhancementUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';
import { MSG } from '../data/messages';
import { BALANCE, RARITY_CLASSES } from '../data/constants';
import { getItemRarity } from '../utils/gameUtils';
import { getInventoryCapacity } from '../utils/inventoryCapacity';
import { getAutoSellMaterialTargets } from '../utils/bagCrafting';
import { isSignatureItem } from '../data/signatureItems.js';
import { isEquipmentUseItem, isInventoryUseAccepted } from '../systems/consumableRules';
import SignalChip from './archive/SignalChip';
import ActionButton from './ui/ActionButton';
import ItemIcon from './icons/ItemIcon';
import EnhanceDecisionCard from './EnhanceDecisionCard';
import type { GameActions } from '../hooks/actionDeps';
import type { Item, Player } from '../types/index.js';

/** SmartInventory가 실제로 호출하는 액션만 좁혀 받는다 (장착/강화/일괄 판매). */
type SmartInventoryActions = Pick<GameActions, 'useItem' | 'enhanceItem' | 'autoSell'>;

/** 인벤토리 그룹 1건 — 이름(+강화 단계) 기준으로 묶인 아이템과 개수. */
interface GroupedInventoryEntry {
    item: Item;
    count: number;
}

// cycle 482: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 + 33 ternary + 5 const 일괄 정리
//   (cycle 472-479/481 paired의 11번째 / 마지막 panel cleanup으로 cascade 완료).
interface SmartInventoryProps {
    player: Player;
    actions?: SmartInventoryActions;
    quickSlots?: Array<Item | null>;
    onAssignQuickSlot?: (idx: number, item: Item | null) => void;
}

/**
 * 장비 교체 시 달라지는 능력치를 보여준다.
 */
const StatDiff = ({ val, label, suffix }: { val: number; label: string; suffix: string }) => {
    if (val === 0) return <span className="text-[12px] font-readable text-ae-ink-3">{label} <span className="font-fira tabular-nums">±0{suffix}</span></span>;
    const up = val > 0;
    return (
        <span className={`flex items-center gap-0.5 text-[12px] font-readable font-bold ${up ? 'text-ae-good' : 'text-ae-threat'}`}>
            {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
            {label} <span className="font-fira tabular-nums">{up ? '+' : ''}{val}{suffix}</span>
        </span>
    );
};

/**
 * SmartInventory — 인벤토리 스마트 필터 + 장비 비교 (시나리오 2)
 */
const FILTERS = [
    { id: 'all', label: MSG.INV_FILTER_ALL },
    { id: 'weapon', label: MSG.INV_FILTER_WEAPON },
    { id: 'armor', label: MSG.INV_FILTER_ARMOR },
    { id: 'shield', label: MSG.INV_FILTER_SHIELD },
    { id: 'hp', label: MSG.INV_FILTER_CONSUMABLE },
    { id: 'material', label: MSG.INV_FILTER_MATERIAL },
];

const ITEM_TYPE_TO_FILTER: Record<string, string> = {
    weapon: 'weapon',
    armor: 'armor',
    shield: 'shield',
    hp: 'hp',
    mp: 'hp',
    buff: 'hp',
    cure: 'hp',
    mat: 'material',
};

const getItemTags = (item: Item): string[] => {
    const tags: string[] = [];
    if (isWeapon(item) || item?.type === 'shield') tags.push(getWeaponStyleLabel(item));
    return tags;
};

// cycle 452: 컴팩트 default 제거 — Dashboard 호출자가 명시 전달이라 도달 불가.
const SmartInventory = ({ player, actions, quickSlots, onAssignQuickSlot }: SmartInventoryProps) => {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [detailOverride, setDetailOverride] = React.useState<boolean | null>(null);
    const [enhanceTarget, setEnhanceTarget] = React.useState<{ item: Item; slot: EnhanceItemSlot } | null>(null);
    const disclosure = getEquipmentDisclosure(player);
    const showDetails = detailOverride ?? disclosure.showDetails;
    const enhancePreview = useMemo(() => (
        enhanceTarget
            ? getEnhancePreview(enhanceTarget.item, player.gold ?? 0, player.inv || [], enhanceTarget.slot)
            : null
    ), [enhanceTarget, player.gold, player.inv]);
    const traitProfile = useMemo(
        () => getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player]
    );

    const grouped = useMemo(() => {
        const map: Record<string, GroupedInventoryEntry> = {};
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
        return grouped.filter(({ item }) => {
            const f = ITEM_TYPE_TO_FILTER[item.type ?? ''] || item.type;
            return f === activeFilter;
        });
    }, [grouped, activeFilter]);

    // A2 (2026-09 감사 G4): bestWeapon은 getEquipPreview 점수, bestArmor는 raw val이라
    //   두 슬롯의 "최적" 정책이 서로 달랐다(방어구는 강화·직업 제한을 무시).
    //   pickBestEquippable이 두 슬롯 모두 getEquipmentDecision 점수(강화 반영)로 통일한다.
    //   Codex: 추천은 "지금 장착 가능한 실제 업그레이드"만 — upgradesOnly가 score > 0을 요구한다.
    const bestWeapon = useMemo(() => pickBestEquippable(player, 'weapon', { upgradesOnly: true }), [player]);
    const bestArmor = useMemo(() => pickBestEquippable(player, 'armor', { upgradesOnly: true }), [player]);

    const isEquipUpgrade = useCallback((item: Item) => {
        const decision = getEquipmentDecision(player, item);
        return Boolean(decision?.equipable && decision.score > 0);
    }, [player]);

    const confirmEnhancement = () => {
        if (!enhanceTarget || !enhancePreview?.affordable) return;

        const itemId = enhanceTarget.item.id || (enhanceTarget.slot ? `equip:${enhanceTarget.slot}` : null);
        if (itemId) actions?.enhanceItem?.(itemId);
        setEnhanceTarget(null);
    };

    const handleSmartEquip = () => {
        if (bestWeapon && isEquipUpgrade(bestWeapon)) actions?.useItem(bestWeapon);
        if (bestArmor && isEquipUpgrade(bestArmor)) actions?.useItem(bestArmor);
    };

    // 시나리오 2: 인벤토리 과밀 감지 — 기본 20칸에서 18(2칸 남음)이던 여유를 지금 상한에서 뺀다(2026-09 Wave 33:
    //   제작한 가방·크리스털 확장을 따라간다).
    const inventoryCapacity = getInventoryCapacity(player);
    const isInvNearFull = (player.inv || []).length
        >= inventoryCapacity - (BALANCE.INV_MAX_SIZE - BALANCE.INV_FULL_THRESHOLD);
    const sellableMatCount = useMemo(() => getAutoSellMaterialTargets(player).length, [player]);

    return (
        <div className="space-y-3">
            <div
                data-testid="inventory-equipment-disclosure"
                data-equipment-view={showDetails ? 'full' : 'summary'}
                className="flex items-center justify-between gap-3 px-1"
            >
                <div className="min-w-0">
                    <div className="text-[13px] font-readable font-bold text-ae-ink">장비 비교</div>
                    <div className="mt-0.5 text-[12px] font-readable text-ae-ink-3">
                        {showDetails ? '전체 능력치와 강화 조건 표시' : '추천·대표 변화·장착·세트만 표시'}
                    </div>
                </div>
                <ActionButton
                    variant="ghost"
                    data-testid="inventory-detail-toggle"
                    aria-expanded={showDetails}
                    onClick={() => setDetailOverride(!showDetails)}
                    className="min-h-11 shrink-0 px-3 text-[12px]"
                    icon={<ListTree size={14} />}
                    label={showDetails ? '간단히 보기' : '상세 보기'}
                />
            </div>

            {/* Filter Bar — 2026-10 에테르 유리: 분류는 기록 탭과 같은 선택 알약(에테르 물빛 = 지금 고른 것). */}
            <div className="flex flex-wrap items-center gap-1 px-0.5">
                {FILTERS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        data-active={activeFilter === f.id ? 'true' : 'false'}
                        aria-pressed={activeFilter === f.id}
                        onClick={() => {
                            setActiveFilter(f.id);
                        }}
                        className="ae-archive-tab min-h-11 rounded-full px-3 text-[13px] font-readable font-bold"
                    >
                        {f.label}
                    </button>
                ))}

                {/* Smart Equip Button */}
                {(bestWeapon || bestArmor) && (
                    <ActionButton
                        variant="glass"
                        onClick={handleSmartEquip}
                        className="ml-auto min-h-11 px-3 text-[13px]"
                        title={MSG.UI_AUTO_EQUIP_BEST}
                        icon={<Star size={14} className="text-ae-gold" />}
                        label="추천 장착"
                    />
                )}
            </div>

            {/* 시나리오 2: 인벤토리 과밀 배너 + 일괄 판매 */}
            {isInvNearFull && sellableMatCount > 0 && (
                <Motion.div
                    data-testid="inventory-bulk-sell-banner"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                    className="ae-well flex items-center justify-between gap-2 px-3 py-2"
                >
                    <div className="flex items-center gap-2 text-[13px] font-readable text-ae-gold-text">
                        <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
                        <span>{MSG.BAG_AUTOSELL_NOTICE((player.inv || []).length, inventoryCapacity, sellableMatCount)}</span>
                    </div>
                    <ActionButton
                        variant="glass"
                        onClick={() => actions?.autoSell?.()}
                        className="min-h-11 shrink-0 px-3 text-[13px]"
                        icon={<Package size={14} />}
                        label="일괄 정리"
                    />
                </Motion.div>
            )}

            {/* Item List — 2026-10 에테르 유리: 상자 대신 hairline으로 나뉜 줄. 장착 중 · 전설 각인 줄만 물빛으로 띄운다. */}
            <div className="ae-card ae-rows px-3 py-1">
                {filtered.length === 0 && (
                    <div className="py-6 text-center text-[13px] font-readable text-ae-ink-3">
                        해당 카테고리의 아이템이 없습니다
                    </div>
                )}
                {filtered.map(({ item, count }, i) => {
                    const decision = getEquipmentDecision(player, item);
                    const diff = decision?.diff || null;
                    const isEquipment = Boolean(decision);
                    const canEquip = decision?.equipable ?? true;
                    const itemIdentity = getEquipmentIdentity(item);
                    const isCurrentEquip =
                        getEquipmentIdentity(player.equip?.weapon) === itemIdentity ||
                        getEquipmentIdentity(player.equip?.armor) === itemIdentity ||
                        getEquipmentIdentity(player.equip?.offhand) === itemIdentity;
                    const isSignature = isSignatureItem(item);
                    const resonance = getTraitItemResonance(item, traitProfile, player);
                    const enhanceState = getEnhanceAvailability(item, player.gold ?? 0, (player.inv || []));
                    const enhanceRequirement = enhanceState.requirement;

                    const rowClass = isSignature
                        ? 'ae-equip-slot is-signature -mx-1.5 my-1 rounded-ae-md px-1.5'
                        : isCurrentEquip
                            ? 'ae-inventory-equipped -mx-1.5 my-1 rounded-ae-md px-1.5'
                            : '';

                    return (
                        <Motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            className={`flex min-h-[54px] flex-wrap items-center justify-between gap-y-2 py-3 ${rowClass}`}
                        >
                            <ItemIcon item={item} size={40} showBorder className="mr-2.5" />
                            {/* 2026-10 Wave 68: 설명 칸이 10rem보다 좁아지면 버튼 열이 다음 줄(오른쪽)로 내려간다 — 버튼 열이 옆에 남아 있던 동안
                                375px에서 무기 설명이 115px 칸에 네 줄로 꺾였다(원장 §69.5). */}
                            <div data-testid="inventory-item-body" className="min-w-0 flex-[1_1_10rem]">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                        className={`text-[14px] font-readable font-bold ${isSignature ? 'text-ae-gold-hi' : RARITY_CLASSES[getItemRarity(item)] || 'text-ae-ink'}`}
                                    >
                                        {item.name}
                                    </span>
                                    {(item.enhance || 0) > 0 && (
                                        <span className="font-fira text-[13px] font-bold tabular-nums text-ae-gold-text">+{item.enhance}</span>
                                    )}
                                    {count > 1 && <span className="font-fira text-[13px] tabular-nums text-ae-ink-3">x{count}</span>}
                                    {isSignature && (
                                        <span
                                            data-testid={`inventory-signature-chip-${item.id || item.name}`}
                                            className="ae-chip ae-chip-gold"
                                        >
                                            <Sparkles size={11} aria-hidden="true" />
                                            전설 각인
                                        </span>
                                    )}
                                    {isCurrentEquip && <SignalChip tone="equipped">장착 중</SignalChip>}
                                    {showDetails && resonance.label && <SignalChip tone={resonance.score >= 6 ? 'recommended' : 'resonance'}>{resonance.label}</SignalChip>}
                                    {showDetails && canEquip && Array.isArray(item.jobs) && item.jobs.includes(player.job ?? '') && ['weapon', 'armor', 'shield'].includes(item.type ?? '') && (
                                        <span
                                            data-testid={`inventory-job-affinity-${item.id || item.name}`}
                                            title={`${player.job} 세트 매치 — 같은 직업 호환 장비를 모으면 세트 효과 발동`}
                                            className="ae-chip ae-chip-gold"
                                        >
                                            <Swords size={11} aria-hidden="true" />
                                            {player.job} 세트
                                        </span>
                                    )}
                                </div>

                                {decision && (
                                    <div
                                        data-testid={`inventory-equipment-decision-${item.id || item.name}`}
                                        className="mt-1.5 flex flex-wrap items-center gap-1.5"
                                    >
                                        <SignalChip tone={isCurrentEquip ? 'equipped' : decision.tone === 'positive' ? 'recommended' : decision.tone === 'negative' ? 'warning' : decision.tone === 'blocked' ? 'danger' : 'neutral'}>
                                            {isCurrentEquip ? '장착 중' : decision.recommendation}
                                        </SignalChip>
                                        <span className={`text-[12px] font-readable font-bold ${decision.primaryDelta.value > 0 ? 'text-ae-good' : decision.primaryDelta.value < 0 ? 'text-ae-threat' : 'text-ae-ink-2'}`}>
                                            {!decision.equipable && '가정 비교 · '}{decision.primaryDelta.text}
                                        </span>
                                        <SignalChip tone={decision.equipable ? 'success' : 'danger'}>
                                            {decision.equipable ? '장착 가능' : '장착 불가'}
                                        </SignalChip>
                                        <SignalChip
                                            data-testid={`inventory-set-contribution-${item.id || item.name}`}
                                            tone={decision.setContribution > 0 ? 'upgrade' : 'neutral'}
                                        >
                                            {decision.setContributionText}
                                        </SignalChip>
                                    </div>
                                )}

                                {showDetails && diff && (
                                    <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
                                        {diff.atk !== 0 && <StatDiff val={diff.atk} label="공격력" suffix="" />}
                                        {diff.def !== 0 && <StatDiff val={diff.def} label="방어력" suffix="" />}
                                        {diff.crit !== 0 && <StatDiff val={diff.crit} label="치명타" suffix="%" />}
                                        {diff.mp !== 0 && <StatDiff val={diff.mp} label="기력" suffix="" />}
                                        {diff.atk === 0 && diff.def === 0 && diff.crit === 0 && diff.mp === 0 && <Minus size={12} aria-hidden="true" className="text-ae-ink-3" />}
                                    </div>
                                )}
                                {(!isEquipment || showDetails) && (getItemStatText(item) || item.desc_stat) && (
                                    <div className="mt-1 text-[12px] font-readable leading-relaxed text-ae-ink-2">{getItemStatText(item) || item.desc_stat}</div>
                                )}
                                {showDetails && enhanceRequirement && (
                                    <div className="mt-1 space-y-0.5 text-[12px] font-readable">
                                        <div className="text-ae-ink-3">
                                            강화 비용: 골드 {enhanceRequirement.gold.toLocaleString()} · 강화 재료 {enhanceRequirement.materials}개
                                        </div>
                                        <div className={enhanceState.affordable ? 'text-ae-good' : 'text-ae-gold-text'}>
                                            {enhanceState.hint}
                                        </div>
                                    </div>
                                )}
                                {showDetails && getItemTags(item).length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {getItemTags(item).map((tag) => (
                                            <SignalChip key={`${item.name}_${tag}`} tone="neutral">{tag}</SignalChip>
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
                            <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
                                {showDetails && enhanceState.canEnhance && actions?.enhanceItem && (
                                    <ActionButton
                                        variant="glass"
                                        data-testid={`inventory-enhance-${item.id || item.name}`}
                                        onClick={() => setEnhanceTarget({ item, slot: null })}
                                        aria-label={`${item.name} 강화 결과와 비용 보기`}
                                        className="min-h-11 px-3 text-[12px]"
                                        title="강화 결과와 비용 보기"
                                        label="강화 보기"
                                    />
                                )}
                                {/* Wave 61 (원장 §61.3 소모품 · 상점): 리듀서(USE_INVENTORY_ITEM)가 받는 종류에만 버튼을 그린다 — 재료 · 열쇠의
                                    "사용"은 눌러도 아무 일이 없었다. 판정은 리듀서와 같은 isInventoryUseAccepted 하나다. */}
                                {isInventoryUseAccepted(item) && (
                                    <ActionButton
                                        variant="glass"
                                        data-testid={`inventory-use-${item.id || item.name}`}
                                        disabled={!canEquip}
                                        onClick={() => actions?.useItem(item)}
                                        className="min-h-11 px-3.5 text-[13px]"
                                        label={!canEquip ? '제한' : isEquipmentUseItem(item) ? (isCurrentEquip ? '장착됨' : '장착') : '사용'}
                                    />
                                )}
                            </div>
                        </Motion.div>
                    );
                })}
            </div>

            {enhancePreview && (
                <EnhanceDecisionCard
                    preview={enhancePreview}
                    onCancel={() => setEnhanceTarget(null)}
                    onConfirm={confirmEnhancement}
                />
            )}
        </div>
    );
};

export default SmartInventory;
