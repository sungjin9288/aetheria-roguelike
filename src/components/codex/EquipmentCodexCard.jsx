import React from 'react';
import { motion as Motion } from 'framer-motion';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getItemRarity } from '../../utils/gameUtils';
import ItemIcon from '../icons/ItemIcon';
import SignalBadge from '../SignalBadge';

const RARITY_FRAME = {
    common: { border: '#9ca3af', glow: 'none', corner: false },
    uncommon: { border: '#22c55e', glow: 'none', corner: true },
    rare: { border: '#3b82f6', glow: '0 0 8px rgba(59,130,246,0.3)', corner: true },
    epic: { border: '#a855f7', glow: '0 0 12px rgba(168,85,247,0.35)', corner: true },
    legendary: { border: '#f59e0b', glow: '0 0 16px rgba(245,158,11,0.4)', corner: true },
};

const RARITY_TONE = {
    common: 'neutral',
    uncommon: 'success',
    rare: 'recommended',
    epic: 'resonance',
    legendary: 'upgrade',
};

/**
 * SVG 코너 장식
 */
const CornerOrnament = ({ color, position }) => {
    const transforms = {
        'top-left': '',
        'top-right': 'scale(-1,1) translate(-24,0)',
        'bottom-left': 'scale(1,-1) translate(0,-24)',
        'bottom-right': 'scale(-1,-1) translate(-24,-24)',
    };
    const posClass = {
        'top-left': 'top-0 left-0',
        'top-right': 'top-0 right-0',
        'bottom-left': 'bottom-0 left-0',
        'bottom-right': 'bottom-0 right-0',
    };

    return (
        <svg
            className={`absolute ${posClass[position]} pointer-events-none`}
            width="16" height="16" viewBox="0 0 24 24"
        >
            <g transform={transforms[position]}>
                <path d="M2 8V2h6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
                <circle cx="2" cy="2" r="1.5" fill={color} opacity="0.5" />
            </g>
        </svg>
    );
};

const StatRow = ({ label, value, compareValue }) => {
    const diff = compareValue != null ? value - compareValue : null;
    return (
        <div className="flex items-center justify-between text-[10px] font-fira">
            <span className="text-slate-500">{label}</span>
            <div className="flex items-center gap-1.5">
                <span className="text-slate-200">{value}</span>
                {diff != null && diff !== 0 && (
                    <span className={diff > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * EquipmentCodexCard — 레어리티별 프레임 + 스탯 비교 레이아웃
 */
const EquipmentCodexCard = ({ item, player }) => {
    if (!item) return null;

    const rarity = getItemRarity(item);
    const frame = RARITY_FRAME[rarity] || RARITY_FRAME.common;
    const tone = RARITY_TONE[rarity] || 'neutral';

    // 장착 중인 같은 슬롯 아이템 찾기
    const equipped = item.type === 'weapon'
        ? player?.equipment?.weapon
        : item.type === 'armor'
            ? player?.equipment?.armor
            : item.type === 'shield'
                ? player?.equipment?.shield
                : null;

    return (
        <Motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-[1.05rem] p-3 space-y-2.5 overflow-hidden"
            style={{
                border: `1.5px solid ${frame.border}40`,
                background: `${frame.border}08`,
                boxShadow: frame.glow,
            }}
        >
            {/* 코너 장식 */}
            {frame.corner && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
                <CornerOrnament key={pos} color={frame.border} position={pos} />
            ))}

            {/* 헤더 */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <ItemIcon item={item} size={32} showBorder />
                    <div className="min-w-0">
                        <div className="text-[13px] font-rajdhani font-bold text-white truncate">{item.name}</div>
                        <div className="text-[9px] font-fira text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                </div>
                <SignalBadge tone={tone} size="sm">
                    {MSG.RARITY_LABEL?.[rarity] || rarity}
                </SignalBadge>
            </div>

            {/* 스탯 */}
            <div className="space-y-1 rounded-[0.85rem] border border-white/6 bg-black/16 px-2.5 py-2">
                <div className="text-[9px] font-fira uppercase tracking-[0.14em] text-slate-500 mb-1.5">
                    {MSG.EQUIP_STAT_COMPARE}
                    {equipped && <span className="ml-1.5 normal-case text-slate-600">vs {equipped.name}</span>}
                </div>
                {item.atk != null && (
                    <StatRow label="ATK" value={item.atk} compareValue={equipped?.atk} />
                )}
                {item.def != null && (
                    <StatRow label="DEF" value={item.def} compareValue={equipped?.def} />
                )}
                {item.hp != null && (
                    <StatRow label="HP" value={item.hp} compareValue={equipped?.hp} />
                )}
                {item.mp != null && (
                    <StatRow label="MP" value={item.mp} compareValue={equipped?.mp} />
                )}
            </div>

            {/* 추가 정보 */}
            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira">
                {item.elem && (
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/8 px-2 py-0.5 text-amber-200">
                        {item.elem}
                    </span>
                )}
                {item.hands === 2 && (
                    <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-slate-300">
                        양손
                    </span>
                )}
                {item.jobs && (
                    <span className="text-slate-500">
                        {item.jobs.join(' · ')}
                    </span>
                )}
            </div>

            {/* 가격 */}
            <div className="text-[10px] font-fira text-slate-500 text-right">
                {item.price}G
            </div>
        </Motion.div>
    );
};

export default EquipmentCodexCard;
