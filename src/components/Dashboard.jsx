import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { User, Crown, Package, Scroll, Shield, Zap, Sword, Map, Trophy, BookOpen, BarChart3, Eye } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { DB } from '../data/db';
import { formatRewardParts, getActiveQuestEntries } from '../utils/gameUtils';
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

const ProgressBar = ({ value, max, variant = 'hp', label }) => {
    const theme = BAR_THEMES[variant] || BAR_THEMES.hp;
    const safeMax = Math.max(1, max || 1);
    const safeValue = Math.max(0, value || 0);
    const percentage = Math.min(100, (safeValue / safeMax) * 100);

    return (
        <div className="relative w-full">
            <div className="flex justify-between text-[10px] uppercase font-bold mb-0.5 text-cyber-blue/70">
                <span>{label}</span>
                <span>{safeValue}/{safeMax}</span>
            </div>
            <div className={`w-full h-2 bg-cyber-dark/50 rounded-sm overflow-hidden border ${theme.border} relative`}>
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

// Animation variants for tab content
const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

const getQuestObjectiveText = (quest) => (
    quest?.target === 'Level'
        ? `레벨 ${quest.goal} 달성`
        : `${quest.target} ${quest.goal}회 달성`
);

const getQuestProgressText = (quest, progress = 0) => (
    quest?.target === 'Level'
        ? `레벨 ${progress}/${quest.goal}`
        : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress = 0, goal = 1) => Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

const QuestRewardChips = ({ reward, accent = 'blue' }) => {
    const rewards = formatRewardParts(reward);
    if (!rewards.length) return null;

    const accentClass = accent === 'green'
        ? 'border-cyber-green/30 bg-cyber-green/10 text-cyber-green'
        : accent === 'amber'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-cyber-blue/20 bg-cyber-blue/10 text-cyber-blue';

    return (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-fira">
            {rewards.map((entry) => (
                <span key={`${accent}_${entry}`} className={`rounded border px-2 py-1 ${accentClass}`}>
                    {entry}
                </span>
            ))}
        </div>
    );
};

const _SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false, quickSlots = [null, null, null] }) => {
    const [statusCollapsed, setStatusCollapsed] = useState(false);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';

    const renderTabContent = (isMobile) => {
        const _btnClass = isMobile
            ? "text-xs bg-cyber-blue/10 hover:bg-cyber-blue/30 text-cyber-blue px-4 py-3 rounded border border-cyber-blue/30 font-bold min-h-[44px]"
            : "text-[10px] bg-cyber-blue/10 hover:bg-cyber-blue/30 text-cyber-blue px-3 py-1.5 rounded-sm border border-cyber-blue/30 font-bold tracking-wider";

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
                            onMove={(loc) => actions.move(loc)}
                            isAiThinking={false}
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
                            AGENT: {player?.name}
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
                        {[{ id: 'inventory', icon: Package }, { id: 'quest', icon: Scroll }, { id: 'achievements', icon: Trophy }, { id: 'skills', icon: BookOpen }, { id: 'map', icon: Map }, { id: 'stats', icon: BarChart3 }, { id: 'bestiary', icon: Eye }, { id: 'system', icon: Zap }].map(tab => (
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                key={tab.id}
                                onClick={() => setSideTab(tab.id)}
                                className={`min-h-[44px] min-w-[60px] flex-shrink-0 flex-1 text-[10px] px-2 py-2 rounded border uppercase font-bold tracking-wider transition-all flex flex-col items-center justify-center gap-0.5
                                    ${sideTab === tab.id
                                        ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-[0_0_10px_rgba(0,204,255,0.4)]'
                                        : 'text-cyber-blue/50 border-cyber-blue/30 hover:border-cyber-blue/70 bg-cyber-dark/40'}`}
                            >
                                <tab.icon size={14} />
                                {tab.id.slice(0, 4)}
                            </Motion.button>
                        ))}
                    </div>

                    <div className="max-h-[40dvh] overflow-y-auto custom-scrollbar">
                        {renderTabContent(true)}
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
                className={`bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 rounded-lg shadow-[0_0_20px_rgba(0,204,255,0.15)] relative overflow-hidden transition-all duration-300 shrink-0 ${statusCollapsed ? 'p-3' : 'p-4 max-h-[clamp(10rem,35dvh,22rem)] overflow-y-auto custom-scrollbar'
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
                    /* Compact: name + HP bar only */
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 font-rajdhani">
                                <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse"></span>
                                <span className="text-white font-bold text-sm truncate">{player?.name}</span>
                                <span className="text-cyber-purple text-[10px] font-fira">{player?.job} Lv.{player?.level}</span>
                                <span className="text-yellow-400 text-[10px] font-fira ml-auto">{player?.gold}G</span>
                            </div>
                            <div className="mt-1.5 flex gap-2">
                                <div className="flex-1"><ProgressBar value={player?.hp} max={stats?.maxHp} variant="hp" label="HP" /></div>
                                <div className="flex-1"><ProgressBar value={player?.mp} max={stats?.maxMp} variant="mp" label="MP" /></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Full status panel */
                    <>
                        <h3 className="text-cyber-green font-rajdhani font-bold text-sm mb-3 flex items-center gap-2 tracking-[0.2em] border-b border-cyber-green/20 pb-2">
                            <span className="w-1.5 h-1.5 bg-cyber-green rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]"></span>
                            AGENT STATUS
                        </h3>

                        <div className="space-y-3">
                            <div className="flex flex-col font-rajdhani">
                                <span className="text-xl text-white font-bold tracking-wider">{player?.name}</span>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-cyber-purple font-fira uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/30">{player?.job}</span>
                                    <span className="text-cyber-blue">LEVEL {player?.level}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-cyber-dark/80 p-1.5 rounded border border-yellow-500/30">
                                <div className="w-1.5 h-1.5 bg-yellow-400 rotate-45 animate-pulse"></div>
                                <span className="font-fira text-yellow-400 font-bold tracking-wider text-sm">{player?.gold} CR</span>
                            </div>

                            <div className="space-y-3">
                                <ProgressBar value={player?.hp} max={stats?.maxHp} variant="hp" label="VITALITY" />
                                <ProgressBar value={player?.mp} max={stats?.maxMp} variant="mp" label="ENERGY" />
                                <ProgressBar value={player?.exp} max={player?.nextExp} variant="exp" label="EXPERIENCE" />
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-cyber-blue/10">
                                <div className="bg-cyber-dark/30 p-1.5 rounded border border-cyber-blue/10">
                                    <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-0.5 flex items-center gap-1"><Sword size={9} /> {stats?.isMagic ? 'M.ATK' : 'ATK'}</div>
                                    <div className="text-white font-fira font-bold">{stats?.atk} <span className="text-[10px] text-cyber-purple font-normal">({stats?.elem})</span></div>
                                </div>
                                <div className="bg-cyber-dark/30 p-1.5 rounded border border-cyber-blue/10">
                                    <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-0.5 flex items-center gap-1"><Shield size={9} /> DEF</div>
                                    <div className="text-white font-fira font-bold">{stats?.def}</div>
                                </div>
                            </div>

                            <div className="space-y-1 text-[10px] font-fira text-cyber-blue/60 border-t border-cyber-blue/10 pt-2">
                                <div className="flex justify-between"><span>R-HAND:</span> <span className="text-white">{player?.equip?.weapon?.name || 'UNARMED'} {stats?.weaponHands === 2 ? '(2H)' : '(1H)'}</span></div>
                                <div className="flex justify-between"><span>L-HAND:</span> <span className="text-white">{player?.equip?.offhand?.name || '---'}{player?.equip?.offhand?.type === 'weapon' ? ' (1H)' : player?.equip?.offhand?.type === 'shield' ? ' (SHD)' : ''}</span></div>
                                <div className="flex justify-between"><span>ARM:</span> <span className="text-white">{player?.equip?.armor?.name || 'CIVILIAN'}</span></div>
                                {stats?.activeSet && (
                                    <div className="mt-2 p-1.5 bg-cyber-green/10 border border-cyber-green/30 rounded text-cyber-green text-center">
                                        <span className="font-bold">{stats.activeSet.desc}</span>
                                    </div>
                                )}
                            </div>
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
                    {[{ id: 'inventory', icon: Package }, { id: 'quest', icon: Scroll }, { id: 'achievements', icon: Trophy }, { id: 'skills', icon: BookOpen }, { id: 'map', icon: Map }, { id: 'stats', icon: BarChart3 }, { id: 'bestiary', icon: Eye }, { id: 'system', icon: Zap }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSideTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold font-rajdhani uppercase tracking-wider rounded-sm transition-all min-h-[36px]
                                ${sideTab === tab.id
                                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 shadow-[0_0_10px_rgba(0,204,255,0.3)]'
                                    : 'text-cyber-blue/30 hover:text-cyber-blue/70 hover:bg-cyber-blue/5'}`}
                        >
                            <tab.icon size={12} />
                            <span className="hidden xl:inline">{tab.id}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {renderTabContent(false)}
                </div>
            </Motion.div>
        </aside>
    );
};

export default Dashboard;
