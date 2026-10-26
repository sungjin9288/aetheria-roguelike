import { useMemo, useState } from 'react';
import { ChevronDown, CircleCheck, Lock } from 'lucide-react';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { getItemStatText } from '../../utils/equipmentUtils';
import { getItemRarity } from '../../utils/gameUtils';
import ItemIcon from '../icons/ItemIcon';
import EquipmentCodexCard from './EquipmentCodexCard';
import Gauge from '../ui/Gauge';
import type { CodexMilestone } from '../../utils/codexPresentation';
import type { CodexEntry, Item, Player } from '../../types/index.js';

type EquipmentCategory = 'weapons' | 'armors' | 'shields';

const CATEGORY_TABS: EquipmentCategory[] = ['weapons', 'armors', 'shields'];

interface WeaponCodexProps {
    codex?: Partial<Record<EquipmentCategory, Record<string, CodexEntry>>>;
    totalCounts?: Partial<Record<EquipmentCategory, number>>;
    discoveredCounts?: Partial<Record<EquipmentCategory, number>>;
    progress?: { milestones: CodexMilestone[] };
    player?: Player | null;
}

const WeaponCodex = ({ codex = {}, totalCounts = {}, discoveredCounts = {}, progress, player }: WeaponCodexProps) => {
    const [category, setCategory] = useState<EquipmentCategory>('weapons');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const items = useMemo(() => {
        if (category === 'weapons') return DB.ITEMS.weapons || [];
        if (category === 'armors') return (DB.ITEMS.armors || []).filter((item) => item.type === 'armor');
        return (DB.ITEMS.armors || []).filter((item) => item.type === 'shield');
    }, [category]);

    const categoryCodex = codex[category] || {};
    const grouped = useMemo(() => {
        const groups = new Map<number, Item[]>();
        for (const item of items) {
            const tier = item.tier || 1;
            groups.set(tier, [...(groups.get(tier) || []), item]);
        }
        return [...groups.entries()].sort(([left], [right]) => left - right);
    }, [items]);

    const milestones = (progress?.milestones || []).filter((milestone) => milestone.category === category);
    const nextMilestone = milestones.find((milestone) => !milestone.claimed) || milestones[milestones.length - 1];
    const selected = selectedItem ? items.find((item) => item.name === selectedItem) : null;

    return (
        <div data-testid="codex-equipment" className="ab-stack">
            <div className="ab-segment grid-cols-3" role="tablist" aria-label={MSG.CODEX_EQUIP_KIND_ARIA}>
                {CATEGORY_TABS.map((tabId) => {
                    const active = category === tabId;
                    return (
                        <button
                            key={tabId}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            data-testid={`codex-equipment-category-${tabId}`}
                            onClick={() => {
                                setCategory(tabId);
                                setSelectedItem(null);
                            }}
                            className="ab-segment-option px-2"
                        >
                            {MSG.CODEX_EQUIP_KIND_LABELS[tabId]}{' '}
                            <span className="font-fira tabular-nums">{discoveredCounts[tabId] || 0}/{totalCounts[tabId] || 0}</span>
                        </button>
                    );
                })}
            </div>

            {nextMilestone && (
                <div data-testid="codex-equipment-next-reward" className="ae-well px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                        <div>
                            <div className="aether-type-meta text-ae-ink-3">{MSG.CODEX_EQUIP_NEXT_REWARD}</div>
                            <div className="aether-type-body mt-0.5 font-semibold text-ae-ink">{nextMilestone.label}</div>
                        </div>
                        <span className="aether-type-body shrink-0 font-fira tabular-nums text-ae-ether-hi">
                            {Math.min(discoveredCounts[category] || 0, nextMilestone.count)}/{nextMilestone.count}
                        </span>
                    </div>
                    {nextMilestone.reached && !nextMilestone.claimed && (
                        <div className="aether-type-meta mt-1 text-ae-gold-text">{MSG.CODEX_EQUIP_CLAIM_ABOVE}</div>
                    )}
                </div>
            )}

            {selected && <EquipmentCodexCard item={selected} player={player} />}

            <div className="ae-card is-quiet ab-rows px-3.5">
                {grouped.map(([tier, tierItems]) => {
                    const discovered = tierItems.filter((item) => categoryCodex[item.name ?? '']).length;
                    const tierRarity = MSG.RARITY_LABEL[getItemRarity(tierItems[0])] || MSG.RARITY_LABEL.common;

                    return (
                        <details
                            key={`${category}-${tier}`}
                            data-testid={`codex-equipment-tier-${tier}`}
                            className="group"
                        >
                            <summary className="ab-summary min-h-14">
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-baseline justify-between gap-3">
                                        <span className="aether-type-body font-semibold text-ae-ink">
                                            {MSG.CODEX_EQUIP_TIER(tier, tierRarity)}
                                        </span>
                                        <span className="aether-type-meta shrink-0 font-fira tabular-nums text-ae-ink-3">
                                            {discovered}/{tierItems.length}
                                        </span>
                                    </span>
                                    <Gauge
                                        kind="ether"
                                        value={discovered}
                                        max={Math.max(1, tierItems.length)}
                                        label={MSG.CODEX_EQUIP_TIER(tier, tierRarity)}
                                        className="ab-gauge-thin mt-1.5"
                                    />
                                </span>
                                <ChevronDown size={16} className="ab-chevron" aria-hidden="true" />
                            </summary>

                            <div className="grid grid-cols-2 gap-1.5 pb-3">
                                {tierItems.map((item) => {
                                    const found = Boolean(categoryCodex[item.name ?? '']);
                                    const active = selectedItem === item.name;
                                    if (!found) {
                                        return (
                                            <div key={item.name} className="ab-tile is-undiscovered flex min-h-[60px] items-center gap-2 p-2.5 aether-type-meta">
                                                <Lock size={14} className="shrink-0" aria-hidden="true" />
                                                {MSG.CODEX_EQUIP_UNDISCOVERED}
                                            </div>
                                        );
                                    }
                                    return (
                                        <button
                                            key={item.name}
                                            type="button"
                                            aria-pressed={active}
                                            data-testid={`codex-equipment-item-${item.name}`}
                                            onClick={() => setSelectedItem(active ? null : (item.name ?? null))}
                                            className={`ab-tile ab-rar-${getItemRarity(item)} min-h-[60px] p-2.5 text-left`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <ItemIcon item={item} size={28} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="aether-type-body font-semibold text-ae-ink">{item.name}</div>
                                                    <div className="aether-type-meta mt-0.5 text-ae-ink-3">
                                                        {getItemStatText(item)}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </details>
                    );
                })}
            </div>

            {milestones.length > 0 && milestones.every((milestone) => milestone.claimed) && (
                <div className="aether-type-body flex min-h-11 items-center gap-2 text-ae-good">
                    <CircleCheck size={16} aria-hidden="true" /> {MSG.CODEX_EQUIP_ALL_CLAIMED}
                </div>
            )}
        </div>
    );
};

export default WeaponCodex;
