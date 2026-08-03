import { useMemo, useState } from 'react';
import { ChevronDown, CircleCheck, Lock } from 'lucide-react';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { getItemStatText } from '../../utils/equipmentUtils';
import { getItemRarity } from '../../utils/gameUtils';
import ItemIcon from '../icons/ItemIcon';
import EquipmentCodexCard from './EquipmentCodexCard';

const RARITY_BORDER: Record<string, string> = {
    common: 'border-slate-500/30',
    uncommon: 'border-emerald-400/40',
    rare: 'border-blue-400/40',
    epic: 'border-purple-400/40',
    legendary: 'border-amber-400/50',
};

const RARITY_BG: Record<string, string> = {
    common: 'bg-slate-500/8',
    uncommon: 'bg-emerald-400/8',
    rare: 'bg-blue-400/8',
    epic: 'bg-purple-400/8',
    legendary: 'bg-amber-400/10',
};

type EquipmentCategory = 'weapons' | 'armors' | 'shields';

const CATEGORY_TABS: Array<{ id: EquipmentCategory; label: string }> = [
    { id: 'weapons', label: '무기' },
    { id: 'armors', label: '방어구' },
    { id: 'shields', label: '방패' },
];

interface WeaponCodexProps {
    codex?: any;
    totalCounts?: any;
    discoveredCounts?: any;
    progress?: any;
    player?: any;
}

const WeaponCodex = ({ codex = {}, totalCounts = {}, discoveredCounts = {}, progress, player }: WeaponCodexProps) => {
    const [category, setCategory] = useState<EquipmentCategory>('weapons');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const items = useMemo(() => {
        if (category === 'weapons') return DB.ITEMS.weapons || [];
        if (category === 'armors') return (DB.ITEMS.armors || []).filter((item: any) => item.type === 'armor');
        return (DB.ITEMS.armors || []).filter((item: any) => item.type === 'shield');
    }, [category]);

    const categoryCodex = codex[category] || {};
    const grouped = useMemo(() => {
        const groups = new Map<number, any[]>();
        for (const item of items) {
            const tier = item.tier || 1;
            groups.set(tier, [...(groups.get(tier) || []), item]);
        }
        return [...groups.entries()].sort(([left], [right]) => left - right);
    }, [items]);

    const milestones = (progress?.milestones || []).filter((milestone: any) => milestone.category === category);
    const nextMilestone = milestones.find((milestone: any) => !milestone.claimed) || milestones[milestones.length - 1];
    const selected = selectedItem ? items.find((item: any) => item.name === selectedItem) : null;

    return (
        <div data-testid="codex-equipment" className="space-y-4">
            <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="장비 종류">
                {CATEGORY_TABS.map((tab) => {
                    const active = category === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            data-testid={`codex-equipment-category-${tab.id}`}
                            onClick={() => {
                                setCategory(tab.id);
                                setSelectedItem(null);
                            }}
                            className={`min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors ${
                                active
                                    ? 'border-[#7dd4d8]/38 bg-[#7dd4d8]/12 text-slate-100'
                                    : 'border-white/8 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {tab.label} {discoveredCounts[tab.id] || 0}/{totalCounts[tab.id] || 0}
                        </button>
                    );
                })}
            </div>

            {nextMilestone && (
                <div data-testid="codex-equipment-next-reward" className="border-y border-white/10 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                        <div>
                            <div className="aether-type-meta text-slate-400/76">다음 장비 수집 보상</div>
                            <div className="aether-type-body mt-0.5 font-semibold text-slate-100">{nextMilestone.label}</div>
                        </div>
                        <span className="aether-type-body shrink-0 text-[#dff7f5]">
                            {Math.min(discoveredCounts[category] || 0, nextMilestone.count)}/{nextMilestone.count}
                        </span>
                    </div>
                    {nextMilestone.reached && !nextMilestone.claimed && (
                        <div className="aether-type-meta mt-1 text-[#d5b180]">상단에서 보상을 받을 수 있습니다</div>
                    )}
                </div>
            )}

            {selected && <EquipmentCodexCard item={selected} player={player} />}

            <div className="divide-y divide-white/10 border-y border-white/10">
                {grouped.map(([tier, tierItems]) => {
                    const discovered = tierItems.filter((item) => categoryCodex[item.name]).length;
                    const tierPct = (discovered / Math.max(1, tierItems.length)) * 100;

                    return (
                        <details
                            key={`${category}-${tier}`}
                            data-testid={`codex-equipment-tier-${tier}`}
                            className="group"
                        >
                            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="aether-type-body font-semibold text-slate-100">
                                            {tier}단계 · {MSG.RARITY_LABEL[getItemRarity(tierItems[0])] || '일반'}
                                        </span>
                                        <span className="aether-type-meta shrink-0 text-slate-400/76">
                                            {discovered}/{tierItems.length}
                                        </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                                        <div className="h-full rounded-full bg-[#7dd4d8]" style={{ width: `${tierPct}%` }} />
                                    </div>
                                </div>
                                <ChevronDown size={16} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                            </summary>

                            <div className="grid grid-cols-2 gap-1.5 pb-3">
                                {tierItems.map((item: any) => {
                                    const found = Boolean(categoryCodex[item.name]);
                                    const itemRarity = getItemRarity(item);
                                    const active = selectedItem === item.name;
                                    return (
                                        <button
                                            key={item.name}
                                            type="button"
                                            disabled={!found}
                                            data-testid={found ? `codex-equipment-item-${item.name}` : undefined}
                                            onClick={() => setSelectedItem(active ? null : item.name)}
                                            className={`min-h-[60px] rounded-lg border p-2.5 text-left transition-colors ${
                                                found
                                                    ? `${RARITY_BORDER[itemRarity]} ${RARITY_BG[itemRarity]} hover:brightness-125`
                                                    : 'cursor-default border-white/6 bg-black/10 text-slate-500'
                                            } ${active ? 'ring-1 ring-[#7dd4d8]/50' : ''}`}
                                        >
                                            {found ? (
                                                <div className="flex items-start gap-2">
                                                    <ItemIcon item={item} size={28} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-sm font-semibold text-slate-100">{item.name}</div>
                                                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400/76">
                                                            {getItemStatText(item)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-[11px]">
                                                    <Lock size={14} className="shrink-0 text-slate-600" />
                                                    미발견 장비
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </details>
                    );
                })}
            </div>

            {milestones.length > 0 && milestones.every((milestone: any) => milestone.claimed) && (
                <div className="flex min-h-11 items-center gap-2 text-sm text-emerald-200">
                    <CircleCheck size={16} /> 모든 장비 수집 보상을 받았습니다
                </div>
            )}
        </div>
    );
};

export default WeaponCodex;
