import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShoppingBag } from 'lucide-react';
import { BALANCE, RARITY_CLASSES } from '../data/constants';
import { getInventoryCapacity } from '../utils/inventoryCapacity';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import { getEquipmentComparison, getEquipmentDecision, getEquipmentDisclosure, getItemStatText, getSellIncome, getWeaponStyleLabel, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';
import { getDailyDeals, getShopBuyPrice, getShopMaxTier, getShopPriceMult, getWeeklySpecial } from '../utils/shopRotation';
import { getActiveMerchantVisit, getMerchantShelf } from '../utils/wanderingMerchant';
import FocusPanelHeader from './FocusPanelHeader';
import ItemIcon from './icons/ItemIcon';
import ActionButton from './ui/ActionButton';
import Chip, { type ChipTone } from './ui/Chip';
import { getItemRarity } from '../utils/gameUtils';
import { getSignatureSaleVerdict } from '../utils/signatureSale';
import { getConsumableDescription, getConsumableEffectSummary } from '../utils/consumablePresentation';
import type { GameActions } from '../hooks/actionDeps';
import type { FullStats, Item, ItemType, Player } from '../types/index.js';
import type { GameMode } from '../reducers/gameStates';

/** ShopPanel이 실제로 호출하는 액션만 좁혀 받는다 (구매/판매/구매 영수증 해제). */
type ShopPanelActions = Pick<GameActions, 'economyReceipt' | 'clearEconomyReceipt' | 'market'> & Partial<Pick<GameActions, 'leaveMerchant'>>;

/** getComparisonMeta / getEquipmentDecision이 쓰는 비교 어조 — getToneClass 배색과 1:1. */
type ComparisonTone = 'positive' | 'negative' | 'neutral';

interface ComparisonMeta {
    text: string;
    tone: ComparisonTone;
}

const EQUIPMENT_ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'shield'];
const CONSUMABLE_ITEM_TYPES: ItemType[] = ['hp', 'mp', 'cure', 'buff'];

// cycle 488: 모바일 포커스 prop 인터페이스 제거 — cycle 486 paired completion
//   (ControlPanel cascade로 caller 0건이라 항상 truthy 전달이었음).
interface ShopPanelProps {
    player: Player;
    actions?: ShopPanelActions;
    shopItems?: Item[];
    setGameState?: (state: GameMode) => void;
    stats?: FullStats | null;
    onOpenArchiveConsole?: (target?: string) => void;
}

const isEquipmentItem = (item: Item | null | undefined): boolean => (
    Boolean(item?.type && EQUIPMENT_ITEM_TYPES.includes(item.type))
);

const getItemTags = (item: Item): string[] => {
    const tags: string[] = [];
    if (isWeapon(item)) tags.push(getWeaponStyleLabel(item));
    return tags;
};

// cycle 531: equip default {} 제거 — 2 callsite (line 295/370 getComparisonMeta
//   (item, player.equip)) equip 명시 전달이라 default 도달 불가.
// A2 (2026-09 감사 G4): 장비 비교 델타를 자체 계산하던 로직 제거 →
//   equipmentUtils.getEquipmentComparison(= getEquipmentDecision 기반, 강화 +N 반영)에 위임.
//   기존 계산은 강화 보너스를 무시해 강화 장비 착용 시 업그레이드 폭을 과대 표시했다.
//   표시 형식(라벨 · 순서 · ' / ' 구분자)은 동일하게 유지 — 라벨 원천만 MSG로 이동.
const getComparisonMeta = (item: Item | null | undefined, player: Player | null | undefined): ComparisonMeta | null => {
    if (!item) return null;

    if (item.type === 'armor' || item.type === 'shield' || item.type === 'weapon') {
        const comparison = getEquipmentComparison(player, item);
        if (!comparison) return null;
        const replacedOffhand = item.type === 'weapon' && isTwoHandWeapon(item) && player?.equip?.offhand;

        return {
            text: `${comparison.summaryText}${replacedOffhand ? ` / ${MSG.EQUIP_DELTA_OFFHAND_RELEASED}` : ''}`,
            tone: comparison.score > 0 ? 'positive' : comparison.score < 0 ? 'negative' : 'neutral',
        };
    }

    // Wave 61 (원장 §61.3 소모품 · 상점): 소모품 효과 문구는 consumablePresentation이 엔진 판정으로 만든다 — 여기서 만들던 동안
    //   엘릭서가 "생명 9999 회복", 정화가 "poison 해제"였다.
    if (item.type === 'hp' || item.type === 'mp' || item.type === 'buff') return { text: getConsumableEffectSummary(item), tone: 'positive' };
    if (item.type === 'cure') return { text: getConsumableEffectSummary(item), tone: 'neutral' };

    return null;
};

