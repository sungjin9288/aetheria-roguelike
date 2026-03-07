import React, { useState, useCallback } from 'react';
import { Crown, Skull, Shield, Save } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { APP_ID } from '../../data/constants';
import { exportToJson } from '../../utils/fileUtils';
import { getTitleColor, getTitleLabel } from '../../utils/gameUtils';
import { RARITY_COLORS } from '../../data/titles';
import { FeedbackValidator } from '../../systems/FeedbackValidator';

const _SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

/**
 * SystemTab — Dashboard의 system 탭 콘텐츠 (#4 분리)
 * props: player, actions, stats
 */
const SystemTab = ({ player, actions, stats }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState(null);

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
        ? 'text-red-400 border-red-500/30 bg-red-950/20'
        : 'text-cyber-green border-cyber-green/30 bg-cyber-green/10';

    return (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-2">
            {/* 세션 정보 */}
            <div className="text-xs text-cyber-blue/40 mb-2 font-fira border-l-2 border-cyber-blue/10 pl-3">
                <p>SESSION: {_SESSION_ID}</p>
                <p>UID: {actions.getUid()}</p>
                <p>BUILD: v5.0 (STABLE)</p>
                {(player.meta?.prestigeRank || 0) > 0 && (
                    <p className="text-purple-400 mt-1">PRESTIGE: {player.meta.prestigeRank}회 환생 완료</p>
                )}
            </div>

            {/* 유물 */}
            {(player.relics || []).length > 0 && (
                <div className="bg-purple-950/30 border border-purple-700/30 rounded-lg p-3">
                    <div className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-2">
                        ✦ 보유 유물 ({player.relics.length}/5)
                    </div>
                    <div className="space-y-1">
                        {player.relics.map((r) => (
                            <div key={r.id} className="flex items-start gap-2 text-xs">
                                <span className={`font-bold shrink-0 ${RARITY_COLORS[r.rarity] || 'text-slate-300'}`}>{r.name}</span>
                                <span className="text-gray-400">{r.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 칭호 */}
            {(player.titles || []).length > 0 && (
                <div className="bg-cyber-dark/40 border border-yellow-700/30 rounded-lg p-3">
                    <div className="text-xs font-bold text-yellow-500 mb-2 flex items-center gap-2">🏆 보유 칭호 ({player.titles.length})</div>
                    <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                        {player.titles.map((id) => {
                            const isActive = player.activeTitle === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => actions.setActiveTitle?.(isActive ? null : id)}
                                    className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${isActive ? 'bg-yellow-900/40 border border-yellow-600/50' : 'hover:bg-gray-800/50'}`}
                                >
                                    <span className={`font-bold ${getTitleColor(id)}`}>[{getTitleLabel(id)}]</span>
                                    {isActive && <span className="text-yellow-500 text-[10px] ml-2">활성</span>}
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
                const today = new Date().toISOString().slice(0, 10);
                if (dp.date !== today) return null;
                return (
                    <div className="bg-cyan-950/30 border border-cyan-700/30 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-xs font-bold text-cyan-400">📋 일일 프로토콜</div>
                            {dp.relicShards > 0 && <span className="text-xs text-purple-400">{dp.relicShards}/5 조각</span>}
                        </div>
                        <div className="space-y-2">
                            {dp.missions.map((m) => {
                                const pct = Math.min(100, ((m.progress || 0) / Math.max(1, m.goal)) * 100);
                                const rewardText = m.reward.essence ? `에센스 ${m.reward.essence}` : m.reward.item || (m.reward.relicShard ? '유물 조각' : '');
                                return (
                                    <div key={m.id}>
                                        <div className="flex justify-between text-[10px] mb-0.5">
                                            <span className={m.done ? 'text-cyan-400 line-through' : 'text-gray-300'}>
                                                {m.type === 'kills' ? `처치 ${m.goal}` : m.type === 'explores' ? `탐색 ${m.goal}` : `골드 지출 ${m.goal}`}
                                            </span>
                                            <span className="text-gray-500">{m.progress}/{m.goal} → {rewardText}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${m.done ? 'bg-cyan-400' : 'bg-cyan-700'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Hall of Fame */}
            <div className="bg-cyber-black/40 p-3 rounded border border-yellow-500/20 mb-2 relative overflow-hidden">
                <div className="text-xs font-bold text-yellow-500 mb-3 flex items-center gap-2 font-rajdhani tracking-wider"><Crown size={12} /> HALL OF FAME</div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => {
                        const isMe = ranker.nickname === player.name;
                        return (
                            <div key={i} className={`flex justify-between text-[10px] border-b border-cyber-blue/5 pb-1 last:border-0 p-1 rounded transition-colors font-fira ${isMe ? 'bg-cyber-green/10 border-l-2 border-l-cyber-green pl-2' : 'hover:bg-cyber-blue/5 text-cyber-blue/70'}`}>
                                <span className="flex gap-2 items-center min-w-0">
                                    <span className={`w-4 text-center font-bold shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                    <span className={`truncate ${isMe ? 'text-cyber-green font-bold' : 'text-white'}`}>
                                        {ranker.nickname}
                                        {ranker.activeTitle && <span className="text-cyber-purple/70 ml-1">[{getTitleLabel(ranker.activeTitle)}]</span>}
                                        {isMe && <span className="text-cyber-green ml-1">◀</span>}
                                    </span>
                                </span>
                                <span className="flex gap-2 items-center shrink-0 ml-1">
                                    {ranker.prestigeRank > 0 && <span className="text-cyber-purple text-[9px]">⚡{ranker.prestigeRank}</span>}
                                    <span className="text-red-400 flex items-center gap-1"><Skull size={8} /> {(ranker.totalKills || 0).toLocaleString()}</span>
                                </span>
                            </div>
                        );
                    }) : <div className="text-xs text-cyber-blue/30 text-center font-fira animate-pulse">SYNCING NETWORK...</div>}
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
                className="w-full bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue py-3 rounded-sm border border-cyber-blue/30 flex items-center justify-center gap-2 font-rajdhani font-bold tracking-wider transition-all hover:shadow-[0_0_15px_rgba(0,204,255,0.3)] min-h-[44px]"
            >
                <Save size={16} /> DOWNLOAD LOGS
            </Motion.button>

            {/* Admin */}
            {actions.isAdmin() && (
                <div className="bg-red-950/20 p-3 rounded border border-red-500/30 mt-4">
                    <div className="text-xs font-bold text-red-400 mb-2 font-rajdhani flex items-center gap-2"><Shield size={12} /> ADMIN CONTROLS</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleSetMultiplier} className="min-h-[44px] bg-red-900/50 hover:bg-red-800/50 py-2 rounded text-white border border-red-500/30 text-xs">SET MULTIPLIER</button>
                        <button onClick={handleBroadcast} className="min-h-[44px] bg-red-900/50 hover:bg-red-800/50 py-2 rounded text-white border border-red-500/30 text-xs">BROADCAST</button>
                    </div>
                </div>
            )}

            {/* Feedback */}
            <div className="bg-cyber-black/40 p-3 rounded border border-cyber-green/20 mt-4">
                <div className="text-xs font-bold text-cyber-green/70 mb-2 font-rajdhani">System Feedback</div>
                {feedbackStatus && (
                    <div className={`text-xs mb-2 px-2 py-1 rounded border ${feedbackStatusClass}`}>{feedbackStatus.text}</div>
                )}
                <textarea
                    placeholder="Report anomalies..."
                    className="w-full bg-cyber-black/80 border border-cyber-green/20 rounded p-2 text-sm text-cyber-blue/80 h-24 resize-none focus:outline-none focus:border-cyber-green/50 placeholder:text-cyber-green/20 font-fira"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    maxLength={500}
                />
                <Motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={submitFeedback}
                    className="w-full mt-2 min-h-[44px] bg-cyber-green/10 hover:bg-cyber-green/20 py-2 rounded text-cyber-green text-sm border border-cyber-green/30 font-bold tracking-wider"
                >
                    TRANSMIT
                </Motion.button>
            </div>
        </Motion.div>
    );
};

export default SystemTab;
