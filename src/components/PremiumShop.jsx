import React from 'react';
import { X, Package, Shield, Zap, Star } from 'lucide-react';
import { PREMIUM_SHOP } from '../data/premiumShop';
import SignalBadge from './SignalBadge';

const ITEM_ICONS = {
    inv_expand: Package,
    synth_protect: Shield,
    revive: Zap,
};

const CrystalIcon = () => (
    <span className="text-cyan-300" aria-hidden="true">💎</span>
);

const PremiumShop = ({ player, onClose, onExpandInventory, onPurchaseSynthProtect, onPurchaseRevive, onPurchaseTitle }) => {
    const crystals = player?.premiumCurrency || 0;
    const ownedTitles = player?.stats?.cosmeticTitles || [];
    const maxInv = player?.maxInv || 20;

    const utilItems = [
        {
            ...PREMIUM_SHOP.invExpand,
            detail: `현재 ${maxInv}칸 → ${maxInv + 5}칸`,
            onBuy: onExpandInventory,
        },
        {
            ...PREMIUM_SHOP.synthProtect,
            detail: `보유: ${player?.stats?.synthProtects || 0}개`,
            onBuy: onPurchaseSynthProtect,
        },
        {
            ...PREMIUM_SHOP.revive,
            detail: `보유: ${player?.reviveTokens || 0}개`,
            onBuy: onPurchaseRevive,
        },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center md:items-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-sm panel-noise aether-surface rounded-t-[2rem] md:rounded-[1.8rem] px-4 py-5 space-y-4 max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-fira uppercase tracking-[0.2em] text-slate-500">에테르 크리스탈 상점</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <CrystalIcon />
                            <span className="text-[18px] font-rajdhani font-bold text-cyan-200">{crystals}</span>
                            <span className="text-[10px] font-fira text-slate-500">크리스탈 보유</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full border border-white/10 bg-black/20 p-1.5 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Utility items */}
                <div>
                    <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-slate-600 mb-2">유틸리티</div>
                    <div className="space-y-2">
                        {utilItems.map(item => {
                            const Icon = ITEM_ICONS[item.id] || Package;
                            const canAfford = crystals >= item.cost;
                            return (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-[1.1rem] border border-white/8 bg-black/18 px-3 py-2.5"
                                >
                                    <div className="shrink-0 rounded-[0.7rem] border border-cyan-400/20 bg-cyan-400/8 p-2 text-cyan-300">
                                        <Icon size={14} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] font-rajdhani font-bold text-white/90">{item.name}</div>
                                        <div className="text-[9px] font-fira text-slate-500">{item.desc}</div>
                                        <div className="text-[8px] font-fira text-slate-600 mt-0.5">{item.detail}</div>
                                    </div>
                                    <button
                                        onClick={() => canAfford && item.onBuy?.()}
                                        className={`shrink-0 flex items-center gap-1 rounded-[0.8rem] border px-2.5 py-1.5 text-[9px] font-fira transition-all ${
                                            canAfford
                                                ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-300 hover:bg-cyan-400/22'
                                                : 'border-white/8 bg-black/12 text-slate-600 cursor-not-allowed'
                                        }`}
                                    >
                                        <CrystalIcon />{item.cost}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Cosmetic titles */}
                <div>
                    <div className="text-[9px] font-fira uppercase tracking-[0.18em] text-slate-600 mb-2">코스메틱 칭호</div>
                    <div className="space-y-1.5">
                        {PREMIUM_SHOP.cosmeticTitles.map(title => {
                            const owned = ownedTitles.includes(title.id);
                            const canAfford = crystals >= title.cost;
                            return (
                                <div
                                    key={title.id}
                                    className="flex items-center justify-between gap-2 rounded-[1rem] border border-white/6 bg-black/12 px-3 py-2"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Star size={10} className="shrink-0 text-slate-500" />
                                        <span className="text-[10px] font-fira text-slate-300 truncate">[{title.name}]</span>
                                    </div>
                                    {owned ? (
                                        <SignalBadge tone="upgrade" size="sm">보유</SignalBadge>
                                    ) : (
                                        <button
                                            onClick={() => canAfford && onPurchaseTitle?.(title.id, title.name, title.cost)}
                                            className={`shrink-0 flex items-center gap-1 rounded-[0.7rem] border px-2 py-1 text-[8px] font-fira transition-all ${
                                                canAfford
                                                    ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-300 hover:bg-cyan-400/22'
                                                    : 'border-white/6 bg-black/10 text-slate-600 cursor-not-allowed'
                                            }`}
                                        >
                                            <CrystalIcon />{title.cost}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Free sources hint */}
                <div className="rounded-[0.95rem] border border-white/6 bg-black/12 px-3 py-2 text-[8px] font-fira text-slate-600 space-y-0.5">
                    <div className="text-slate-500 mb-1">무료 획득처</div>
                    <div>• 도감 마일스톤 달성 (+10~50 💎)</div>
                    <div>• 첫 보스 처치 (+10~30 💎)</div>
                    <div>• 프레스티지 시 (+20~50 💎)</div>
                </div>
            </div>
        </div>
    );
};

export default PremiumShop;
