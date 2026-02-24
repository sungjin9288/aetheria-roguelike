import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BookOpen, Lock, Eye } from 'lucide-react';
import { DB } from '../data/db';
import { LOOT_TABLE } from '../data/loot';

/**
 * Bestiary — 몬스터 도감
 * player.stats.killRegistry 기반 만난 몬스터 기록 + 드롭 정보
 */
const Bestiary = ({ player }) => {
    const [selectedMonster, setSelectedMonster] = useState(null);

    const allMonsters = useMemo(() => {
        const registry = player?.stats?.killRegistry || {};
        const monstersSet = new Set();
        Object.values(DB.MAPS).forEach(map => {
            (map.monsters || []).forEach(m => monstersSet.add(m));
        });
        return Array.from(monstersSet).map(name => {
            const kills = registry[name] || 0;
            return {
                name,
                kills,
                encountered: kills > 0,
                drops: LOOT_TABLE[name] || [],
                location: Object.entries(DB.MAPS)
                    .filter(([, map]) => (map.monsters || []).includes(name))
                    .map(([loc]) => loc)
                    .join(', '),
                bonuses: {
                    hp: kills >= 10 ? 5 : 0,
                    def: kills >= 50 ? 1 : 0,
                    atk: kills >= 100 ? 1 : 0
                }
            };
        });
    }, [player]);

    const encountered = allMonsters.filter(m => m.encountered);
    const total = allMonsters.length;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-cyber-blue/50 text-xs font-fira tracking-widest flex items-center gap-1.5">
                    <BookOpen size={12} /> ▸ BESTIARY
                </div>
                <div className="text-cyber-green text-xs font-fira">
                    {encountered.length} / {total}
                </div>
            </div>

            {/* Progress */}
            <div className="w-full h-1.5 bg-cyber-dark/60 rounded-full overflow-hidden">
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(encountered.length / Math.max(total, 1)) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                />
            </div>

            {/* Codex Total Bonuses */}
            <div className="flex gap-2 text-[10px] font-fira text-cyber-blue/70 bg-cyber-dark/30 p-1.5 rounded border border-cyber-blue/10">
                <span className="font-bold text-cyber-blue">총 보너스:</span>
                <span>HP +{allMonsters.reduce((acc, m) => acc + m.bonuses.hp, 0)}</span>
                <span>ATK +{allMonsters.reduce((acc, m) => acc + m.bonuses.atk, 0)}</span>
                <span>DEF +{allMonsters.reduce((acc, m) => acc + m.bonuses.def, 0)}</span>
            </div>

            {/* Monster List */}
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                {allMonsters.map((m) => (
                    <Motion.button
                        key={m.name}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => m.encountered && setSelectedMonster(selectedMonster === m.name ? null : m.name)}
                        className={`w-full text-left flex items-center gap-2 p-2 rounded border transition-all text-xs
                            ${m.encountered
                                ? selectedMonster === m.name
                                    ? 'bg-red-950/30 border-red-500/40'
                                    : 'bg-cyber-dark/20 border-cyber-blue/10 hover:border-cyber-blue/30'
                                : 'bg-cyber-dark/10 border-cyber-blue/5 opacity-30 cursor-default'
                            }`}
                    >
                        {m.encountered
                            ? <Eye size={12} className="text-red-400 shrink-0" />
                            : <Lock size={12} className="text-cyber-blue/20 shrink-0" />
                        }
                        <span className={`font-rajdhani font-bold truncate ${m.encountered ? 'text-white' : 'text-cyber-blue/20'}`}>
                            {m.encountered ? m.name : '???'}
                        </span>
                        {m.encountered && (
                            <span className="ml-auto text-[10px] text-cyber-blue/40 font-fira shrink-0">
                                ×{m.kills}
                            </span>
                        )}
                    </Motion.button>
                ))}
            </div>

            {/* Detail Panel */}
            {selectedMonster && (() => {
                const m = allMonsters.find(x => x.name === selectedMonster);
                if (!m) return null;
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-cyber-dark/40 border border-red-500/20 rounded p-3 space-y-2"
                    >
                        <div className="text-sm font-rajdhani font-bold text-red-400">{m.name}</div>
                        <div className="text-[10px] text-cyber-blue/40 font-fira">처치: {m.kills}회</div>
                        <div className="text-[10px] text-cyber-blue/40 font-fira">출현: {m.location || '불명'}</div>
                        {m.drops.length > 0 && (
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-cyber-blue/50 font-fira">드롭 아이템:</div>
                                {m.drops.map(d => (
                                    <div key={d} className="text-[10px] text-yellow-400/60 font-fira pl-2">• {d}</div>
                                ))}
                            </div>
                        )}
                        <div className="pt-2 border-t border-red-500/20">
                            <div className="text-[10px] text-cyber-blue/50 font-fira mb-1">연구 보너스 (10/50/100킬):</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 10 ? 'text-cyber-green' : 'text-cyber-blue/30'}`}>• [10체] MaxHP +5 {m.kills >= 10 && '(달성)'}</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 50 ? 'text-cyber-green' : 'text-cyber-blue/30'}`}>• [50체] DEF +1 {m.kills >= 50 && '(달성)'}</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 100 ? 'text-cyber-green' : 'text-cyber-blue/30'}`}>• [100체] ATK +1 {m.kills >= 100 && '(달성)'}</div>
                        </div>
                    </Motion.div>
                );
            })()}
        </div>
    );
};

export default Bestiary;
