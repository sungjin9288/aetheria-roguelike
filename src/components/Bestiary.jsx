import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BookOpen, Lock, Eye } from 'lucide-react';
import { DB } from '../data/db';
import { LOOT_TABLE } from '../data/loot';
import { BOSS_BRIEFS, MONSTERS } from '../data/monsters';
import SignalBadge from './SignalBadge';

/**
 * Bestiary — 몬스터 도감
 * player.stats.killRegistry 기반 만난 몬스터 기록 + 드롭 정보
 */
const Bestiary = ({ player, compact = false }) => {
    const [showAllBestiary, setShowAllBestiary] = useState(false);
    const [selectedMonster, setSelectedMonster] = useState(null);

    const allMonsters = useMemo(() => {
        const registry = player?.stats?.killRegistry || {};
        const monstersSet = new Set();
        Object.values(DB.MAPS).forEach(map => {
            (map.monsters || []).forEach(m => monstersSet.add(m));
        });
        return Array.from(monstersSet).map(name => {
            const kills = registry[name] || 0;
            const monsterMeta = MONSTERS[name] || {};
            const bossBrief = BOSS_BRIEFS[name] || null;
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
                },
                weakness: monsterMeta.weakness || null,
                resistance: monsterMeta.resistance || null,
                bossBrief,
            };
        });
    }, [player]);

    const encountered = allMonsters.filter(m => m.encountered);
    const total = allMonsters.length;
    const visibleMonsters = compact && !showAllBestiary
        ? (encountered.length > 0
            ? [...encountered].sort((a, b) => b.kills - a.kills).slice(0, 3)
            : [])
        : allMonsters;
    const hiddenMonsterCount = Math.max(0, total - visibleMonsters.length);
    const showBestiarySummary = compact && !showAllBestiary;

    return (
        <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
            <div className="flex items-center justify-between">
                <div className="text-slate-500 text-xs font-fira tracking-[0.18em] uppercase flex items-center gap-1.5">
                    <BookOpen size={12} /> Bestiary
                </div>
                <div className="flex items-center gap-1.5">
                    <SignalBadge tone="recommended" size="sm">{encountered.length} / {total}</SignalBadge>
                    {compact && (hiddenMonsterCount > 0 || showAllBestiary) && (
                        <button
                            type="button"
                            onClick={() => setShowAllBestiary((prev) => !prev)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            {showAllBestiary ? '요약 보기' : '도감 더 보기'}
                        </button>
                    )}
                </div>
            </div>

            {/* Progress */}
            <div className="w-full h-1.5 bg-black/24 rounded-full overflow-hidden">
                <Motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(encountered.length / Math.max(total, 1)) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-[#d5b180] to-rose-400 rounded-full"
                />
            </div>

            {/* Codex Total Bonuses */}
            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira bg-black/18 p-2 rounded-[0.95rem] border border-white/8">
                <span className="font-bold text-slate-300/80">총 보너스</span>
                <SignalBadge tone="success" size="sm">HP +{allMonsters.reduce((acc, m) => acc + m.bonuses.hp, 0)}</SignalBadge>
                <SignalBadge tone="danger" size="sm">ATK +{allMonsters.reduce((acc, m) => acc + m.bonuses.atk, 0)}</SignalBadge>
                <SignalBadge tone="neutral" size="sm">DEF +{allMonsters.reduce((acc, m) => acc + m.bonuses.def, 0)}</SignalBadge>
            </div>

            {/* Monster List */}
            {showBestiarySummary ? (
                encountered.length > 0 ? (
                    <div className="space-y-1.5">
                        {visibleMonsters.map((m) => (
                            <div
                                key={m.name}
                                className="w-full text-left flex items-center gap-2 p-2.5 rounded-[0.95rem] border border-white/8 bg-black/18 text-xs"
                            >
                                <Eye size={12} className="text-rose-300 shrink-0" />
                                <span className="font-rajdhani font-bold truncate text-white">{m.name}</span>
                                <span className="ml-auto text-[10px] text-slate-500 font-fira shrink-0">×{m.kills}</span>
                            </div>
                        ))}
                        <div className="rounded-[0.95rem] border border-white/8 bg-black/16 px-3 py-2 text-[10px] font-fira text-slate-400/76">
                            잠금 기록 {total - encountered.length}개는 `도감 더 보기`에서 확인합니다.
                        </div>
                    </div>
                ) : (
                    <div className="rounded-[1rem] border border-white/8 bg-black/16 px-3 py-4 text-center">
                        <div className="text-[13px] font-rajdhani tracking-[0.14em] text-slate-300/82">NO ENTRIES YET</div>
                        <div className="mt-1 text-[10px] font-fira text-slate-500">첫 처치가 생기면 도감 요약이 채워집니다.</div>
                    </div>
                )
            ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {allMonsters.map((m) => (
                        <Motion.button
                            key={m.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => m.encountered && setSelectedMonster(selectedMonster === m.name ? null : m.name)}
                            className={`w-full text-left flex items-center gap-2 p-2.5 rounded-[0.95rem] border transition-all text-xs
                                ${m.encountered
                                    ? selectedMonster === m.name
                                        ? 'bg-rose-400/10 border-rose-300/22'
                                        : 'bg-black/18 border-white/8 hover:border-white/14'
                                    : 'bg-black/10 border-white/6 opacity-30 cursor-default'
                                }`}
                        >
                            {m.encountered
                                ? <Eye size={12} className="text-rose-300 shrink-0" />
                                : <Lock size={12} className="text-slate-600 shrink-0" />
                            }
                            <span className={`font-rajdhani font-bold truncate ${m.encountered ? 'text-white' : 'text-slate-600'}`}>
                                {m.encountered ? m.name : '???'}
                            </span>
                            {m.encountered && (
                                <span className="ml-auto text-[10px] text-slate-500 font-fira shrink-0">
                                    ×{m.kills}
                                </span>
                            )}
                        </Motion.button>
                    ))}
                </div>
            )}

            {/* Detail Panel */}
            {!showBestiarySummary && selectedMonster && (() => {
                const m = allMonsters.find(x => x.name === selectedMonster);
                if (!m) return null;
                return (
                    <Motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/18 border border-white/8 rounded-[1rem] p-3 space-y-2"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-rajdhani font-bold text-rose-200">{m.name}</div>
                            {m.bossBrief && <SignalBadge tone="danger" size="sm">Boss</SignalBadge>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-fira">처치: {m.kills}회</div>
                        <div className="text-[10px] text-slate-500 font-fira">출현: {m.location || '불명'}</div>
                        {(m.weakness || m.resistance) && (
                            <div className="flex flex-wrap gap-1.5 text-[10px] font-fira">
                                {m.weakness && (
                                    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-emerald-100">
                                        약점 {m.weakness}
                                    </span>
                                )}
                                {m.resistance && (
                                    <span className="rounded-full border border-[#d5b180]/22 bg-[#d5b180]/10 px-2 py-0.5 text-[#f6e7c8]">
                                        내성 {m.resistance}
                                    </span>
                                )}
                            </div>
                        )}
                        {m.drops.length > 0 && (
                            <div className="space-y-0.5">
                                <div className="text-[10px] text-slate-500 font-fira">드롭 아이템:</div>
                                {m.drops.map(d => (
                                    <div key={d} className="text-[10px] text-[#f6e7c8]/72 font-fira pl-2">• {d}</div>
                                ))}
                            </div>
                        )}
                        {m.bossBrief && (
                            <div className="rounded-[0.95rem] border border-rose-300/20 bg-rose-400/[0.08] px-2.5 py-2 text-[10px] font-fira text-slate-300 space-y-1.5">
                                {m.bossBrief.signature && (
                                    <div>
                                        <span className="text-rose-200 font-bold">기믹</span>
                                        <span className="text-slate-400"> · {m.bossBrief.signature}</span>
                                    </div>
                                )}
                                {m.bossBrief.counterHint && (
                                    <div>
                                        <span className="text-[#dff7f5] font-bold">대응</span>
                                        <span className="text-slate-400"> · {m.bossBrief.counterHint}</span>
                                    </div>
                                )}
                                {m.bossBrief.phaseHint && (
                                    <div>
                                        <span className="text-[#d9d0f3] font-bold">페이즈</span>
                                        <span className="text-slate-400"> · {m.bossBrief.phaseHint}</span>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="pt-2 border-t border-white/8">
                            <div className="text-[10px] text-slate-500 font-fira mb-1">연구 보너스 (10/50/100킬):</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 10 ? 'text-emerald-100' : 'text-slate-500'}`}>• [10체] MaxHP +5 {m.kills >= 10 && '(달성)'}</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 50 ? 'text-emerald-100' : 'text-slate-500'}`}>• [50체] DEF +1 {m.kills >= 50 && '(달성)'}</div>
                            <div className={`text-[10px] font-fira ${m.kills >= 100 ? 'text-emerald-100' : 'text-slate-500'}`}>• [100체] ATK +1 {m.kills >= 100 && '(달성)'}</div>
                        </div>
                    </Motion.div>
                );
            })()}
        </div>
    );
};

export default Bestiary;
