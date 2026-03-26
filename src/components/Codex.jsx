import React, { useState, useMemo } from 'react';
import { BookOpen, Sword, Shield, Bug, Hammer, Leaf } from 'lucide-react';
import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { getCodexProgress } from '../data/codexRewards';
import { AT } from '../reducers/actionTypes';
import SignalBadge from './SignalBadge';
import WeaponCodex from './codex/WeaponCodex';
import MonsterCodex from './codex/MonsterCodex';
import RecipeCodex from './codex/RecipeCodex';
import MaterialCodex from './codex/MaterialCodex';

const SUB_TABS = [
    { id: 'equip', label: 'EQUIP', icon: Sword },
    { id: 'monster', label: 'MONSTER', icon: Bug },
    { id: 'recipe', label: 'RECIPE', icon: Hammer },
    { id: 'material', label: 'MATERIAL', icon: Leaf },
];

const Codex = ({ player, dispatch }) => {
    const [subTab, setSubTab] = useState('equip');
    const progress = useMemo(() => {
        const codex = player?.stats?.codex || {};
        const claimed = player?.stats?.codexClaimed || [];
        return getCodexProgress(codex, claimed);
    }, [player?.stats?.codex, player?.stats?.codexClaimed]);

    // 전체 도감 항목 수 계산
    const totalCounts = useMemo(() => {
        const weapons = DB.ITEMS.weapons?.length || 0;
        const armors = (DB.ITEMS.armors || []).filter(a => a.type === 'armor').length;
        const shields = (DB.ITEMS.armors || []).filter(a => a.type === 'shield').length;
        const monsters = new Set();
        Object.values(DB.MAPS).forEach(map => (map.monsters || []).forEach(m => monsters.add(m)));
        const recipes = DB.ITEMS.recipes?.length || 0;
        const materials = DB.ITEMS.materials?.length || 0;
        return { weapons, armors, shields, monsters: monsters.size, recipes, materials };
    }, []);

    const discoveredCounts = useMemo(() => {
        const codex = player?.stats?.codex || {};
        return {
            weapons: Object.keys(codex.weapons || {}).length,
            armors: Object.keys(codex.armors || {}).length,
            shields: Object.keys(codex.shields || {}).length,
            monsters: Object.keys(codex.monsters || {}).length,
            recipes: Object.keys(codex.recipes || {}).length,
            materials: Object.keys(codex.materials || {}).length,
        };
    }, [player?.stats?.codex]);

    const codex = player?.stats?.codex || {};
    const totalAll = totalCounts.weapons + totalCounts.armors + totalCounts.shields + totalCounts.monsters + totalCounts.recipes + totalCounts.materials;
    const discoveredAll = discoveredCounts.weapons + discoveredCounts.armors + discoveredCounts.shields + discoveredCounts.monsters + discoveredCounts.recipes + discoveredCounts.materials;
    const pct = totalAll > 0 ? Math.round((discoveredAll / totalAll) * 100) : 0;

    return (
        <div className="space-y-2.5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="text-slate-500 text-xs font-fira tracking-[0.18em] uppercase flex items-center gap-1.5">
                    <BookOpen size={12} /> Codex
                </div>
                <SignalBadge tone="recommended" size="sm">{discoveredAll}/{totalAll} ({pct}%)</SignalBadge>
            </div>

            {/* Total Progress Bar */}
            <div className="w-full h-1.5 bg-black/24 rounded-full overflow-hidden">
                <div
                    style={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-full transition-all duration-700"
                />
            </div>

            {/* Unclaimed milestones */}
            {progress.unclaimed.length > 0 && (
                <div className="space-y-1.5">
                    {progress.unclaimed.map(m => {
                        const rewardText = [
                            m.reward.gold && `+${m.reward.gold}G`,
                            m.reward.premiumCurrency && `+${m.reward.premiumCurrency}💎`,
                            m.reward.atk && `ATK+${m.reward.atk}`,
                            m.reward.def && `DEF+${m.reward.def}`,
                            m.reward.hp && `HP+${m.reward.hp}`,
                        ].filter(Boolean).join(' ');
                        return (
                            <div key={m.id} className="flex items-center justify-between gap-2 rounded-[0.95rem] border border-cyber-green/30 bg-cyber-green/8 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-[10px] font-fira text-cyber-green truncate">{m.label}</div>
                                    <div className="text-[9px] font-fira text-slate-400 mt-0.5">{rewardText}</div>
                                </div>
                                <button
                                    onClick={() => dispatch?.({ type: AT.CLAIM_CODEX_REWARD, payload: { milestoneId: m.id, reward: m.reward } })}
                                    className="shrink-0 rounded-[0.7rem] border border-cyber-green/50 bg-cyber-green/15 px-2.5 py-1 text-[9px] font-fira text-cyber-green transition-all hover:bg-cyber-green/25"
                                >
                                    수령
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Sub Tabs */}
            <div className="grid grid-cols-4 gap-1">
                {SUB_TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[9px] font-fira uppercase tracking-wider transition-all
                                ${active
                                    ? 'bg-cyber-blue/15 border border-cyber-blue/40 text-cyber-blue'
                                    : 'border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/14'
                                }`}
                        >
                            <Icon size={12} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {subTab === 'equip' && (
                <WeaponCodex
                    codex={codex}
                    totalCounts={totalCounts}
                    discoveredCounts={discoveredCounts}
                    progress={progress}
                />
            )}
            {subTab === 'monster' && (
                <MonsterCodex player={player} />
            )}
            {subTab === 'recipe' && (
                <RecipeCodex codex={codex} player={player} />
            )}
            {subTab === 'material' && (
                <MaterialCodex codex={codex} />
            )}
        </div>
    );
};

export default Codex;
