import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { User, Package, Scroll, Shield, Zap, Sword, Map, Trophy, BookOpen, BarChart3, Eye } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import { isFocusOffhand, isShield, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils';
import SmartInventory from './SmartInventory';
import AchievementPanel from './AchievementPanel';
import SkillTreePreview from './SkillTreePreview';
import MapNavigator from './MapNavigator';
import StatsPanel from './StatsPanel';
import Bestiary from './Bestiary';
import QuestTab from './tabs/QuestTab';
import SystemTab from './tabs/SystemTab';

const BAR_THEMES = {
    hp: {
        border: 'border-red-500/30',
        fill: 'bg-gradient-to-r from-red-500/50 to-red-500',
        shadow: 'shadow-[0_0_10px_rgba(239,68,68,0.5)]'
    },
    mp: {
        border: 'border-blue-500/30',
        fill: 'bg-gradient-to-r from-blue-500/50 to-blue-500',
        shadow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]'
    },
    exp: {
        border: 'border-purple-500/30',
        fill: 'bg-gradient-to-r from-purple-500/50 to-purple-500',
        shadow: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]'
    }
};

const TAB_ITEMS = [
    { id: 'inventory', icon: Package, label: 'Inventory' },
    { id: 'quest', icon: Scroll, label: 'Quest' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
    { id: 'skills', icon: BookOpen, label: 'Skills' },
    { id: 'map', icon: Map, label: 'Map' },
    { id: 'stats', icon: BarChart3, label: 'Stats' },
    { id: 'bestiary', icon: Eye, label: 'Bestiary' },
    { id: 'system', icon: Zap, label: 'System' }
];

const ProgressBar = ({ value, max, variant = 'hp', label, showMeta = true }) => {
    const theme = BAR_THEMES[variant] || BAR_THEMES.hp;
    const safeMax = Math.max(1, max || 1);
    const safeValue = Math.max(0, value || 0);
    const percentage = Math.min(100, (safeValue / safeMax) * 100);

    return (
        <div className="relative w-full">
            {showMeta && (
                <div className="flex justify-between text-[10px] uppercase font-bold mb-0.5 text-cyber-blue/70">
                    <span>{label}</span>
                    <span>{safeValue}/{safeMax}</span>
                </div>
            )}
            <div className={`w-full ${showMeta ? 'h-2' : 'h-1.5'} bg-cyber-dark/50 rounded-sm overflow-hidden border ${theme.border} relative`}>
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full ${theme.fill} ${theme.shadow}`}
                ></Motion.div>
            </div>
        </div>
    );
};

const InlineMetric = ({ label, value, max, variant }) => (
    <div className="flex items-center gap-2 min-w-[8.5rem]">
        <span className="w-9 shrink-0 text-[10px] text-cyber-blue/45 uppercase tracking-widest text-right">
            {label}
        </span>
        <div className="flex-1 min-w-[4.5rem]">
            <ProgressBar value={value} max={max} variant={variant} label={label} showMeta={false} />
        </div>
        <span className="w-16 shrink-0 text-[10px] text-cyber-blue font-bold text-right">
            {value || 0}/{Math.max(1, max || 1)}
        </span>
    </div>
);

const getEquipmentTag = (item, slot = 'main') => {
    if (!item) return slot === 'armor' ? '빈 슬롯' : '미장착';
    if (slot === 'armor') return 'ARM';
    if (isWeapon(item)) return isTwoHandWeapon(item) ? '2H' : '1H';
    if (isFocusOffhand(item)) return 'SCROLL';
    if (isShield(item)) return 'SHD';
    return 'EQ';
};

const EquipmentSlot = ({ label, item, slot = 'main', fallback, icon }) => {
    const SlotIcon = icon;

    return (
        <div className="rounded-md border border-cyber-blue/15 bg-cyber-dark/35 px-2 py-2 min-w-0 shadow-[inset_0_0_14px_rgba(0,204,255,0.03)]">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                    <div className="w-7 h-7 shrink-0 rounded border border-cyber-blue/20 bg-cyber-black/70 flex items-center justify-center text-cyber-blue/70">
                        <SlotIcon size={13} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] font-fira text-cyber-blue/45 uppercase tracking-[0.2em]">
                            {label}
                        </div>
                        <div className="truncate text-[11px] font-fira text-white mt-0.5">
                            {item?.name || fallback}
                        </div>
                    </div>
                </div>
                <span className="shrink-0 text-[10px] font-fira text-cyber-purple">
                    {getEquipmentTag(item, slot)}
                </span>
            </div>
        </div>
    );
};

// Animation variants for tab content
const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false, quickSlots = [null, null, null] }) => {
    const [statusCollapsed, setStatusCollapsed] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';

    const renderTabContent = () => {
        return (
            <AnimatePresence mode="wait">
                <Motion.div
                    key={sideTab}
                    variants={tabVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-2 pr-1"
                >
                    {sideTab === 'inventory' && (
                        <SmartInventory
                            player={player}
                            actions={actions}
                            quickSlots={quickSlots}
                            onAssignQuickSlot={(index, item) => actions.setQuickSlot?.(index, item)}
                        />
                    )}

                    {sideTab === 'quest' && (
                        <QuestTab player={player} actions={actions} isInSafeZone={isInSafeZone} />
                    )}

                    {sideTab === 'achievements' && (
                        <AchievementPanel player={player} actions={actions} />
                    )}

                    {sideTab === 'skills' && (
                        <SkillTreePreview player={player} />
                    )}

                    {sideTab === 'map' && (
                        <MapNavigator
                            player={player}
                        />
                    )}

                    {sideTab === 'stats' && (
                        <StatsPanel player={player} />
                    )}

                    {sideTab === 'bestiary' && (
                        <Bestiary player={player} />
                    )}

                    {sideTab === 'system' && (
                        <SystemTab player={player} actions={actions} stats={stats} />
                    )}
                </Motion.div>
            </AnimatePresence>
        );
    };

    if (mobile) {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:hidden mt-2 bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg p-4 space-y-4 shadow-[0_0_20px_rgba(0,204,255,0.15)] relative z-10"
            >
                {/* Mobile Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-cyber-green font-rajdhani font-bold text-base mb-1 flex items-center gap-2 tracking-widest drop-shadow-[0_0_5px_rgba(0,255,157,0.5)]">
                            <User size={16} />
                            {player?.name}
                        </h3>
                        <div className="flex gap-4 text-sm font-fira text-cyber-blue/80">
                            <div><span className="text-cyber-purple drop-shadow-sm">{player?.job}</span> <span className="text-slate-500">Lv.{player?.level}</span></div>
                            <div className="text-yellow-400 font-bold drop-shadow-sm">{player?.gold} CR</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <ProgressBar value={player?.hp} max={stats?.maxHp} variant="hp" label="VIT (HP)" />
                    <ProgressBar value={player?.mp} max={stats?.maxMp} variant="mp" label="NRG (MP)" />
                </div>

                <div className="border border-cyber-blue/20 rounded-md p-3 bg-cyber-dark/30 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-fira text-cyber-blue/60 uppercase tracking-wider">
                        <span className="flex items-center gap-1"><Sword size={10} /> 장비 상태</span>
                        <span>ATK {stats?.atk} / DEF {stats?.def}</span>
                    </div>
                    <div className="space-y-1 text-xs font-fira text-cyber-blue/80">
                        <div className="flex justify-between gap-3">
                            <span className="text-cyber-blue/50 shrink-0">R-HAND</span>
                            <span className="text-white text-right truncate">{player?.equip?.weapon?.name || 'UNARMED'} {stats?.weaponHands === 2 ? '(2H)' : '(1H)'}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-cyber-blue/50 shrink-0">L-HAND</span>
                            <span className="text-white text-right truncate">
                                {player?.equip?.offhand?.name || '---'}
                                {player?.equip?.offhand?.type === 'weapon' ? ' (1H)' : player?.equip?.offhand?.type === 'shield' ? ' (SHD)' : ''}
                            </span>
                        </div>
                        <div className="flex justify-between gap-3">
                            <span className="text-cyber-blue/50 shrink-0">ARMOR</span>
                            <span className="text-white text-right truncate">{player?.equip?.armor?.name || 'CIVILIAN'}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-cyber-blue/20 pt-4">
                    <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                        {TAB_ITEMS.map(tab => (
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                key={tab.id}
                                onClick={() => setSideTab(tab.id)}
                                title={tab.label}
                                aria-label={tab.label}
                                className={`min-h-[44px] min-w-[44px] flex-shrink-0 px-2 py-2 rounded border transition-all flex items-center justify-center
                                    ${sideTab === tab.id
                                        ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-[0_0_10px_rgba(0,204,255,0.4)]'
                                        : 'text-cyber-blue/50 border-cyber-blue/30 hover:border-cyber-blue/70 bg-cyber-dark/40'}`}
                            >
                                <tab.icon size={14} />
                            </Motion.button>
                        ))}
                    </div>

                    <div className="max-h-[40dvh] overflow-y-auto custom-scrollbar">
                        {renderTabContent()}
                    </div>
                </div>
            </Motion.div>
        );
    }

    // Desktop
    return (
        <aside className="hidden md:flex flex-col gap-3 h-full min-h-0 w-full transition-all duration-300">
            {/* STATUS PANEL — Collapsible */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg shadow-[0_0_20px_rgba(0,204,255,0.15)] relative overflow-hidden transition-all duration-300 shrink-0 ${statusCollapsed ? 'p-3' : 'p-3 max-h-[clamp(7.25rem,19dvh,11.75rem)] overflow-y-auto custom-scrollbar'
                    }`}
            >
                {/* Collapse toggle */}
                <button
                    onClick={() => setStatusCollapsed(prev => !prev)}
                    className="absolute top-2 right-2 z-10 text-cyber-blue/40 hover:text-cyber-blue transition-colors p-1 rounded hover:bg-cyber-blue/10"
                    title={statusCollapsed ? '펼치기' : '접기'}
                >
                    {statusCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {statusCollapsed ? (
                    <div className="space-y-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 font-rajdhani min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse shrink-0"></span>
                                <span className="text-white font-bold text-sm truncate">{player?.name}</span>
                            </div>
                            <span className="text-cyber-purple text-[10px] font-fira uppercase bg-cyber-purple/10 px-1.5 py-0.5 rounded border border-cyber-purple/30">
                                {player?.job}
                            </span>
                            <span className="text-cyber-blue text-[10px] font-fira uppercase">Lv.{player?.level}</span>
                            <span className="text-yellow-400 text-[10px] font-fira font-bold">{player?.gold} CR</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <ProgressBar value={player?.hp} max={stats?.maxHp} variant="hp" label="HP" showMeta={false} />
                            <ProgressBar value={player?.mp} max={stats?.maxMp} variant="mp" label="ENERGY" showMeta={false} />
                            <ProgressBar value={player?.exp} max={player?.nextExp} variant="exp" label="EXP" showMeta={false} />
                        </div>
                        </div>
                ) : (
                    <>
                        <h3 className="text-cyber-green font-rajdhani font-bold text-sm mb-2 flex items-center gap-2 tracking-[0.2em] border-b border-cyber-green/20 pb-2">
                            <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]"></span>
                            STATUS
                        </h3>

                        <div className="space-y-2">
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(9rem,11.5rem)] items-center gap-x-3 gap-y-1.5 text-[11px] font-fira">
                                <span className="text-cyber-blue/45 uppercase tracking-widest">닉네임</span>
                                <span className="text-white font-rajdhani text-lg font-bold truncate">{player?.name}</span>
                                <InlineMetric label="HP" value={player?.hp} max={stats?.maxHp} variant="hp" />

                                <span className="text-cyber-blue/45 uppercase tracking-widest">직업</span>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-cyber-purple uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/30 truncate">
                                        {player?.job}
                                    </span>
                                    <span className="text-cyber-blue uppercase shrink-0">Lv.{player?.level}</span>
                                </div>
                                <InlineMetric label="NRG" value={player?.mp} max={stats?.maxMp} variant="mp" />

                                <span className="text-cyber-blue/45 uppercase tracking-widest">Gold</span>
                                <span className="text-yellow-400 font-bold tracking-wide">{player?.gold} CR</span>
                                <InlineMetric label="EXP" value={player?.exp} max={player?.nextExp} variant="exp" />
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-2 border-t border-cyber-blue/10 text-[10px] font-fira">
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase flex items-center gap-1">
                                        <Sword size={9} /> {stats?.isMagic ? 'M.ATK' : 'ATK'}
                                    </span>
                                    <span className="text-white font-bold">
                                        {stats?.atk} <span className="text-cyber-purple font-normal">({stats?.elem})</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase flex items-center gap-1">
                                        <Shield size={9} /> DEF
                                    </span>
                                    <span className="text-white font-bold">{stats?.def}</span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 rounded border border-cyber-blue/10 bg-cyber-dark/30 px-2 py-1">
                                    <span className="text-cyber-blue/50 font-bold uppercase">CRIT</span>
                                    <span className="text-white font-bold">{Math.round((stats?.critChance || 0) * 100)}%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-1">
                                <div className="flex items-center gap-2 text-[10px] font-fira text-cyber-blue/45 uppercase tracking-[0.24em]">
                                    <Sword size={10} className="text-cyber-blue/60" />
                                    Equipped
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[10px] font-fira">
                                    <EquipmentSlot
                                        label="Main"
                                        item={player?.equip?.weapon}
                                        slot="main"
                                        fallback="UNARMED"
                                        icon={Sword}
                                    />
                                    <EquipmentSlot
                                        label="Off"
                                        item={player?.equip?.offhand}
                                        slot="offhand"
                                        fallback="EMPTY"
                                        icon={Shield}
                                    />
                                    <EquipmentSlot
                                        label="Armor"
                                        item={player?.equip?.armor}
                                        slot="armor"
                                        fallback="CIVILIAN"
                                        icon={User}
                                    />
                                </div>
                            </div>

                            {stats?.activeSet && (
                                <div className="p-1.5 bg-cyber-green/10 border border-cyber-green/30 rounded text-cyber-green text-center text-[10px] font-fira">
                                    <span className="font-bold">{stats.activeSet.desc}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Motion.div>

            {/* TABS */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-4 rounded-lg flex-1 min-h-[200px] overflow-hidden flex flex-col shadow-[0_0_20px_rgba(0,204,255,0.1)]"
            >
                <div className="flex gap-2 mb-4 border-b border-cyber-blue/20 pb-3">
                    {TAB_ITEMS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSideTab(tab.id)}
                            title={tab.label}
                            aria-label={tab.label}
                            className={`h-10 flex-1 flex items-center justify-center rounded-sm transition-all min-h-[36px]
                                ${sideTab === tab.id
                                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 shadow-[0_0_10px_rgba(0,204,255,0.3)]'
                                    : 'text-cyber-blue/30 hover:text-cyber-blue/70 hover:bg-cyber-blue/5'}`}
                        >
                            <tab.icon size={12} />
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {renderTabContent()}
                </div>
            </Motion.div>
        </aside>
    );
};

export default Dashboard;