// 2026-10 에테르 유리: 비교 어조 색은 토큰이다 — 좋아짐은 에테르, 나빠짐은 위험, 그대로는 잉크.
const getToneClass = (tone: ComparisonTone): string => {
    if (tone === 'positive') return 'text-ae-ether-hi bg-ae-ether/10';
    if (tone === 'negative') return 'text-ae-threat bg-ae-threat/10';
    return 'text-ae-ink-2 bg-ae-s3';
};

/** 이름 색 — 등급 색의 한 원천(`RARITY_CLASSES`). */
const getRarityTextClass = (item: Item): string => RARITY_CLASSES[getItemRarity(item)] || 'text-ae-ink';

const DECISION_CHIP_TONE: Readonly<Record<string, ChipTone>> = Object.freeze({
    positive: 'good',
    negative: 'gold',
    blocked: 'threat',
});

interface BuyBlockContext {
    canStore: boolean;
    affordable: boolean;
    equipable: boolean;
    item: Item;
}

const getBuyBlockReason = ({ canStore, affordable, equipable, item }: BuyBlockContext): string => {
    if (!canStore) return '가방 가득';
    if (!affordable) return '골드 부족';
    if (!equipable && isEquipmentItem(item)) return '직업 제한';
    return '';
};

// cycle 531: value default '' 제거 — 3 callsite (line 90/94/372) 모두 string
//   || fallback으로 string 보장 후 명시 전달이라 default 도달 불가.
const getCompactText = (value: string): string => value.replaceAll(' / ', ' · ');

const getCompactComparisonText = (comparison: ComparisonMeta | null): string => (
    getCompactText(comparison?.text || '').replace(MSG.EQUIP_DELTA_NONE, MSG.EQUIP_DELTA_NONE_COMPACT)
);

const getCompactItemSummary = (item: Item): string => {
    if (item.type && CONSUMABLE_ITEM_TYPES.includes(item.type)) return getConsumableDescription(item);
    const summary = getCompactText(getItemStatText(item) || item.desc || '');
    if (!isWeapon(item)) return summary;
    return summary.replace(/^(한손|양손) 무기\s·\s/, '');
};

const formatGold = (value: number | undefined): string => `${Number(value || 0).toLocaleString()} 골드`;

interface ShopEquipmentDecisionStripProps {
    player: Player;
    item: Item;
    scope: 'daily' | 'weekly' | 'list';
}

const ShopEquipmentDecisionStrip = ({ player, item, scope }: ShopEquipmentDecisionStripProps) => {
    const decision = getEquipmentDecision(player, item);
    if (!decision) return null;

    return (
        <div
            data-testid={`shop-equipment-decision-${scope}-${item.id || item.name}`}
            className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-readable"
        >
            <Chip tone={DECISION_CHIP_TONE[decision.tone] || 'neutral'} className="font-bold">
                {decision.recommendation}
            </Chip>
            <span className={`font-bold ${decision.primaryDelta.value > 0 ? 'text-ae-good' : decision.primaryDelta.value < 0 ? 'text-ae-threat' : 'text-ae-ink-2'}`}>
                {!decision.equipable && '가정 비교 · '}{decision.primaryDelta.text}
            </span>
            <Chip
                data-testid={`shop-set-contribution-${scope}-${item.id || item.name}`}
                tone={decision.setContribution > 0 ? 'gold' : 'neutral'}
            >
                {decision.setContributionText}
            </Chip>
        </div>
    );
};

const MOBILE_INITIAL_BUY_LIMIT = 12;

