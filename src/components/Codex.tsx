import React, { useState, useMemo, useCallback } from 'react';
import { BookOpen, Sword, Shield, Bug, Hammer, Leaf, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { BALANCE } from '../data/constants';
import { MSG } from '../data/messages';
import { getCodexProgress } from '../data/codexRewards';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import { AT } from '../reducers/actionTypes';
import SignalBadge from './SignalBadge';
import WeaponCodex from './codex/WeaponCodex';
import MonsterCodex from './codex/MonsterCodex';
import RecipeCodex from './codex/RecipeCodex';
import MaterialCodex from './codex/MaterialCodex';
import LegendaryCodex from './codex/LegendaryCodex';
import CodexDiscoveryOverlay from './codex/CodexDiscoveryOverlay';

const SUB_TABS: any = [
    { id: 'equip', label: 'EQUIP', icon: Sword },
    { id: 'monster', label: 'MONSTER', icon: Bug },
    { id: 'recipe', label: 'RECIPE', icon: Hammer },
    { id: 'material', label: 'MATERIAL', icon: Leaf },
    { id: 'legend', label: 'LEGEND', icon: Sparkles },
];

const Codex = ({ player, dispatch }: any) => {
    const [subTab, setSubTab] = useState('equip');
    const [discoveryEntry, setDiscoveryEntry] = useState(null);
    const dismissDiscovery = useCallback(() => setDiscoveryEntry(null), []);
    const progress = useMemo(() => {
        const codex = player?.stats?.codex || {};
        const claimed = player?.stats?.codexClaimed || [];
        return getCodexProgress(codex, claimed);
    }, [player?.stats?.codex, player?.stats?.codexClaimed]);

    // 전체 도감 항목 수 계산
    const totalCounts = useMemo(() => {
        const weapons = DB.ITEMS.weapons?.length || 0;
        const armors = (DB.ITEMS.armors || []).filter((a: any) => a.type === 'armor').length;
        const shields = (DB.ITEMS.armors || []).filter((a: any) => a.type === 'shield').length;
        const monsters = new Set<string>();
        (Object.values(DB.MAPS) as any[]).forEach((map: any) => (map.monsters || []).forEach((m: string) => monsters.add(m)));
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

    const codex = useMemo(() => player?.stats?.codex || {}, [player?.stats?.codex]);
    const totalAll = totalCounts.weapons + totalCounts.armors + totalCounts.shields + totalCounts.monsters + totalCounts.recipes + totalCounts.materials;
    const discoveredAll = discoveredCounts.weapons + discoveredCounts.armors + discoveredCounts.shields + discoveredCounts.monsters + discoveredCounts.recipes + discoveredCounts.materials;
    const pct = totalAll > 0 ? Math.round((discoveredAll / totalAll) * 100) : 0;

    const legendaryCount = useMemo(() => {
        const total = Object.keys(SIGNATURE_ITEM_REGISTRY).length;
        let discovered = 0;
        const all = [
            ...(DB.ITEMS.weapons || []),
            ...(DB.ITEMS.armors || []),
        ];
        for (const itemName of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
            const item = all.find((entry: any) => entry?.name === itemName);
            if (!item) continue;
            const bucket = item.type === 'weapon' ? 'weapons' : item.type === 'shield' ? 'shields' : 'armors';
            if (codex[bucket]?.[itemName]) discovered += 1;
        }
        return { total, discovered, pct: total > 0 ? Math.round((discovered / total) * 100) : 0 };
    }, [codex]);

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
                    {progress.unclaimed.map((m: any) => {
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
            <div className="grid grid-cols-3 gap-1.5">
                {SUB_TABS.map((tab: any) => {
                    const Icon = tab.icon;
                    const active = subTab === tab.id;
                    const isLegend = tab.id === 'legend';
                    const accent = isLegend && active ? 'bg-amber-300/15 border-amber-300/45 text-amber-200' : active ? 'bg-cyber-blue/15 border-cyber-blue/40 text-cyber-blue' : 'border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/14';
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-lg text-[11px] font-fira uppercase tracking-wider transition-all border ${accent}`}
                        >
                            <Icon size={12} />
                            {tab.label}
                            {isLegend && (
                                <span className="text-[8px] font-fira text-amber-200/75 leading-none">
                                    {legendaryCount.discovered}/{legendaryCount.total}
                                </span>
                            )}
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
                    player={player}
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
            {subTab === 'legend' && (
                <LegendaryCodex player={player} />
            )}

            {/* 도감 발견 오버레이 */}
            <CodexDiscoveryOverlay entry={discoveryEntry} onDismiss={dismissDiscovery} />
        </div>
    );
};

export default Codex;
