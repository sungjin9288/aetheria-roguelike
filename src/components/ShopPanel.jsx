import React, { useState } from 'react';
import { BALANCE } from '../data/constants';
import { getEquipmentProfile, getItemStatText, getNextEquipmentState, isFocusOffhand, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';

const overlayPanelClass = 'fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:absolute md:inset-x-4 md:bottom-4 md:top-20';

const isEquipmentItem = (item) => ['weapon', 'armor', 'shield'].includes(item?.type);

const signedDelta = (value = 0, suffix = '') => `${value >= 0 ? '+' : ''}${value}${suffix}`;

const formatPercent = (value = 0) => `${value >= 0 ? '+' : ''}${value}%`;

const getItemTags = (item) => {
    const tags = [];
    if (isWeapon(item)) tags.push(item.hands === 2 ? '2H' : '1H');
    if (isFocusOffhand(item)) tags.push('주문서');
    else if (item?.type === 'shield') tags.push('방패');
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

const ShopPanel = ({ player, actions, shopItems, setGameState }) => {
    const [shopMode, setShopMode] = useState('buy');
    const [sellConfirmId, setSellConfirmId] = useState(null);
    const loc = player.loc;

    let maxTier = 1;
    if (loc === '사막 오아시스') maxTier = 2;
    if (loc === '북부 요새') maxTier = 4;

    const countOwned = (name) => player.inv.filter((entry) => entry.name === name).length;
    const canEquipNow = (item) => !isEquipmentItem(item) || !Array.isArray(item.jobs) || item.jobs.includes(player.job);

    const buyItems = [...shopItems]
        .filter((item) => (item.tier || 1) <= maxTier)
        .sort((a, b) => {
            const score = (item) => {
                const affordable = player.gold >= item.price ? 0 : 1;
                const usable = canEquipNow(item) ? 0 : 2;
                return affordable + usable;
            };
            return score(a) - score(b) || (a.price || 0) - (b.price || 0);
        });

    const sellItems = [...player.inv]
        .filter((item) => !String(item.id).startsWith('starter_'))
        .sort((a, b) => (a.price || 0) - (b.price || 0));

    return (
        <div className={`${overlayPanelClass} md:w-[min(48rem,78%)] lg:w-[min(58rem,74%)] bg-slate-900/95 z-20 p-3 md:p-5 rounded-xl border border-slate-700 flex flex-col shadow-[0_0_24px_rgba(15,23,42,0.45)] backdrop-blur-xl`}>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-xl md:text-2xl text-yellow-500 font-bold font-rajdhani tracking-wider">
                        MARKET NODE
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
                    <p className="text-xs text-slate-400 font-fira mt-2">
                        구매 전에 직업 제한, 장비 비교, 보유 수량을 먼저 확인하세요. 판매는 두 번 눌러 확정됩니다.
                    </p>
                </div>
                <div className="flex bg-slate-800 rounded-lg p-1 shrink-0 self-start">
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
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 auto-rows-[minmax(15rem,auto)] content-start gap-3 custom-scrollbar pr-1">
                {shopMode === 'buy' ? (
                    buyItems.length > 0 ? (
                        buyItems.map((item) => {
                            const affordable = player.gold >= item.price;
                            const equipable = canEquipNow(item);
                            const canBuy = affordable && equipable;
                            const ownedCount = countOwned(item.name);
                            const comparison = getComparisonMeta(item, player.equip);

                            return (
                                <div
                                            key={item.name}
                                    className={`flex flex-col rounded-xl border p-4 transition-all ${canBuy ? 'bg-slate-800/80 border-slate-600 hover:border-yellow-500/50 hover:shadow-[0_0_18px_rgba(234,179,8,0.12)]' : 'bg-slate-900/70 border-slate-700/80'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-100 font-rajdhani text-lg truncate">{item.name}</div>
                                            <div className="text-xs text-slate-400 font-fira mt-1 leading-relaxed">{getItemStatText(item) || item.desc}</div>
                                        </div>
                                        <span className="shrink-0 text-yellow-400 font-fira font-bold text-sm">{item.price} CR</span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-fira">
                                        <span className="px-2 py-1 rounded border border-slate-600/70 bg-slate-900/80 text-slate-300">T{item.tier || 1}</span>
                                        {ownedCount > 0 && (
                                            <span className="px-2 py-1 rounded border border-cyber-blue/20 bg-cyber-blue/10 text-cyber-blue">보유 {ownedCount}</span>
                                        )}
                                        {isEquipmentItem(item) && (
                                            <span className={`px-2 py-1 rounded border ${equipable ? 'border-cyber-green/20 bg-cyber-green/10 text-cyber-green' : 'border-red-500/30 bg-red-950/20 text-red-400'}`}>
                                                {equipable ? '현재 직업 사용 가능' : `${player.job} 장착 불가`}
                                            </span>
                                        )}
                                        {getItemTags(item).map((tag) => (
                                            <span key={`${item.name}_${tag}`} className="px-2 py-1 rounded border border-slate-600/60 bg-slate-900/70 text-slate-300">
                                                {tag}
                                            </span>
                                        ))}
                                        {item.elem && (
                                            <span className="px-2 py-1 rounded border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">{item.elem}</span>
                                        )}
                                    </div>

                                    {comparison && (
                                        <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] font-fira ${getToneClass(comparison.tone)}`}>
                                            {comparison.text}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-700/60 pt-3">
                                        <div className="text-[11px] font-fira text-slate-400">
                                            {!affordable ? '골드가 부족합니다.' : !equipable && isEquipmentItem(item) ? '현재 직업으로는 장착할 수 없습니다.' : '즉시 구매 가능'}
                                        </div>
                                        <button
                                            onClick={() => actions.market('buy', item)}
                                            disabled={!canBuy}
                                            className="min-h-[44px] rounded-lg border px-4 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 hover:border-yellow-400"
                                        >
                                            {!affordable ? '골드 부족' : !equipable && isEquipmentItem(item) ? '직업 제한' : '구매'}
                                        </button>
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

                            return (
                                <div
                                    key={item.id}
                                    className={`flex flex-col rounded-xl border p-4 transition-all ${isConfirming ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.12)]' : 'bg-slate-800/80 border-slate-600 hover:border-red-500/40'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-red-300 font-rajdhani text-lg truncate">{item.name}</div>
                                            <div className="text-xs text-slate-400 font-fira mt-1 leading-relaxed">{getItemStatText(item) || item.desc}</div>
                                        </div>
                                        <span className="shrink-0 text-yellow-400 font-fira font-bold text-sm">+{sellPrice} CR</span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-fira">
                                        <span className="px-2 py-1 rounded border border-slate-600/70 bg-slate-900/80 text-slate-300">T{item.tier || 1}</span>
                                        <span className="px-2 py-1 rounded border border-red-500/20 bg-red-950/20 text-red-300">
                                            판매가 {sellPrice} CR
                                        </span>
                                    </div>

                                    {comparison && (
                                        <div className={`mt-3 rounded-lg border px-3 py-2 text-[11px] font-fira ${getToneClass(comparison.tone)}`}>
                                            {comparison.text}
                                        </div>
                                    )}

                                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-700/60 pt-3">
                                        <div className="text-[11px] font-fira text-slate-400">
                                            {isConfirming ? '다시 누르면 판매가 확정됩니다.' : '판매는 돌이킬 수 없습니다.'}
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
                                            className={`min-h-[44px] rounded-lg border px-4 py-2 text-xs font-bold transition-all ${isConfirming ? 'border-red-400 bg-red-600/20 text-red-200 hover:bg-red-600/30' : 'border-red-500/40 text-red-300 hover:bg-red-500/10 hover:border-red-400'}`}
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

            <button
                onClick={() => setGameState('idle')}
                className="mt-4 w-full min-h-[44px] rounded-lg border border-slate-600 bg-slate-800 py-3 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
            >
                상점 닫기
            </button>
        </div>
    );
};

export default ShopPanel;
