import React, { useState, useCallback, useMemo } from 'react';
import { Copy, Crown, Skull, Shield, Save } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID, CONSTANTS } from '../../data/constants';
import { exportToJson } from '../../utils/fileUtils';
import { getTitleColor, getTitleLabel, getTitlePassiveLabel } from '../../utils/gameUtils';
import { RARITY_COLORS } from '../../data/titles';
import { FeedbackValidator } from '../../systems/FeedbackValidator';

const _SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

/**
 * SystemTab — Dashboard의 system 탭 콘텐츠 (#4 분리)
 * props: player, actions, stats
 */
const SystemTab = ({ player, actions, stats, runtime = null, compact = false }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState(null);
    const [showAllSystem, setShowAllSystem] = useState(false);

    const qaContext = useMemo(() => {
        const platform = typeof navigator !== 'undefined'
            ? (navigator.userAgentData?.platform || navigator.platform || 'unknown')
            : 'unknown';
        const viewportSize = typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : 'unknown';
        return {
            build: `v${CONSTANTS.DATA_VERSION}`,
            viewport: runtime?.viewport || 'unknown',
            state: runtime?.gameState || 'unknown',
            sync: runtime?.syncStatus || 'unknown',
            ai: runtime?.isAiThinking ? 'thinking' : 'idle',
            platform,
            screen: viewportSize,
            player: player.name,
            job: player.job,
            level: player.level,
            loc: player.loc,
            session: _SESSION_ID,
        };
    }, [player.job, player.level, player.loc, player.name, runtime]);

    const qaReadout = useMemo(() => {
        return [
            `BUILD=${qaContext.build}`,
            `VIEWPORT=${qaContext.viewport}`,
            `STATE=${qaContext.state}`,
            `SYNC=${qaContext.sync}`,
            `AI=${qaContext.ai}`,
            `PLATFORM=${qaContext.platform}`,
            `SCREEN=${qaContext.screen}`,
            `PLAYER=${qaContext.player}`,
            `JOB=${qaContext.job}`,
            `LV=${qaContext.level}`,
            `LOC=${qaContext.loc}`,
            `SESSION=${qaContext.session}`,
        ].join('\n');
    }, [qaContext]);

    const qaSnapshot = useMemo(() => {
        const inventoryCounts = player.inv.reduce((acc, item) => {
            acc[item.name] = (acc[item.name] || 0) + 1;
            return acc;
        }, {});

        return {
            exportedAt: new Date().toISOString(),
            qa: qaContext,
            summary: {
                name: player.name,
                level: player.level,
                job: player.job,
                gold: player.gold,
                hp: player.hp,
                mp: player.mp,
                loc: player.loc,
                activeTitle: player.activeTitle || null,
            },
            runtime: runtime || null,
            combatStats: stats
                ? {
                    atk: stats.atk,
                    def: stats.def,
                    maxHp: stats.maxHp,
                    maxMp: stats.maxMp,
                    critChance: stats.critChance,
                    elem: stats.elem,
                    isMagic: stats.isMagic,
                }
                : null,
            equipment: {
                weapon: player.equip?.weapon?.name || null,
                offhand: player.equip?.offhand?.name || null,
                armor: player.equip?.armor?.name || null,
            },
            relics: (player.relics || []).map((relic) => ({
                id: relic.id,
                name: relic.name,
                rarity: relic.rarity,
            })),
            titles: player.titles || [],
            inventoryCounts,
            meta: player.meta || null,
            dailyProtocol: player.stats?.dailyProtocol || null,
        };
    }, [player, qaContext, runtime, stats]);

    const copyQaReadout = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(qaReadout);
            setFeedbackStatus({ type: 'success', text: 'QA readout copied.' });
        } catch {
            setFeedbackStatus({ type: 'error', text: 'Failed to copy QA readout.' });
        }
    }, [qaReadout]);

    const exportQaSnapshot = useCallback(() => {
        exportToJson(`aetheria_qa_snapshot_${Date.now()}.json`, qaSnapshot);
        setFeedbackStatus({ type: 'success', text: 'QA snapshot exported.' });
    }, [qaSnapshot]);

    const updateLiveConfig = useCallback(async (partialConfig) => {
        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
        await setDoc(configRef, { config: partialConfig }, { merge: true });
    }, []);

    const handleSetMultiplier = useCallback(async () => {
        const raw = window.prompt('EXP Multiplier (1-5):', String(actions.liveConfig?.eventMultiplier || 1));
        if (raw === null) return;
        const value = Number.parseFloat(raw);
        if (!Number.isFinite(value) || value < 1 || value > 5) {
            setFeedbackStatus({ type: 'error', text: 'Multiplier must be between 1 and 5.' });
            return;
        }
        try {
            await updateLiveConfig({ eventMultiplier: value });
            setFeedbackStatus({ type: 'success', text: `Multiplier updated to x${value}.` });
        } catch { setFeedbackStatus({ type: 'error', text: 'Failed to update multiplier.' }); }
    }, [actions.liveConfig, updateLiveConfig]);

    const handleBroadcast = useCallback(async () => {
        const raw = window.prompt('Announcement (max 100 chars):', actions.liveConfig?.announcement || '');
        if (raw === null) return;
        const text = raw.trim();
        if (!text) { setFeedbackStatus({ type: 'error', text: 'Announcement cannot be empty.' }); return; }
        try {
            await updateLiveConfig({ announcement: text.slice(0, 100) });
            setFeedbackStatus({ type: 'success', text: 'Broadcast updated.' });
        } catch { setFeedbackStatus({ type: 'error', text: 'Failed to update broadcast.' }); }
    }, [actions.liveConfig, updateLiveConfig]);

    const submitFeedback = useCallback(async () => {
        const validation = FeedbackValidator.validate(feedbackText);
        if (!validation.valid) { setFeedbackStatus({ type: 'error', text: validation.error }); return; }
        try {
            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
            await addDoc(feedbackCol, {
                uid: actions.getUid(),
                nickname: player.name,
                message: feedbackText.trim(),
                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                timestamp: serverTimestamp()
            });
            FeedbackValidator.markSubmitted();
            setFeedbackText('');
            setFeedbackStatus({ type: 'success', text: 'Transmission complete.' });
        } catch { setFeedbackStatus({ type: 'error', text: 'Transmission failed.' }); }
    }, [actions, feedbackText, player]);

    const feedbackStatusClass = feedbackStatus?.type === 'error'
        ? 'text-rose-200 border-rose-300/22 bg-rose-400/10'
        : 'text-emerald-100 border-emerald-300/24 bg-emerald-300/10';
    const today = new Date().toISOString().slice(0, 10);
    const dailyProtocol = player.stats?.dailyProtocol;
    const isDailyProtocolToday = Boolean(dailyProtocol?.missions?.length) && dailyProtocol.date === today;
    const dailyDoneCount = isDailyProtocolToday ? dailyProtocol.missions.filter((mission) => mission.done).length : 0;
    const nextDailyMission = isDailyProtocolToday
        ? (dailyProtocol.missions.find((mission) => !mission.done) || dailyProtocol.missions[0] || null)
        : null;
    const leaderboard = actions.leaderboard || [];
    const topRanker = leaderboard[0] || null;
    const myRankIndex = leaderboard.findIndex((entry) => entry.nickname === player.name);
    const showSystemSummary = compact && !showAllSystem;

    return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${compact ? 'space-y-2.5 p-1' : 'space-y-3 p-1.5'}`}>
            {compact && (
                <div className="flex items-center justify-between gap-2">
                    <div className="text-slate-500 text-xs font-fira tracking-[0.18em] uppercase">System</div>
                    <button
                        type="button"
                        onClick={() => setShowAllSystem((prev) => !prev)}
                        className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] text-slate-300/78 hover:bg-white/[0.04]"
                    >
                        {showAllSystem ? '요약 보기' : '시스템 더 보기'}
                    </button>
                </div>
            )}

            {/* 세션 정보 */}
            <div className={`rounded-[1rem] border border-white/8 bg-black/18 text-[10px] text-slate-400/72 font-fira ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
                <div className={`${compact ? 'grid grid-cols-2 gap-x-2 gap-y-1' : 'flex flex-wrap gap-x-3 gap-y-1'}`}>
                    <p className="truncate">SESSION: {_SESSION_ID}</p>
                    <p className="truncate">UID: {actions.getUid() || 'guest'}</p>
                    <p className="truncate">BUILD: v{CONSTANTS.DATA_VERSION}</p>
                </div>
                {(player.meta?.prestigeRank || 0) > 0 && (
                    <p className="text-[#d9d0f3] mt-1">PRESTIGE: {player.meta.prestigeRank}회 환생 완료</p>
                )}
            </div>

            <div className={`rounded-[1rem] border border-white/8 bg-black/18 ${compact ? 'p-2.5' : 'p-3'}`}>
                <div className={`gap-3 ${compact && showSystemSummary ? 'mb-1.5 flex flex-col items-stretch' : compact ? 'mb-1.5 flex items-center justify-between' : 'mb-2 flex items-center justify-between'}`}>
                    <div className="text-[11px] font-bold text-slate-300/76 font-rajdhani tracking-[0.18em]">QA READOUT</div>
                    <div className={`flex items-center gap-2 ${compact && showSystemSummary ? 'w-full' : ''}`}>
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={copyQaReadout}
                            className={`${compact ? 'min-h-[30px] px-2.5 text-[10px]' : 'min-h-[34px] px-3 text-[11px]'} ${compact && showSystemSummary ? 'flex-1 justify-center' : ''} rounded-full border border-white/8 bg-black/20 text-slate-200 font-fira flex items-center gap-1.5`}
                        >
                            <Copy size={12} /> COPY
                        </Motion.button>
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={exportQaSnapshot}
                            className={`${compact ? 'min-h-[30px] px-2.5 text-[10px]' : 'min-h-[34px] px-3 text-[11px]'} ${compact && showSystemSummary ? 'flex-1 justify-center' : ''} rounded-full border border-[#7dd4d8]/22 bg-[#7dd4d8]/10 text-[#dff7f5] font-fira flex items-center gap-1.5`}
                        >
                            <Save size={12} /> EXPORT
                        </Motion.button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-fira text-slate-300/76 mb-2">
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">VIEWPORT: {runtime?.viewport || 'unknown'}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">STATE: {runtime?.gameState || 'unknown'}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">SYNC: {runtime?.syncStatus || 'unknown'}</div>
                    <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2 py-1.5">AI: {runtime?.isAiThinking ? 'thinking' : 'idle'}</div>
                </div>
                {!showSystemSummary && (
                    <pre className="whitespace-pre-wrap break-all rounded-[0.95rem] border border-white/8 bg-black/22 px-2.5 py-2 text-[10px] font-fira text-slate-400/72">
                        {qaReadout}
                    </pre>
                )}
            </div>

            {showSystemSummary ? (
                <>
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8 px-2.5 py-2">
                            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-slate-500">Relics</div>
                            <div className="mt-1 text-[12px] font-rajdhani font-bold text-[#e3dcff]">{(player.relics || []).length}/5</div>
                            <div className="mt-1 text-[10px] font-fira text-slate-300/74 truncate">{player.relics?.[0]?.name || '획득 전'}</div>
                        </div>
                        <div className="rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/8 px-2.5 py-2">
                            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-slate-500">Titles</div>
                            <div className="mt-1 text-[12px] font-rajdhani font-bold text-[#f6e7c8]">{(player.titles || []).length}</div>
                            <div className="mt-1 text-[10px] font-fira text-slate-300/74 truncate">{player.activeTitle ? getTitleLabel(player.activeTitle) : '활성 없음'}</div>
                        </div>
                        <div className="rounded-[1rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/8 px-2.5 py-2">
                            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-slate-500">Daily</div>
                            <div className="mt-1 text-[12px] font-rajdhani font-bold text-[#dff7f5]">
                                {isDailyProtocolToday ? `${dailyDoneCount}/${dailyProtocol.missions.length}` : '없음'}
                            </div>
                            <div className="mt-1 text-[10px] font-fira text-slate-300/74 truncate">
                                {nextDailyMission
                                    ? `${nextDailyMission.type} ${nextDailyMission.progress}/${nextDailyMission.goal}`
                                    : '오늘의 프로토콜 없음'}
                            </div>
                        </div>
                        <div className="rounded-[1rem] border border-white/8 bg-black/18 px-2.5 py-2">
                            <div className="text-[9px] font-fira uppercase tracking-[0.16em] text-slate-500">Hall</div>
                            <div className="mt-1 text-[12px] font-rajdhani font-bold text-slate-100 truncate">
                                {topRanker?.nickname || 'SYNCING'}
                            </div>
                            <div className="mt-1 text-[10px] font-fira text-slate-300/74 truncate">
                                {myRankIndex >= 0 ? `내 순위 ${myRankIndex + 1}위` : '개인 순위 미기록'}
                            </div>
                        </div>
                    </div>
                    {feedbackStatus && (
                        <div className={`text-xs px-2 py-1 rounded border ${feedbackStatusClass}`}>{feedbackStatus.text}</div>
                    )}
                </>
            ) : (
                <>
                    {/* 유물 */}
                    {(player.relics || []).length > 0 && (
                        <div className="rounded-[1rem] border border-[#9a8ac0]/20 bg-[#9a8ac0]/8 p-3">
                            <div className="text-[11px] font-bold text-[#e3dcff] mb-2 flex items-center gap-2 font-rajdhani tracking-[0.16em]">
                                Relics ({player.relics.length}/5)
                            </div>
                            <div className="space-y-1">
                                {player.relics.map((r) => (
                                    <div key={r.id} className="flex items-start gap-2 text-[11px] rounded-[0.9rem] border border-white/8 bg-black/16 px-2.5 py-2">
                                        <span className={`font-bold shrink-0 ${RARITY_COLORS[r.rarity] || 'text-slate-300'}`}>{r.name}</span>
                                        <span className="text-slate-300/72">{r.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 칭호 */}
                    {(player.titles || []).length > 0 && (
                        <div className="rounded-[1rem] border border-[#d5b180]/18 bg-[#d5b180]/8 p-3">
                            <div className="text-[11px] font-bold text-[#f6e7c8] mb-2 flex items-center gap-2 font-rajdhani tracking-[0.16em]">Titles ({player.titles.length})</div>
                            {player.activeTitle && (
                                <div className="mb-2 rounded-[0.95rem] border border-[#d5b180]/18 bg-black/16 px-2.5 py-2 text-[10px] font-fira">
                                    <div className="text-[#f6e7c8] font-bold">활성 칭호: [{getTitleLabel(player.activeTitle)}]</div>
                                    <div className="text-slate-300/72 mt-1">패시브: {getTitlePassiveLabel(player.activeTitle)}</div>
                                </div>
                            )}
                            <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                                {player.titles.map((id) => {
                                    const isActive = player.activeTitle === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => actions.setActiveTitle?.(isActive ? null : id)}
                                            className={`w-full text-left text-xs px-2.5 py-2 rounded-[0.95rem] border transition-colors ${isActive ? 'bg-black/20 border-[#d5b180]/24' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.05]'}`}
                                        >
                                            <span className={`font-bold ${getTitleColor(id)}`}>[{getTitleLabel(id)}]</span>
                                            {isActive && <span className="text-[#f6e7c8] text-[10px] ml-2">활성</span>}
                                            <div className="text-slate-400/72 text-[10px] mt-0.5">{getTitlePassiveLabel(id)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 일일 프로토콜 */}
                    {(() => {
                        const dp = player.stats?.dailyProtocol;
                        if (!dp || !dp.missions?.length) return null;
                        if (dp.date !== today) return null;
                        return (
                            <div className="rounded-[1rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/8 p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-[11px] font-bold text-[#dff7f5] font-rajdhani tracking-[0.16em]">Daily Protocol</div>
                                    {dp.relicShards > 0 && <span className="text-[10px] text-[#d9d0f3]">{dp.relicShards}/5 조각</span>}
                                </div>
                                <div className="space-y-2">
                                    {dp.missions.map((m) => {
                                        const pct = Math.min(100, ((m.progress || 0) / Math.max(1, m.goal)) * 100);
                                        const rewardText = m.reward.essence ? `에센스 ${m.reward.essence}` : m.reward.item || (m.reward.relicShard ? '유물 조각' : '');
                                        return (
                                            <div key={m.id} className="rounded-[0.95rem] border border-white/8 bg-black/16 px-2.5 py-2">
                                                <div className="flex justify-between text-[10px] mb-0.5">
                                                    <span className={m.done ? 'text-[#dff7f5] line-through' : 'text-slate-300/86'}>
                                                        {m.type === 'kills' ? `처치 ${m.goal}` : m.type === 'explores' ? `탐색 ${m.goal}` : `골드 지출 ${m.goal}`}
                                                    </span>
                                                    <span className="text-slate-500">{m.progress}/{m.goal} → {rewardText}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${m.done ? 'bg-[#7dd4d8]' : 'bg-[#7dd4d8]/60'}`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Hall of Fame */}
                    <div className="rounded-[1rem] border border-[#d5b180]/18 bg-black/18 p-3 mb-2 relative overflow-hidden">
                        <div className="text-[11px] font-bold text-[#f6e7c8] mb-3 flex items-center gap-2 font-rajdhani tracking-[0.18em]"><Crown size={12} /> HALL OF FAME</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => {
                                const isMe = ranker.nickname === player.name;
                                return (
                                    <div key={i} className={`flex justify-between text-[10px] border-b border-white/6 pb-1 last:border-0 p-1 rounded transition-colors font-fira ${isMe ? 'bg-emerald-300/[0.06] border-l-2 border-l-emerald-300 pl-2' : 'hover:bg-white/[0.03] text-slate-300/76'}`}>
                                        <span className="flex gap-2 items-center min-w-0">
                                            <span className={`w-4 text-center font-bold shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                            <span className={`truncate ${isMe ? 'text-emerald-100 font-bold' : 'text-white'}`}>
                                                {ranker.nickname}
                                                {ranker.activeTitle && <span className="text-[#d9d0f3]/70 ml-1">[{getTitleLabel(ranker.activeTitle)}]</span>}
                                                {isMe && <span className="text-emerald-100 ml-1">◀</span>}
                                            </span>
                                        </span>
                                        <span className="flex gap-2 items-center shrink-0 ml-1">
                                            {ranker.prestigeRank > 0 && <span className="text-[#d9d0f3] text-[9px]">⚡{ranker.prestigeRank}</span>}
                                            <span className="text-rose-300 flex items-center gap-1"><Skull size={8} /> {(ranker.totalKills || 0).toLocaleString()}</span>
                                        </span>
                                    </div>
                                );
                            }) : <div className="text-xs text-slate-500 text-center font-fira animate-pulse">SYNCING NETWORK...</div>}
                        </div>
                    </div>

                    {/* 로그 다운로드 */}
                    <Motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            const exportData = {
                                timestamp: new Date().toISOString(),
                                summary: { name: player.name, level: player.level, job: player.job, gold: player.gold },
                                stats,
                                equipment: player.equip,
                                history: [...(player.archivedHistory || []), ...player.history]
                            };
                            exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                        }}
                        className="w-full bg-[#7dd4d8]/10 hover:bg-[#7dd4d8]/16 text-[#dff7f5] py-3 rounded-full border border-[#7dd4d8]/22 flex items-center justify-center gap-2 font-rajdhani font-bold tracking-[0.16em] transition-all min-h-[42px]"
                    >
                        <Save size={16} /> DOWNLOAD LOGS
                    </Motion.button>

                    {/* Admin */}
                    {actions.isAdmin() && (
                        <div className="bg-rose-400/10 p-3 rounded-[1rem] border border-rose-300/22 mt-4">
                            <div className="text-[11px] font-bold text-rose-100 mb-2 font-rajdhani flex items-center gap-2 tracking-[0.16em]"><Shield size={12} /> ADMIN CONTROLS</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handleSetMultiplier} className="min-h-[42px] bg-black/22 hover:bg-black/28 py-2 rounded-full text-rose-100 border border-rose-300/22 text-[11px]">SET MULTIPLIER</button>
                                <button onClick={handleBroadcast} className="min-h-[42px] bg-black/22 hover:bg-black/28 py-2 rounded-full text-rose-100 border border-rose-300/22 text-[11px]">BROADCAST</button>
                            </div>
                        </div>
                    )}

                    {/* Feedback */}
                    <div className="bg-black/18 p-3 rounded-[1rem] border border-white/8 mt-4">
                        <div className="text-[11px] font-bold text-slate-300/76 mb-2 font-rajdhani tracking-[0.16em]">System Feedback</div>
                        {feedbackStatus && (
                            <div className={`text-xs mb-2 px-2 py-1 rounded border ${feedbackStatusClass}`}>{feedbackStatus.text}</div>
                        )}
                        <textarea
                            placeholder="Report anomalies..."
                            className="w-full bg-black/24 border border-white/8 rounded-[0.95rem] p-2.5 text-sm text-slate-200/84 h-24 resize-none focus:outline-none focus:border-[#7dd4d8]/24 placeholder:text-slate-500 font-fira"
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            maxLength={500}
                        />
                        <Motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={submitFeedback}
                            className="w-full mt-2 min-h-[42px] bg-emerald-300/10 hover:bg-emerald-300/16 py-2 rounded-full text-emerald-100 text-sm border border-emerald-300/24 font-bold tracking-[0.16em]"
                        >
                            TRANSMIT
                        </Motion.button>
                    </div>
                </>
            )}
        </Motion.div>
    );
};

export default SystemTab;
