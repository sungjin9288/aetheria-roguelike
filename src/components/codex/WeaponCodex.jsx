import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getItemRarity } from '../../utils/gameUtils';
import SignalBadge from '../SignalBadge';
import ItemIcon from '../icons/ItemIcon';

const RARITY_BORDER = {
    common: 'border-slate-500/30',
    uncommon: 'border-emerald-400/40',
    rare: 'border-blue-400/40',
    epic: 'border-purple-400/40',
    legendary: 'border-amber-400/50',
};

const RARITY_BG = {
    common: 'bg-slate-500/8',
    uncommon: 'bg-emerald-400/8',
    rare: 'bg-blue-400/8',
    epic: 'bg-purple-400/8',
    legendary: 'bg-amber-400/10',
};

const CATEGORY_TABS = [
    { id: 'weapons', label: 'WEAPONS' },
    { id: 'armors', label: 'ARMORS' },
    { id: 'shields', label: 'SHIELDS' },
];

const WeaponCodex = ({ codex, totalCounts, discoveredCounts, progress }) => {
    const [category, setCategory] = useState('weapons');
    const [selectedItem, setSelectedItem] = useState(null);

    const items = useMemo(() => {
        if (category === 'weapons') return DB.ITEMS.weapons || [];
        if (category === 'armors') return (DB.ITEMS.armors || []).filter(a => a.type === 'armor');
        if (category === 'shields') return (DB.ITEMS.armors || []).filter(a => a.type === 'shield');
        return [];
    }, [category]);

    const catCodex = codex[category] || {};

    // 티어별 그룹핑
    const grouped = useMemo(() => {
        const groups = {};
        items.forEach(item => {
            const tier = item.tier || 1;
            if (!groups[tier]) groups[tier] = [];
            groups[tier].push(item);
        });
        return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
    }, [items]);

    // 마일스톤 보상 (해당 카테고리)
    const milestones = progress.milestones.filter(ms => ms.category === category);

    return (
        <div className="space-y-2">
            {/* Category toggle */}
            <div className="flex gap-1">
                {CATEGORY_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setCategory(tab.id); setSelectedItem(null); }}
                        className={`flex-1 text-[9px] font-fira uppercase tracking-wider py-1 rounded-md border transition-all
                            ${category === tab.id
                                ? 'bg-white/8 border-white/20 text-white'
                                : 'border-white/6 text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        {tab.label} ({discoveredCounts[tab.id]}/{totalCounts[tab.id]})
                    </button>
                ))}
            </div>

            {/* Item Grid by Tier */}
            <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar">
                {grouped.map(([tier, tierItems]) => (
                    <div key={tier}>
                        <div className="text-[9px] font-fira text-slate-500 uppercase tracking-wider mb-1.5">
                            Tier {tier} — {MSG.RARITY_LABEL[getItemRarity(tierItems[0])] || '일반'}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {tierItems.map(item => {
                                const found = !!catCodex[item.name];
                                const rarity = getItemRarity(item);
                                return (
                                    <button
                                        key={item.name}
                                        onClick={() => found && setSelectedItem(selectedItem === item.name ? null : item.name)}
                                        className={`p-2 rounded-lg border text-left transition-all text-[10px]
                                            ${found
                                                ? `${RARITY_BORDER[rarity]} ${RARITY_BG[rarity]} hover:brightness-125`
                                                : 'border-white/6 bg-black/10 opacity-25 cursor-default'
                                            }
                                            ${selectedItem === item.name ? 'ring-1 ring-cyber-blue/50' : ''}
                                        `}
                                    >
                                        {found ? (
                                            <div className="flex items-start gap-1.5">
                                                <ItemIcon item={item} size={22} />
                                                <div className="min-w-0">
                                                    <div className="font-rajdhani font-bold text-white truncate text-[10px]">{item.name}</div>
                                                    <div className="text-[8px] font-fira text-slate-400 mt-0.5">{item.desc_stat}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <Lock size={10} className="text-slate-600" />
                                                <div className="font-rajdhani font-bold text-slate-600 text-[10px]">???</div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Panel */}
            {selectedItem && (() => {
                const item = items.find(i => i.name === selectedItem);
                if (!item) return null;
                const rarity = getItemRarity(item);
                return (
                    <div className={`rounded-[0.95rem] border ${RARITY_BORDER[rarity]} ${RARITY_BG[rarity]} p-3 space-y-1.5`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ItemIcon item={item} size={28} showBorder />
                                <span className="font-rajdhani font-bold text-sm text-white">{item.name}</span>
                            </div>
                            <SignalBadge tone={rarity === 'legendary' ? 'danger' : rarity === 'epic' ? 'caution' : 'neutral'} size="sm">
                                {MSG.RARITY_LABEL[rarity]}
                            </SignalBadge>
                        </div>
                        <div className="text-[10px] font-fira text-slate-400">{item.desc}</div>
                        <div className="text-[10px] font-fira text-cyber-blue">{item.desc_stat}</div>
                        {item.elem && <div className="text-[10px] font-fira text-amber-300">속성: {item.elem}</div>}
                        {item.jobs && (
                            <div className="text-[10px] font-fira text-slate-500">
                                착용: {item.jobs.join(', ')}
                            </div>
                        )}
                        <div className="text-[10px] font-fira text-slate-500">가격: {item.price}G</div>
                    </div>
                );
            })()}

            {/* Milestones */}
            {milestones.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[9px] font-fira text-slate-500 uppercase tracking-wider">Milestones</div>
                    {milestones.map(ms => (
                        <div
                            key={ms.id}
                            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[10px] font-fira
                                ${ms.reached && !ms.claimed
                                    ? 'border-cyber-green/30 bg-cyber-green/8 text-cyber-green'
                                    : ms.claimed
                                        ? 'border-white/8 bg-black/10 text-slate-500 line-through'
                                        : 'border-white/6 bg-black/10 text-slate-500'
                                }`}
                        >
                            <span>{ms.label} ({ms.count}개)</span>
                            {ms.reached && !ms.claimed && <span>수령 가능</span>}
                            {ms.claimed && <span>수령 완료</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WeaponCodex;
