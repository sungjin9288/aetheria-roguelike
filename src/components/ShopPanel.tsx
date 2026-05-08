import { useEffect, useMemo, useState } from 'react';
import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { getEquipmentProfile, getItemStatText, getNextEquipmentState, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';
import { getDailyDeals, getWeeklySpecial } from '../utils/shopRotation';
import FocusPanelHeader from './FocusPanelHeader';
import ItemIcon from './icons/ItemIcon';
import { isSignatureItem } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';

interface ShopPanelProps {
    player: Player;
    actions?: any;
    shopItems?: any[];
    setGameState?: (state: string) => void;
    stats?: any;
    mobileFocused?: boolean;
    onOpenArchiveConsole?: any;
}

/** 맵 레벨을 기준으로 상점 최대 아이템 티어 계산 */
const getShopMaxTier = (loc: string) => {
    const mapData = DB.MAPS?.[loc] || {};
    const mapLevel = typeof mapData.level === 'number' ? mapData.level : 1;
    const isSafe = mapData.type === 'safe';
    const tierFromLevel = mapLevel < 10 ? 1 : mapLevel < 20 ? 2 : mapLevel < 30 ? 3 : mapLevel < 40 ? 4 : mapLevel < 50 ? 5 : 6;
    const safeBonus = (isSafe && mapLevel > 1) ? 1 : 0;   // 시작의 마을 제외하고 safe 맵 +1
    const shopBonus = mapData.shopBonus ? 1 : 0;           // 황금 왕국 등 프리미엄 상점 +1
    return Math.min(6, tierFromLevel + safeBonus + shopBonus);
};

const getOverlayPanelClass = () => (
    'fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.65rem)] bottom-0 rounded-t-[1.75rem] rounded-b-none border-t'
);

const isEquipmentItem = (item: any) => ['weapon', 'armor', 'shield'].includes(item?.type);

const signedDelta = (value: any = 0, suffix: any = '') => `${value >= 0 ? '+' : ''}${value}${suffix}`;

const formatPercent = (value: any = 0) => `${value >= 0 ? '+' : ''}${value}%`;

const getItemTags = (item: any) => {
    const tags: any[] = [];
    if (isWeapon(item)) tags.push(isTwoHandWeapon(item) ? '2H' : '1H');
    return tags;
};

const getComparisonMeta = (item: any, equip: any = {}) => {
    if (!item) return null;
    const currentProfile = getEquipmentProfile(equip);
    const nextEquip = getNextEquipmentState(equip, item);
    const nextProfile = getEquipmentProfile(nextEquip);
    const atkDelta = (nextProfile.mainAttack + nextProfile.offhandAttack) - (currentProfile.mainAttack + currentProfile.offhandAttack);
    const defDelta = ((nextEquip.armor?.val || 0) + nextProfile.shieldDef) - ((equip.armor?.val || 0) + currentProfile.shieldDef);
    const critDelta = Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100);
    const mpDelta = nextProfile.mpBonus - currentProfile.mpBonus;

    if (item.type === 'armor' || item.type === 'shield' || item.type === 'weapon') {
        const deltas: any[] = [];
        if (atkDelta !== 0) deltas.push(`ATK ${signedDelta(atkDelta)}`);
        if (defDelta !== 0) deltas.push(`DEF ${signedDelta(defDelta)}`);
        if (critDelta !== 0) deltas.push(`CRIT ${formatPercent(critDelta)}`);
        if (mpDelta !== 0) deltas.push(`MP ${signedDelta(mpDelta)}`);
        if (!deltas.length) deltas.push('현재 장비와 동일한 효율');

        const score = atkDelta + defDelta + (critDelta * 2) + Math.floor(mpDelta / 5);
        const replacedOffhand = item.type === 'weapon' && isTwoHandWeapon(item) && equip.offhand;

        return {
            text: `${deltas.join(' / ')}${replacedOffhand ? ' / 보조손 해제' : ''}`,
            tone: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
        };
    }

    if (item.type === 'hp') return { text: `HP ${item.val || 0} 회복`, tone: 'positive' };
    if (item.type === 'mp') return { text: `MP ${item.val || 0} 회복`, tone: 'positive' };
    if (item.type === 'cure') return { text: `${item.effect || '상태이상'} 해제`, tone: 'neutral' };
    if (item.type === 'buff') return { text: `${item.turn || 0}턴 버프`, tone: 'positive' };

    return null;
};