// cycle 573: stats / onOpenArchiveConsole defaults 제거 — 1 production caller
//   (ControlPanel:147) 6 props 모두 명시 전달이라 두 default 모두 도달 불가.
//   청소 메가 시리즈 65번째.
const ShopPanel = ({ player, actions, shopItems, setGameState, stats, onOpenArchiveConsole }: ShopPanelProps) => {
    const [shopMode, setShopMode] = useState('buy');
    const [sellConfirmId, setSellConfirmId] = useState<string | null | undefined>(null);
    const [buyItemsExpansion, setBuyItemsExpansion] = useState({ key: '', expanded: false });
    const [detailOverride, setDetailOverride] = useState<boolean | null>(null);
    const disclosure = getEquipmentDisclosure(player);
    const showDetails = detailOverride ?? disclosure.showDetails;
    const loc = player.loc || '';
    const expansionKey = `${loc}:${shopMode}`;

    const maxTier = getShopMaxTier(loc);
    // 2026-10 Wave 75: 떠돌이 행상인 — 이번 만남의 재고만 판다(할인 · 주간 특별 상품 없음). 판매는 마을 상점과 같다.
    const isMerchant = getActiveMerchantVisit(player) !== null;
    const merchantShelf = isMerchant ? getMerchantShelf(player) : [];
    const closeShop = () => (isMerchant && actions?.leaveMerchant ? actions.leaveMerchant() : setGameState?.('idle'));

    const traitProfile = useMemo(
        () => getTraitProfile(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player, stats]
    );

    const currentJob = player.job;
    const currentGold = player.gold ?? 0;
    const inventoryHasRoom = (player.inv?.length || 0) < getInventoryCapacity(player);
    const buyItemsExpanded = buyItemsExpansion.key === expansionKey && buyItemsExpansion.expanded;

    const purchaseReceipt = actions?.economyReceipt?.type === 'buy' ? actions.economyReceipt : null;
    useEffect(() => {
        if (!purchaseReceipt) return undefined;
        const timer = window.setTimeout(() => actions?.clearEconomyReceipt?.(), 1800);
        return () => window.clearTimeout(timer);
    }, [actions, purchaseReceipt]);

    const buyItems = useMemo(() => {
        return (shopItems || [])
            .filter((item) => (item.tier || 1) <= maxTier)
            .map((item) => {
                // Wave 62 C20: 보이는 값 · 살 수 있는지 판정 모두 이 상점의 값(`getShopBuyPrice`) — 구매 리듀서와 같은 규칙.
                const price = item.price === undefined ? undefined : getShopBuyPrice(loc, item.price);
                const affordable = currentGold >= (price ?? Infinity);
                const equipable = !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(currentJob ?? '');
                const resonance = getTraitItemResonance(item, traitProfile, { job: currentJob });
                return {
                    item,
                    price,
                    affordable,
                    equipable,
                    inventoryHasRoom,
                    priorityScore: (affordable ? 0 : 1) + (equipable ? 0 : 2),
                    resonanceScore: resonance.score,
                };
            })
            .sort((a, b) => (
                a.priorityScore - b.priorityScore
                || b.resonanceScore - a.resonanceScore
                || (a.price || 0) - (b.price || 0)
            ));
    }, [shopItems, maxTier, loc, currentGold, currentJob, traitProfile, inventoryHasRoom]);

    const visibleBuyItems = useMemo(() => {
        if (buyItemsExpanded) return buyItems;
        return buyItems.slice(0, MOBILE_INITIAL_BUY_LIMIT);
    }, [buyItems, buyItemsExpanded]);

    const sellItems = useMemo(() => (
        [...(player.inv || [])]
            .filter((item) => !String(item.id).startsWith('starter_'))
            .sort((a, b) => (a.price || 0) - (b.price || 0))
    ), [player.inv]);

    const dailyDeals = useMemo(
        () => getDailyDeals(player.level || 1, loc),
        [player.level, loc]
    );
    const weeklySpecial = useMemo(
        () => getWeeklySpecial(player.level || 1, loc),
        [player.level, loc]
    );

    // 2026-10 에테르 유리: 한 장의 유리 머리 아래 상품은 묶음(`.ae-town-group`) 한 장에 머리카락 선으로 나뉜다.
    //   줄마다 구매는 유리 단추이고, 금빛 주 행동은 이 화면에 없다(사고파는 것은 줄마다 같은 무게의 결정이다).
    return (
        <div data-testid="shop-panel" className="ae-town aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <FocusPanelHeader
                eyebrow={isMerchant ? MSG.MERCHANT_SHOP_EYEBROW : '마을 거래소'}
                title={isMerchant ? MSG.MERCHANT_TITLE : '마을 상점'}
                titleClassName="text-[1.1rem] leading-tight"
                meta={MSG.SHOP_HEADER_META(
                    maxTier,
                    (player.inv || []).length,
                    getInventoryCapacity(player),
                    Math.round((isMerchant ? BALANCE.WANDERING_MERCHANT_PRICE_MULT : getShopPriceMult(loc)) * 100),
                )}
                onBack={closeShop}
                backLabel={MSG.UI_BACK}
                backTestId="shop-close"
                onOpenArchive={isMerchant ? null : onOpenArchiveConsole}
                archiveLabel="가방"
                archiveTestId="shop-open-archive"
            />

            {purchaseReceipt && (
                <div role="status" className="ae-town-receipt mb-2 px-3 py-2 font-readable text-[12px] font-semibold">
                    {MSG.SHOP_PURCHASE_RECEIPT(purchaseReceipt.itemName)}
                </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0 font-readable text-[12px] leading-[1.4] text-ae-ink-2">
                    {shopMode === 'buy' ? '구매 후보를 빠르게 비교합니다.' : '판매 확정 전 한 번 더 확인합니다.'}
                </div>
                {/* 2026-10 통합 감사(town-nav A11Y-05): 구매 · 판매 전환은 44px 누름 칸이고, 고른 쪽을 `aria-pressed`로 알린다. */}
                <div role="group" aria-label={MSG.SHOP_MODE_GROUP_ARIA} className="ae-town-seg w-[9.5rem] shrink-0">
                    <button
                        type="button"
                        data-testid="shop-mode-buy"
                        aria-pressed={shopMode === 'buy'}
                        onClick={() => {
                            setShopMode('buy');
                            setSellConfirmId(null);
                        }}
                        className="ae-town-seg-btn min-h-11 min-w-11 font-readable"
                    >
                        {MSG.SHOP_MODE_BUY}
                    </button>
                    <button
                        type="button"
                        data-testid="shop-mode-sell"
                        aria-pressed={shopMode === 'sell'}
                        onClick={() => {
                            setShopMode('sell');
                            setSellConfirmId(null);
                        }}
                        className="ae-town-seg-btn min-h-11 min-w-11 font-readable"
                    >
                        {MSG.SHOP_MODE_SELL}
                    </button>
                </div>
            </div>

            {shopMode === 'buy' && (
                <div
                    data-testid="shop-equipment-disclosure"
                    data-equipment-view={showDetails ? 'full' : 'summary'}
                    className="ae-sunk mb-3 flex items-center justify-between gap-3 rounded-ae-md py-1.5 pl-3 pr-1.5"
                >
                    <div className="min-w-0">
                        <div className="font-readable text-[12px] font-bold text-ae-ink">구매 판단</div>
                        <div className="mt-0.5 font-readable text-[11px] text-ae-ink-3">
                            {showDetails ? '전체 효과와 비교값 표시' : '추천·대표 변화·세트 기여만 표시'}
                        </div>
                    </div>
                    <button
                        type="button"
                        data-testid="shop-equipment-detail-toggle"
                        aria-expanded={showDetails}
                        onClick={() => setDetailOverride(!showDetails)}
                        className="ae-town-pill min-h-11 shrink-0 font-readable"
                    >
                        {showDetails ? '간단히 보기' : '상세 보기'}
                    </button>
                </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                {shopMode === 'buy' && isMerchant && (
                    <div data-testid="merchant-shelf" className="space-y-2">
                        <div className="font-readable text-[12px] leading-[1.4] text-ae-gold-text">{MSG.MERCHANT_SHOP_NOTE}</div>
                        {merchantShelf.every((slot) => slot.sold) && (
                            <div className="font-readable text-[12px] text-ae-ink-2">{MSG.MERCHANT_SOLD_OUT}</div>
                        )}
                        <div className="ae-town-group">
                            {merchantShelf.filter((slot) => !slot.sold).map(({ item, price, rare }) => {
                                const affordable = currentGold >= price;
                                const equipable = !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(currentJob ?? '');
                                const canBuy = affordable && equipable && inventoryHasRoom;
                                const blockReason = getBuyBlockReason({ canStore: inventoryHasRoom, affordable, equipable, item });
                                return (
                                    <div
                                        key={item.name}
                                        data-testid="merchant-offer"
                                        data-merchant-rare={rare ? 'true' : 'false'}
                                        className="ae-town-row flex items-center justify-between gap-2 px-3 py-2.5"
                                    >
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <ItemIcon item={item} size={38} showBorder />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className={`break-words font-readable text-[14px] font-semibold ${getRarityTextClass(item)}`}>{item.name}</span>
                                                    {rare && <Chip tone="gold" className="font-bold">{MSG.MERCHANT_RARE_BADGE}</Chip>}
                                                </div>
                                                <div className="mt-0.5 font-fira text-[12px] font-bold tabular-nums text-ae-gold-text">{formatGold(price)}</div>
                                                <ShopEquipmentDecisionStrip player={player} item={item} scope="list" />
                                            </div>
                                        </div>
                                        <ActionButton
                                            data-testid="merchant-buy"
                                            onClick={() => { if (canBuy) actions?.market('buy', item, 'merchant'); }}
                                            disabled={!canBuy}
                                            label={canBuy ? MSG.MERCHANT_BUY_ACTION : (blockReason || MSG.MERCHANT_BUY_BLOCKED)}
                                            className="aether-disabled-action min-h-[44px] min-w-11 shrink-0 px-3 text-[13px]"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {shopMode === 'buy' && !isMerchant && (dailyDeals.items.length > 0 || weeklySpecial) && (
                    <div className="space-y-2">
                        <div className="ae-eyebrow font-readable text-ae-gold-text">오늘의 할인 · 10%</div>
                        <div className="ae-town-group">
                            {dailyDeals.items.map((item) => {
                                const canStore = inventoryHasRoom;
                                const affordable = (player.gold ?? 0) >= (item.price ?? Infinity);
                                const equipable = !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(player.job ?? '');
                                const canBuy = canStore && affordable && equipable;
                                const reason = !canStore ? '가방 가득' : !affordable ? '골드 부족' : !equipable ? '직업 제한' : null;
                                return (
                                    <div key={item.name} className="ae-town-row flex items-center justify-between gap-2 px-3 py-2.5">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <ItemIcon item={item} size={34} showBorder />
                                            <div className="min-w-0">
                                                <div className={`break-words font-readable text-[13px] font-semibold ${getRarityTextClass(item)}`}>{item.name}</div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-fira text-[12px] tabular-nums">
                                                    <span className="font-bold text-ae-gold-text">{formatGold(item.price)}</span>
                                                    <span className="text-ae-ink-3 line-through">{formatGold(item.originalPrice)}</span>
                                                </div>
                                                <ShopEquipmentDecisionStrip player={player} item={item} scope="daily" />
                                                {/* slice 20: 본문 reason 행 제거 — 우측 버튼이 동일한
                                                    차단 사유를 표시해 같은 행에 2회 출력되던 중복. */}
                                            </div>
                                        </div>
                                        <ActionButton
                                            data-testid="shop-daily-buy"
                                            onClick={() => actions?.market('buy', item, 'daily')}
                                            disabled={!canBuy}
                                            title={!canBuy && reason ? reason : MSG.SHOP_MODE_BUY}
                                            label={canBuy ? MSG.SHOP_MODE_BUY : reason}
                                            className="aether-disabled-action min-h-[44px] min-w-11 shrink-0 px-3 text-[13px]"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        {weeklySpecial && (
                            <div className="ae-town-group flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <ItemIcon item={weeklySpecial} size={38} showBorder />
                                    <div className="min-w-0">
                                        <div className="ae-eyebrow mb-0.5 font-readable text-ae-ether-hi">이번 주 특별 상품 · 15%</div>
                                        <div className={`break-words font-readable text-[14px] font-semibold ${getRarityTextClass(weeklySpecial)}`}>{weeklySpecial.name}</div>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-fira text-[12px] tabular-nums">
                                            <span className="font-bold text-ae-gold-text">{formatGold(weeklySpecial.price)}</span>
                                            <span className="text-ae-ink-3 line-through">{formatGold(weeklySpecial.originalPrice)}</span>
                                        </div>
                                        <ShopEquipmentDecisionStrip player={player} item={weeklySpecial} scope="weekly" />
                                    </div>
                                </div>
                                {(() => {
                                    const canStore = inventoryHasRoom;
                                    const affordable = (player.gold ?? 0) >= (weeklySpecial.price ?? Infinity);
                                    const equipable = !isEquipmentItem(weeklySpecial) || !Array.isArray(weeklySpecial.jobs) || weeklySpecial.jobs.includes(player.job ?? '');
                                    const canBuy = canStore && affordable && equipable;
                                    const reason = !canStore ? '가방 가득' : !affordable ? '골드 부족' : !equipable ? '직업 제한' : null;
                                    return (
                                        <ActionButton
                                            onClick={() => actions?.market('buy', weeklySpecial, 'weekly')}
                                            disabled={!canBuy}
                                            title={!canBuy && reason ? reason : '구매'}
                                            label={canBuy ? '구매' : reason}
                                            className="aether-disabled-action min-h-[44px] min-w-11 shrink-0 px-3 text-[13px]"
                                        />
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}

                {shopMode === 'buy' && isMerchant ? null : shopMode === 'buy' ? (
                    buyItems.length > 0 ? (
                        <div className="ae-town-group">
                            {visibleBuyItems.map(({ item, price, affordable, equipable, inventoryHasRoom: canStore }) => {
                                const canBuy = affordable && equipable && canStore;
                                const comparison = getComparisonMeta(item, player);
                                const typeTag = getItemTags(item)[0];
                                const summary = getCompactItemSummary(item);
                                const comparisonText = getCompactComparisonText(comparison);
                                const blockReason = getBuyBlockReason({ canStore, affordable, equipable, item });

                                return (
                                    <div
                                        key={item.name}
                                        data-testid="shop-buy-item"
                                        data-shop-state={canBuy ? 'ready' : 'blocked'}
                                        className="ae-town-row grid grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-2.5 px-3 py-3"
                                    >
                                        <ItemIcon item={item} size={42} showBorder className="mt-0.5" />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <div className={`break-words font-readable text-[14px] font-semibold leading-tight ${getRarityTextClass(item)}`}>{item.name}</div>
                                                {typeTag && <Chip>{typeTag}</Chip>}
                                                {showDetails && Array.isArray(item.jobs) && item.jobs.includes(player.job ?? '') && isEquipmentItem(item) && (
                                                    <Chip tone="gold" className="font-bold" title={MSG.SHOP_SET_MATCH_TITLE(player.job ?? '')}>
                                                        {MSG.SHOP_SET_MATCH_CHIP}
                                                    </Chip>
                                                )}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <div data-testid="shop-buy-price" className="font-fira text-[13px] font-bold tabular-nums text-ae-gold-text">{formatGold(price)}</div>
                                                {!canBuy && blockReason && (
                                                    <div className="font-readable text-[12px] font-semibold text-ae-threat">{blockReason}</div>
                                                )}
                                            </div>
                                            {(!isEquipmentItem(item) || showDetails) && (
                                                <div className="mt-1 line-clamp-2 font-readable text-[12px] leading-[1.4] text-ae-ink-2">{summary}</div>
                                            )}
                                            <ShopEquipmentDecisionStrip player={player} item={item} scope="list" />
                                            {showDetails && comparison && (
                                                <div className="mt-1.5">
                                                    <div className={`aether-shop-delta inline-flex max-w-full items-center rounded-ae-xs px-2 py-1 font-readable text-[12px] leading-[1.3] ${getToneClass(comparison.tone)}`}>
                                                        <span className="break-words">{comparisonText}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <ActionButton
                                            data-testid="shop-buy-inline"
                                            onClick={() => {
                                                if (canBuy) actions?.market('buy', item, 'stock');
                                            }}
                                            disabled={!canBuy}
                                            icon={canBuy ? <ShoppingBag size={15} /> : undefined}
                                            label={canBuy ? '구매' : '불가'}
                                            className="aether-disabled-action min-h-[44px] min-w-11 px-3 text-[13px]"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="ae-sunk rounded-ae-md py-10 text-center font-readable text-[13px] text-ae-ink-2">
                            현재 지역에서 판매 중인 아이템이 없습니다.
                        </div>
                    )
                ) : (
                    sellItems.length > 0 ? (
                        <div className="ae-town-group">
                            {sellItems.map((item) => {
                                const isConfirming = sellConfirmId === item.id;
                                // 2026-10 Wave 62 (원장 §61.4 C16): 받는 판매가 — '빈손의 시작'이면 절반(판매 로그와 같은 `getSellIncome`).
                                const sellPrice = getSellIncome(player, item);
                                const comparison = getComparisonMeta(item, player);
                                const summary = getCompactItemSummary(item);
                                const comparisonText = comparison ? getCompactText(comparison.text) : '';
                                // Wave 28 (D4): 쓸 수 있는 유일한 서명 사본만 잠근다 — 판정은 리듀서와 같은 유틸이 소유한다.
                                const signatureVerdict = getSignatureSaleVerdict(item, player);
                                const isSignatureLocked = Boolean(signatureVerdict && !signatureVerdict.sellable);
                                const signatureSaleNote = signatureVerdict?.reason === 'duplicate'
                                    ? MSG.SIGNATURE_SELL_DUPLICATE
                                    : signatureVerdict?.reason === 'off-path' ? MSG.SIGNATURE_SELL_OFF_PATH : null;

                                return (
                                    <div
                                        key={item.id}
                                        data-testid="shop-sell-row"
                                        data-item-name={item.name}
                                        className={`ae-town-row flex flex-col px-3 py-3 transition-colors ${isConfirming ? 'bg-ae-threat/10' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-start gap-2.5">
                                                <ItemIcon item={item} size={38} showBorder className="mt-0.5" />
                                                <div className="min-w-0">
                                                    <div className={`break-words font-readable text-[15px] font-semibold ${getRarityTextClass(item)}`}>{item.name}</div>
                                                    <div data-testid="shop-sell-summary" className="mt-1 font-readable text-[12px] leading-snug text-ae-ink-2">{summary}</div>
                                                </div>
                                            </div>
                                            <span className="shrink-0 font-fira text-[14px] font-bold tabular-nums text-ae-gold-text">+{formatGold(sellPrice)}</span>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <Chip className="font-fira tabular-nums">등급 {item.tier || 1}</Chip>
                                            <Chip tone="gold" className="font-fira tabular-nums">
                                                판매가 {formatGold(sellPrice)}
                                            </Chip>
                                        </div>

                                        {comparison && (
                                            <div className={`aether-shop-delta mt-2 rounded-ae-xs px-2.5 py-2 font-readable text-[12px] ${getToneClass(comparison.tone)}`}>
                                                {comparisonText}
                                            </div>
                                        )}

                                        <div className="mt-2.5 flex items-center justify-between gap-3">
                                            <div
                                                className={`min-w-0 font-readable text-[12px] ${isConfirming ? 'font-semibold text-ae-threat' : 'text-ae-ink-2'}`}
                                                data-testid={signatureSaleNote ? `shop-sell-signature-note-${item.id}` : undefined}
                                            >
                                                {isSignatureLocked
                                                    ? MSG.SIGNATURE_SELL_LOCKED
                                                    : isConfirming ? '한 번 더 누르면 판매됩니다.' : (signatureSaleNote || '판매 대기')}
                                            </div>
                                            <ActionButton
                                                variant={isSignatureLocked ? 'ghost' : isConfirming ? 'danger' : 'ghost'}
                                                data-testid={isSignatureLocked ? 'shop-sell-locked' : undefined}
                                                disabled={isSignatureLocked}
                                                onClick={() => {
                                                    if (isSignatureLocked) return;
                                                    if (isConfirming) {
                                                        actions?.market('sell', item);
                                                        setSellConfirmId(null);
                                                        return;
                                                    }
                                                    setSellConfirmId(item.id);
                                                }}
                                                icon={isSignatureLocked ? <ShieldCheck size={15} /> : undefined}
                                                label={isSignatureLocked ? MSG.SIGNATURE_SELL_PROTECTED_BADGE : isConfirming ? '정말 판매' : '판매'}
                                                className="min-h-[44px] shrink-0 px-3.5 text-[13px]"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="ae-sunk rounded-ae-md py-10 text-center font-readable text-[13px] text-ae-ink-2">
                            판매할 수 있는 아이템이 없습니다.
                        </div>
                    )
                )}

                {shopMode === 'buy' && buyItems.length > visibleBuyItems.length && (
                    <ActionButton
                        variant="ghost"
                        onClick={() => setBuyItemsExpansion({ key: expansionKey, expanded: true })}
                        label={<>더 보기 (<span className="font-fira tabular-nums">{buyItems.length - visibleBuyItems.length}</span>개 남음)</>}
                        className="min-h-[44px] w-full text-[13px]"
                    />
                )}
            </div>

        </div>
    );
};

export default ShopPanel;
