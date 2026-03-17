import React, { useMemo, useState } from 'react';
import { BALANCE } from '../data/constants';
import { getEquipmentProfile, getItemStatText, getNextEquipmentState, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';
import { getTraitItemResonance, getTraitProfile } from '../utils/runProfileUtils';

const getOverlayPanelClass = (mobile) => (
    mobile
        ? 'fixed inset-x-0 bottom-0 top-auto h-[min(76dvh,42rem)] rounded-t-[1.75rem] rounded-b-none border-t'
        : 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+0.8rem)] bottom-[calc(env(safe-area-inset-bottom)+0.9rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-4'
);

const isEquipmentItem = (item) => ['weapon', 'armor', 'shield'].includes(item?.type);

const signedDelta = (value = 0, suffix = '') => `${value >= 0 ? '+' : ''}${value}${suffix}`;

const formatPercent = (value = 0) => `${value >= 0 ? '+' : ''}${value}%`;

const getItemTags = (item) => {
    const tags = [];
    if (isWeapon(item)) tags.push(isTwoHandWeapon(item) ? '2H' : '1H');
    return tags;
};

const getComparisonMeta = (item, equip = {}) => {
    if (!item) return null;
    const currentProfile = getEquipmentProfile(equip);
    const nextEquip = getNextEquipmentState(equip, item);
    const nextProfile = getEquipmentProfile(nextEquip);
    const atkDelta = (nextProfile.mainAttack + nextProfile.offhandAttack) - (currentProfile.mainAttack + currentProfile.offhandAttack);
    const defDelta = ((nextEquip.armor?.val || 0) + nextProfile.shieldDef) - ((equip.armor?.val || 0) + currentProfile.shieldDef);
    const critDelta = Math.round((nextProfile.critBonus - currentProfile.critBonus) * 100);
    const mpDelta = nextProfile.mpBonus - currentProfile.mpBonus;

    if (item.type === 'armor' || item.type === 'shield' || item.type === 'weapon') {
        const deltas = [];
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

const getToneClass = (tone) => {
    if (tone === 'positive') return 'text-cyber-green border-cyber-green/30 bg-cyber-green/10';
    if (tone === 'negative') return 'text-red-400 border-red-500/30 bg-red-950/20';
    return 'text-cyber-blue/80 border-cyber-blue/20 bg-cyber-blue/5';
};

const getCompactText = (value = '') => value.replaceAll(' / ', ' · ');

const getCompactComparisonText = (comparison) => (
    getCompactText(comparison?.text || '').replace('현재 장비와 동일한 효율', '변화 없음')
);

const getCompactItemSummary = (item) => {
    const summary = getCompactText(getItemStatText(item) || item.desc || '');
    if (!isWeapon(item)) return summary;
    return summary.replace(/^(연계|파쇄)\s[12]H\s·\s/, '');
};

const ShopPanel = ({ player, actions, shopItems, setGameState, stats = null, mobile = false }) => {
    const [shopMode, setShopMode] = useState('buy');
    const [sellConfirmId, setSellConfirmId] = useState(null);
    const loc = player.loc;

    let maxTier = 1;
    if (loc === '사막 오아시스') maxTier = 2;
    if (loc === '북부 요새') maxTier = 4;

    const traitProfile = useMemo(
        () => getTraitProfile(player, stats || { maxHp: player.maxHp, maxMp: player.maxMp }),
        [player, stats]
    );

    const canEquipNow = (item) => !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(player.job);
    const getResonance = (item) => getTraitItemResonance(item, traitProfile, player);

    const buyItems = [...shopItems]
        .filter((item) => (item.tier || 1) <= maxTier)
        .sort((a, b) => {
            const score = (item) => {
                const affordable = player.gold >= item.price ? 0 : 1;
                const usable = canEquipNow(item) ? 0 : 2;
                return affordable + usable;
            };
            return score(a) - score(b)
                || (getResonance(b).score - getResonance(a).score)
                || (a.price || 0) - (b.price || 0);
        });
    const sellItems = [...player.inv]
        .filter((item) => !String(item.id).startsWith('starter_'))
        .sort((a, b) => (a.price || 0) - (b.price || 0));

    return (
        <div className={`${getOverlayPanelClass(mobile)} panel-noise ${mobile ? '' : 'md:w-[min(48rem,78%)] lg:w-[min(58rem,74%)] rounded-[1.6rem]'} bg-[linear-gradient(180deg,rgba(7,13,25,0.97)_0%,rgba(4,9,18,0.98)_100%)] z-20 p-3 md:p-5 border border-cyan-400/16 flex flex-col shadow-[0_28px_70px_rgba(2,8,20,0.5)] backdrop-blur-2xl`}>
            <div className={`flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4 ${mobile ? 'sticky top-0 z-10 -mx-3 px-3 pb-3 pt-1 bg-[linear-gradient(180deg,rgba(7,13,25,0.99)_0%,rgba(7,13,25,0.96)_100%)] border-b border-cyan-400/12' : ''}`}>
                <div>
                    <h2 className="text-xl md:text-2xl text-yellow-500 font-bold font-rajdhani tracking-wider">
                        SHOP
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-fira">
                        <span className="px-2 py-1 rounded border border-yellow-500/20 bg-yellow-500/10 text-yellow-300">
                            위치: {loc}
                        </span>
                        <span className="px-2 py-1 rounded border border-cyber-blue/20 bg-cyber-blue/10 text-cyber-blue">
                            상점 등급 T{maxTier}
                        </span>
                        <span className="px-2 py-1 rounded border border-cyber-green/20 bg-cyber-green/10 text-cyber-green">
                            골드 {player.gold} CR
                        </span>
                        <span className="px-2 py-1 rounded border border-slate-600/60 bg-slate-800/80 text-slate-300">
                            인벤 {player.inv.length}/{BALANCE.INV_MAX_SIZE}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <div className="flex bg-slate-800 rounded-lg p-1 shrink-0">
                        <button
                            onClick={() => {
                                setShopMode('buy');
                                setSellConfirmId(null);
                            }}
                            className={`px-4 py-2 text-xs rounded-md font-bold transition-colors ${shopMode === 'buy' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            구매
                        </button>
                        <button
                            onClick={() => {
                                setShopMode('sell');
                                setSellConfirmId(null);
                            }}
                            className={`px-4 py-2 text-xs rounded-md font-bold transition-colors ${shopMode === 'sell' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            판매
                        </button>
                    </div>
                    <button
                        data-testid="shop-close"
                        onClick={() => setGameState('idle')}
                        className="min-h-[40px] rounded-full border border-slate-600 bg-slate-800/90 px-3 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-200 transition-colors hover:bg-slate-700"
                    >
                        닫기
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 auto-rows-[minmax(6.15rem,auto)] content-start gap-2.5 custom-scrollbar pr-1">
                {shopMode === 'buy' ? (
                    buyItems.length > 0 ? (
                        buyItems.map((item) => {
                            const affordable = player.gold >= item.price;
                            const equipable = canEquipNow(item);
                            const canBuy = affordable && equipable;
                            const comparison = getComparisonMeta(item, player.equip);
                            const typeTag = getItemTags(item)[0];
                            const summary = getCompactItemSummary(item);
                            const comparisonText = getCompactComparisonText(comparison);

                            return (
                                <div
                                    key={item.name}
                                    data-testid="shop-buy-item"
                                    className={`flex flex-col rounded-xl border px-3 py-2 transition-all ${canBuy ? 'bg-slate-800/80 hover:border-yellow-500/50 hover:shadow-[0_0_18px_rgba(234,179,8,0.12)]' : 'bg-slate-900/70 border-slate-700/80'} border-slate-600`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className="truncate font-bold text-slate-100 font-rajdhani text-[1.05rem] leading-none">{item.name}</div>
                                                {typeTag && (
                                                    <span className="shrink-0 rounded border border-cyan-400/16 bg-cyan-400/8 px-1.5 py-0.5 text-[9px] font-fira text-cyan-200">
                                                        {typeTag}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 truncate text-[10px] leading-none text-slate-400 font-fira">
                                                {summary}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                            <div className="text-[11px] font-fira font-bold text-yellow-300">{item.price} CR</div>
                                            {mobile && (
                                                <button
                                                    data-testid="shop-buy-inline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!canBuy) return;
                                                        actions.market('buy', item);
                                                    }}
                                                    disabled={!canBuy}
                                                    className="min-h-[32px] rounded-md border border-yellow-500/40 px-2.5 py-1 text-[10px] font-bold text-yellow-300 transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:bg-yellow-500/10 hover:border-yellow-400"
                                                >
                                                    {!affordable ? '골드 부족' : !equipable && isEquipmentItem(item) ? '직업 제한' : '구매'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {comparison && (
                                        <div className={`mt-1.5 rounded-md border px-2 py-1 text-[10px] font-fira leading-none ${getToneClass(comparison.tone)}`}>
                                            <div className="truncate">
                                                대비 {comparisonText}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-1.5 flex items-center justify-end gap-3">
                                        {!mobile && (
                                            <button
                                                onClick={() => actions.market('buy', item)}
                                                disabled={!canBuy}
                                                className="min-h-[40px] rounded-lg border px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 hover:border-yellow-400"
                                            >
                                                {!affordable ? '골드 부족' : !equipable && isEquipmentItem(item) ? '직업 제한' : '구매'}
                                            </button>
                                        )}
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
                        sellItems.map((item) => {
                            const isConfirming = sellConfirmId === item.id;
                            const sellPrice = Math.floor((item.price || 0) * 0.5);
                            const comparison = getComparisonMeta(item, player.equip);
                            const summary = getCompactItemSummary(item);
                            const comparisonText = comparison ? getCompactText(comparison.text) : '';

                            return (
                                <div
                                    key={item.id}
                                    className={`flex flex-col rounded-xl border px-3 py-3 transition-all ${isConfirming ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.12)]' : 'bg-slate-800/80 border-slate-600 hover:border-red-500/40'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-red-300 font-rajdhani text-base truncate">{item.name}</div>
                                            <div className="mt-1 text-[11px] text-slate-400 font-fira truncate">{summary}</div>
                                        </div>
                                        <span className="shrink-0 text-yellow-400 font-fira font-bold text-sm">+{sellPrice} CR</span>
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
                                            {isConfirming ? '한 번 더 누르면 판매됩니다.' : '판매 대기'}
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (isConfirming) {
                                                    actions.market('sell', item);
                                                    setSellConfirmId(null);
                                                    return;
                                                }
                                                setSellConfirmId(item.id);
                                            }}
                                            className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-bold transition-all ${isConfirming ? 'border-red-400 bg-red-600/20 text-red-200 hover:bg-red-600/30' : 'border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-400'}`}
                                        >
                                            {isConfirming ? '정말 판매' : '판매'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-slate-500 py-10 font-rajdhani border border-dashed border-slate-700 rounded-xl">
                            판매할 수 있는 아이템이 없습니다.
                        </div>
                    )
                )}
            </div>

            {!mobile && (
                <button
                    data-testid="shop-close-footer"
                    onClick={() => setGameState('idle')}
                    className="mt-4 w-full min-h-[44px] rounded-lg border border-slate-600 bg-slate-800 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
                >
                    상점 닫기
                </button>
            )}
        </div>
    );
};

export default ShopPanel;
