import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, Star } from 'lucide-react';
import { QuickSlotAssigner } from './QuickSlot';

/**
 * EquipCompare — 장비 비교 미리보기 (ATK/DEF 증감)
 */
const StatDiff = ({ val, label }) => {
    if (val === 0) return <span className="text-cyber-blue/30 text-xs">{label} ±0</span>;
    const up = val > 0;
    return (
        <span className={`text-xs font-bold flex items-center gap-0.5 ${up ? 'text-cyber-green' : 'text-red-400'}`}>
            {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
            {label} {up ? '+' : ''}{val}
        </span>
    );
};

/**
 * SmartInventory — 인벤토리 스마트 필터 + 장비 비교 (시나리오 2)
 */
const FILTERS = [
    { id: 'all', label: '전체' },
    { id: 'weapon', label: '무기' },
    { id: 'armor', label: '방어구' },
    { id: 'shield', label: '보조' },
    { id: 'hp', label: '회복' },
    { id: 'material', label: '재료' },
];

const ITEM_TYPE_TO_FILTER = {
    weapon: 'weapon',
    armor: 'armor',
    shield: 'shield',
    hp: 'hp',
    mp: 'hp',
    buff: 'hp',
    cure: 'hp',
    mat: 'material',
};

const SmartInventory = ({ player, actions, quickSlots = [null, null, null], onAssignQuickSlot }) => {
    const [activeFilter, setActiveFilter] = React.useState('all');
    const [hoveredItem, setHoveredItem] = React.useState(null);

    const grouped = useMemo(() => {
        const map = {};
        for (const item of player.inv) {
            if (!map[item.name]) map[item.name] = { item, count: 0 };
            map[item.name].count++;
        }
        return Object.values(map);
    }, [player.inv]);

    const filtered = useMemo(() => {
        if (activeFilter === 'all') return grouped;
        return grouped.filter(({ item }) => {
            const f = ITEM_TYPE_TO_FILTER[item.type] || item.type;
            return f === activeFilter;
        });
    }, [grouped, activeFilter]);

    // 추천 장착 계산 (최고 val 기준)
    const bestWeapon = useMemo(() =>
        player.inv
            .filter(i => i.type === 'weapon')
            .sort((a, b) => (b.val || 0) - (a.val || 0))[0],
        [player.inv]
    );
    const bestArmor = useMemo(() =>
        player.inv
            .filter(i => i.type === 'armor')
            .sort((a, b) => (b.val || 0) - (a.val || 0))[0],
        [player.inv]
    );

    const getCompareDiff = (item) => {
        if (!item) return null;
        if (item.type === 'weapon') {
            const cur = player.equip?.weapon?.val || 0;
            return { atk: (item.val || 0) - cur, def: 0 };
        }
        if (item.type === 'armor') {
            const cur = player.equip?.armor?.val || 0;
            return { atk: 0, def: (item.val || 0) - cur };
        }
        if (item.type === 'shield') {
            const cur = player.equip?.offhand?.val || 0;
            return { atk: 0, def: (item.val || 0) - cur };
        }
        return null;
    };

    const handleSmartEquip = () => {
        if (bestWeapon && bestWeapon.val > (player.equip?.weapon?.val || 0)) actions.useItem(bestWeapon);
        if (bestArmor && bestArmor.val > (player.equip?.armor?.val || 0)) actions.useItem(bestArmor);
    };

    return (
        <div className="space-y-3">
            {/* Filter Bar */}
            <div className="flex gap-1 flex-wrap">
                {FILTERS.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id)}
                        className={`text-xs px-2.5 py-1 rounded border font-rajdhani font-bold transition-all min-h-[32px]
                            ${activeFilter === f.id
                                ? 'bg-cyber-blue/20 border-cyber-blue/60 text-cyber-blue'
                                : 'bg-cyber-dark/30 border-cyber-blue/10 text-cyber-blue/40 hover:border-cyber-blue/30'
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
                        className="ml-auto text-xs px-2.5 py-1 rounded border border-cyber-green/40 bg-cyber-green/10 text-cyber-green font-rajdhani font-bold flex items-center gap-1 min-h-[32px] hover:bg-cyber-green/20 transition-all"
                        title="최적 장비 자동 장착"
                    >
                        <Star size={11} /> 추천 장착
                    </Motion.button>
                )}
            </div>

            {/* Item List */}
            <div className="space-y-1.5">
                {filtered.length === 0 && (
                    <div className="text-cyber-blue/30 text-center py-6 text-sm font-rajdhani tracking-widest">
                        해당 카테고리의 아이템이 없습니다
                    </div>
                )}
                {filtered.map(({ item, count }, i) => {
                    const diff = getCompareDiff(item);
                    const isCurrentEquip =
                        player.equip?.weapon?.name === item.name ||
                        player.equip?.armor?.name === item.name ||
                        player.equip?.offhand?.name === item.name;

                    return (
                        <Motion.div
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onMouseEnter={() => setHoveredItem(item.name)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`bg-cyber-dark/40 p-3 rounded-sm border flex justify-between items-center group transition-all cursor-pointer min-h-[50px]
                                ${isCurrentEquip ? 'border-cyber-green/40 bg-cyber-green/5' : 'border-cyber-blue/10 hover:border-cyber-green/50 hover:bg-cyber-green/5'}`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-sm font-fira ${item.tier >= 2 ? 'text-cyber-purple drop-shadow-sm' : 'text-cyber-blue/80'}`}>
                                        {item.name}
                                    </span>
                                    {count > 1 && <span className="text-cyber-blue/30 text-xs">x{count}</span>}
                                    {isCurrentEquip && <span className="text-cyber-green text-xs border border-cyber-green/30 px-1 rounded font-fira">장착 중</span>}
                                </div>

                                {/* Compare diff (on hover or always for equip items) */}
                                {diff && (hoveredItem === item.name || isCurrentEquip) && (
                                    <div className="flex gap-2 mt-1">
                                        {diff.atk !== 0 && <StatDiff val={diff.atk} label="ATK" />}
                                        {diff.def !== 0 && <StatDiff val={diff.def} label="DEF" />}
                                        {diff.atk === 0 && diff.def === 0 && <Minus size={11} className="text-cyber-blue/30" />}
                                    </div>
                                )}
                                {item.desc_stat && (
                                    <div className="text-cyber-blue/30 text-xs font-fira mt-0.5 truncate">{item.desc_stat}</div>
                                )}
                                {onAssignQuickSlot && (
                                    <QuickSlotAssigner
                                        item={item}
                                        currentSlots={quickSlots}
                                        onAssign={onAssignQuickSlot}
                                    />
                                )}
                            </div>
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => actions.useItem(item)}
                                className="text-xs bg-cyber-blue/10 hover:bg-cyber-blue/30 text-cyber-blue px-3 py-2 rounded border border-cyber-blue/30 font-bold min-h-[40px] ml-2 shrink-0"
                            >
                                {['weapon', 'armor', 'shield'].includes(item.type) ? (isCurrentEquip ? '장착됨' : '장착') : '사용'}
                            </Motion.button>
                        </Motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default SmartInventory;