const getToneClass = (tone: any) => {
    if (tone === 'positive') return 'text-[#dff7f5] border-[#7dd4d8]/24 bg-[#7dd4d8]/10';
    if (tone === 'negative') return 'text-rose-100 border-rose-300/24 bg-rose-400/10';
    return 'text-slate-300 border-white/8 bg-white/[0.03]';
};

const getCompactText = (value: any = '') => value.replaceAll(' / ', ' · ');

const getCompactComparisonText = (comparison: any) => (
    getCompactText(comparison?.text || '').replace('현재 장비와 동일한 효율', '변화 없음')
);

const getCompactItemSummary = (item: any) => {
    const summary = getCompactText(getItemStatText(item) || item.desc || '');
    if (!isWeapon(item)) return summary;
    return summary.replace(/^(연계|파쇄)\s[12]H\s·\s/, '');
};

const MOBILE_INITIAL_BUY_LIMIT = 12;

const ShopPanel = ({ player, actions, shopItems, setGameState, stats = null, mobileFocused = false, onOpenArchiveConsole = null }: ShopPanelProps) => {
    const [shopMode, setShopMode] = useState('buy');
    const [sellConfirmId, setSellConfirmId] = useState<any>(null);
    const [buyItemsExpansion, setBuyItemsExpansion] = useState({ key: '', expanded: false });
    const [purchaseNotice, setPurchaseNotice] = useState('');
    const loc = player.loc || '';
    const expansionKey = `${loc}:${shopMode}`;

    const maxTier = getShopMaxTier(loc);

    const traitProfile = useMemo(
        () => getTraitProfile(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player, stats]
    );

    const currentJob = player.job;
    const currentGold = player.gold ?? 0;
    const inventoryHasRoom = (player.inv?.length || 0) < (player.maxInv || BALANCE.INV_MAX_SIZE);
    const buyItemsExpanded = buyItemsExpansion.key === expansionKey && buyItemsExpansion.expanded;

    useEffect(() => {
        if (!purchaseNotice) return undefined;
        const timer = window.setTimeout(() => setPurchaseNotice(''), 1800);
        return () => window.clearTimeout(timer);
    }, [purchaseNotice]);

    const buyItems = useMemo(() => {
        return (shopItems || [])
            .filter((item: any) => (item.tier || 1) <= maxTier)
            .map((item: any) => {
                const affordable = currentGold >= item.price;
                const equipable = !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(currentJob);
                const resonance = getTraitItemResonance(item, traitProfile, { job: currentJob });
                return {
                    item,
                    affordable,
                    equipable,
                    inventoryHasRoom,
                    priorityScore: (affordable ? 0 : 1) + (equipable ? 0 : 2),
                    resonanceScore: resonance.score,
                };
            })
            .sort((a: any, b: any) => (
                a.priorityScore - b.priorityScore
                || b.resonanceScore - a.resonanceScore
                || (a.item.price || 0) - (b.item.price || 0)
            ));
    }, [shopItems, maxTier, currentGold, currentJob, traitProfile, inventoryHasRoom]);

    const visibleBuyItems = useMemo(() => {
        if (buyItemsExpanded) return buyItems;
        return buyItems.slice(0, MOBILE_INITIAL_BUY_LIMIT);
    }, [buyItems, buyItemsExpanded]);

    const sellItems = useMemo(() => (
        [...(player.inv || [])]
            .filter((item: any) => !String(item.id).startsWith('starter_'))
            .sort((a: any, b: any) => (a.price || 0) - (b.price || 0))
    ), [player.inv]);

    const dailyDeals = useMemo(() => getDailyDeals(player.level || 1), [player.level]);
    const weeklySpecial = useMemo(() => getWeeklySpecial(player.level || 1), [player.level]);

    return (
        <div className={`${mobileFocused ? 'panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] p-3' : `${getOverlayPanelClass()} panel-noise aether-surface-strong`} z-20 flex flex-col overflow-hidden p-3`}>
            <FocusPanelHeader
                eyebrow="Broker Ledger"
                title="MARKET"
                titleClassName="text-[1.1rem] leading-none"
                meta={`${loc} · T${maxTier} · ${(player.inv || []).length}/${player.maxInv || BALANCE.INV_MAX_SIZE}`}
                onBack={() => setGameState?.('idle')}
                backLabel="복귀"
                backTestId="shop-close"
                onOpenArchive={onOpenArchiveConsole}
                archiveLabel="INV"
                archiveTestId="shop-open-archive"
            />

            {purchaseNotice && (
                <div className="mb-2 rounded-[1rem] border border-emerald-300/22 bg-emerald-400/10 px-3 py-2 text-[11px] font-fira font-semibold text-emerald-100">
                    구매 완료 · {purchaseNotice}
                </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400/74">
                    {shopMode === 'buy' ? '구매 후보를 빠르게 비교합니다.' : '판매 확정 전 한 번 더 확인합니다.'}
                </div>
                <div className="flex shrink-0 rounded-full border border-white/8 bg-black/20 p-0.5">
                    <button
                        onClick={() => {
                            setShopMode('buy');
                            setSellConfirmId(null);
                        }}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${shopMode === 'buy' ? 'bg-[#d5b180]/18 text-[#f6e7c8]' : 'text-slate-400 hover:text-white'}`}
                    >
                        구매
                    </button>
                    <button
                        onClick={() => {
                            setShopMode('sell');
                            setSellConfirmId(null);
                        }}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${shopMode === 'sell' ? 'bg-rose-400/16 text-rose-100' : 'text-slate-400 hover:text-white'}`}
                    >
                        판매
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                {/* Daily Deals + Weekly Special */}
                {shopMode === 'buy' && (dailyDeals.items.length > 0 || weeklySpecial) && (
                    <div className="mb-2 space-y-2 border-b border-white/8 pb-2">
                        <div className="text-[10px] font-fira uppercase tracking-[0.2em] text-amber-300/70">Daily Deals — 10% OFF</div>
                        <div className="grid grid-cols-1 gap-2">
                            {dailyDeals.items.map((item: any) => {
                                const canStore = inventoryHasRoom;
                                const affordable = (player.gold ?? 0) >= item.price;
                                const equipable = !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(player.job);
                                const canBuy = canStore && affordable && equipable;
                                const reason = !canStore ? '가방 가득' : !affordable ? '골드 부족' : !equipable ? '직업 제한' : null;
                                return (
                                    <div key={item.name} className="flex items-center justify-between gap-2 rounded-[1.1rem] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,rgba(213,177,128,0.12),transparent_24%),linear-gradient(180deg,rgba(47,33,15,0.24)_0%,rgba(18,12,8,0.12)_100%)] px-3 py-2.5">
                                        <div className="min-w-0 flex items-center gap-2">
                                            <ItemIcon item={item} size={34} showBorder className="opacity-95" />
                                            <div className="min-w-0">
                                                <div className="text-xs font-rajdhani font-bold text-white truncate">{item.name}</div>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    <span className="text-[10px] font-fira text-amber-300 font-bold">{item.price} CR</span>
                                                    <span className="text-[9px] font-fira text-slate-500 line-through">{item.originalPrice}</span>
                                                </div>
                                                {!canBuy && reason && (
                                                    <div className="mt-0.5 text-[9px] font-fira text-rose-300/85">{reason}</div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                actions.market('buy', item);
                                                setPurchaseNotice(item.name);
                                            }}
                                            disabled={!canBuy}
                                            title={!canBuy && reason ? reason : '구매'}
                                            className="shrink-0 min-h-[32px] rounded-full border border-amber-400/30 px-2.5 py-1 text-[10px] font-bold text-amber-300 transition-all disabled:opacity-30 hover:bg-amber-400/10"
                                        >
                                            {canBuy ? '구매' : reason}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        {weeklySpecial && (
                            <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-purple-400/25 bg-[radial-gradient(circle_at_82%_12%,rgba(154,138,192,0.16),transparent_22%),linear-gradient(180deg,rgba(33,22,46,0.24)_0%,rgba(16,10,20,0.12)_100%)] px-3 py-2.75">
                                <div className="min-w-0 flex items-center gap-2.5">
                                    <ItemIcon item={weeklySpecial} size={38} showBorder className="opacity-95" />
                                    <div className="min-w-0">
                                        <div className="mb-0.5 text-[9px] font-fira uppercase tracking-wider text-purple-300/60">Weekly Special — 15% OFF</div>
                                        <div className="text-sm font-rajdhani font-bold text-white truncate">{weeklySpecial.name}</div>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            <span className="text-[11px] font-fira text-purple-300 font-bold">{weeklySpecial.price} CR</span>
                                            <span className="text-[9px] font-fira text-slate-500 line-through">{weeklySpecial.originalPrice}</span>
                                        </div>
                                    </div>
                                </div>
                                {(() => {
                                    const canStore = inventoryHasRoom;
                                    const affordable = (player.gold ?? 0) >= weeklySpecial.price;
                                    const equipable = !isEquipmentItem(weeklySpecial) || !Array.isArray(weeklySpecial.jobs) || weeklySpecial.jobs.includes(player.job);
                                    const canBuy = canStore && affordable && equipable;
                                    const reason = !canStore ? '가방 가득' : !affordable ? '골드 부족' : !equipable ? '직업 제한' : null;
                                    return (
                                        <button
                                            onClick={() => {
                                                actions.market('buy', weeklySpecial);
                                                setPurchaseNotice(weeklySpecial.name);
                                            }}
                                            disabled={!canBuy}
                                            title={!canBuy && reason ? reason : '구매'}
                                            className="shrink-0 min-h-[36px] rounded-full border border-purple-400/30 px-4 py-1.5 text-xs font-bold text-purple-300 transition-all disabled:opacity-30 hover:bg-purple-400/10"
                                        >
                                            {canBuy ? '구매' : reason}
                                        </button>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}

                {shopMode === 'buy' ? (
                    buyItems.length > 0 ? (
                        visibleBuyItems.map(({ item, affordable, equipable, inventoryHasRoom: canStore }: any) => {
                            const canBuy = affordable && equipable && canStore;
                            const comparison = getComparisonMeta(item, player.equip);
                            const typeTag = getItemTags(item)[0];
                            const summary = getCompactItemSummary(item);
                            const comparisonText = getCompactComparisonText(comparison);

                            return (
                                <div
                                    key={item.name}
                                    data-testid="shop-buy-item"
                                    className={`overflow-hidden rounded-[1.2rem] border px-3 py-2.5 transition-all ${canBuy ? 'aether-panel-muted hover:border-[#d5b180]/22 hover:bg-[#d5b180]/8 hover:shadow-[0_18px_28px_rgba(213,177,128,0.08)]' : 'bg-black/14 border-white/8'} border-white/8`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex flex-1 items-start gap-2.5">
                                            <ItemIcon item={item} size={40} showBorder className="mt-0.5 opacity-95" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <div className="truncate font-bold text-slate-100 font-rajdhani text-[1rem] leading-tight">{item.name}</div>
                                                    {typeTag && (
                                                        <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-fira text-slate-300/85">
                                                            {typeTag}
                                                        </span>
                                                    )}
                                                    {Array.isArray(item.jobs) && item.jobs.includes(player.job) && ['weapon', 'armor', 'shield'].includes(item.type) && (
                                                        <span
                                                            title={`${player.job} 세트 매치 — 같은 직업 호환 장비를 모으면 세트 효과 발동`}
                                                            className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-fira font-bold uppercase tracking-[0.1em]"
                                                            style={{
                                                                color: '#d5b180',
                                                                border: '1px solid rgba(213,177,128,0.42)',
                                                                background: 'rgba(213,177,128,0.10)',
                                                            }}
                                                        >
                                                            ⚔ 세트
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-[10px] font-fira leading-[1.35] text-slate-400">{summary}</div>
                                                {comparison && (
                                                    <div className="mt-1">
                                                        <div className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-fira leading-[1.2] ${getToneClass(comparison.tone)}`}>
                                                            <span className="truncate">{comparisonText}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <div className="text-[11px] font-fira font-bold text-[#f6e7c8]">{item.price} CR</div>
                                            <button
                                                data-testid="shop-buy-inline"
                                                onClick={() => {
                                                    if (!canBuy) return;
                                                    actions.market('buy', item);
                                                    setPurchaseNotice(item.name);
                                                }}
                                                disabled={!canBuy}
                                                className="min-h-[34px] rounded-full border border-[#d5b180]/24 px-2.5 py-1 text-[10px] font-bold text-[#f6e7c8] transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#d5b180]/10 hover:border-[#d5b180]/30"
                                            >
                                                {!canStore ? '가방 가득' : !affordable ? '골드 부족' : !equipable && isEquipmentItem(item) ? '직업 제한' : '구매'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-slate-500 py-10 font-rajdhani border border-dashed border-slate-700 rounded-xl">
                            현재 지역에서 판매 중인 아이템이 없습니다.
                        </div>
                    )
                ) : (
                    sellItems.length > 0 ? (
                        sellItems.map((item: any) => {
                            const isConfirming = sellConfirmId === item.id;
                            const sellPrice = Math.floor((item.price || 0) * 0.5);
                            const comparison = getComparisonMeta(item, player.equip);
                            const summary = getCompactItemSummary(item);
                            const comparisonText = comparison ? getCompactText(comparison.text) : '';
                            const isSignatureLocked = isSignatureItem(item);

                            return (
                                <div
                                    key={item.id}
                                    className={`flex flex-col rounded-[1.3rem] border px-3 py-3 transition-all ${isConfirming ? 'bg-rose-400/10 border-rose-300/24 shadow-[0_18px_28px_rgba(251,113,133,0.08)]' : 'aether-panel-muted hover:border-rose-300/18'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex items-start gap-2.5">
                                            <ItemIcon item={item} size={38} showBorder className="mt-0.5 opacity-95" />
                                            <div className="min-w-0">
                                                <div className="font-bold text-red-300 font-rajdhani text-base truncate">{item.name}</div>
                                                <div className="mt-1 text-[11px] text-slate-400 font-fira truncate">{summary}</div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-[#f6e7c8] font-fira font-bold text-sm">+{sellPrice} CR</span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-fira">
                                        <span className="px-2 py-1 rounded border border-slate-600/70 bg-slate-900/80 text-slate-300">T{item.tier || 1}</span>
                                        <span className="px-2 py-1 rounded border border-red-500/20 bg-red-950/20 text-red-300">
                                            판매가 {sellPrice} CR
                                        </span>
                                    </div>

                                    {comparison && (
                                        <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[10px] font-fira ${getToneClass(comparison.tone)}`}>
                                            {comparisonText}
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-700/60 pt-2.5">
                                        <div className="text-[10px] font-fira text-slate-400">
                                            {isSignatureLocked
                                                ? '전설 각인 — 판매 불가'
                                                : isConfirming ? '한 번 더 누르면 판매됩니다.' : '판매 대기'}
                                        </div>
                                        <button
                                            type="button"
                                            data-testid={isSignatureLocked ? 'shop-sell-locked' : undefined}
                                            disabled={isSignatureLocked}
                                            onClick={() => {
                                                if (isSignatureLocked) return;
                                                if (isConfirming) {
                                                    actions.market('sell', item);
                                                    setSellConfirmId(null);
                                                    return;
                                                }
                                                setSellConfirmId(item.id);
                                            }}
                                            className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-bold transition-all ${isSignatureLocked
                                                ? 'border-[#f6e7a2]/35 bg-[#f6e7a2]/10 text-[#f6e7a2]/80 cursor-not-allowed'
                                                : isConfirming
                                                    ? 'border-red-400 bg-red-600/20 text-red-200 hover:bg-red-600/30'
                                                    : 'border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-400'}`}
                                        >
                                            {isSignatureLocked ? '✦ 보호됨' : isConfirming ? '정말 판매' : '판매'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full rounded-[1.2rem] border border-dashed border-white/8 py-10 text-center font-rajdhani text-slate-500">
                            판매할 수 있는 아이템이 없습니다.
                        </div>
                    )
                )}

                {shopMode === 'buy' && buyItems.length > visibleBuyItems.length && (
                    <button
                        type="button"
                        onClick={() => setBuyItemsExpansion({ key: expansionKey, expanded: true })}
                        className="min-h-[44px] w-full rounded-[1.05rem] border border-white/8 bg-black/18 px-4 py-3 text-[11px] font-fira uppercase tracking-[0.16em] text-slate-200 transition-colors hover:bg-white/[0.05]"
                    >
                        더 보기 ({buyItems.length - visibleBuyItems.length}개 남음)
                    </button>
                )}
            </div>

        </div>
    );
};

export default ShopPanel;
