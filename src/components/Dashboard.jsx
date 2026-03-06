import React, { useCallback, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { User, Crown, Skull, Save, Package, Scroll, Shield, Zap, Sword, Map, Trophy, BookOpen, BarChart3, Eye } from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { DB } from '../data/db';
import { APP_ID } from '../data/constants';
import { exportToJson } from '../utils/fileUtils';
import { formatRewardParts, getActiveQuestEntries, getTitleColor, getTitleLabel } from '../utils/gameUtils';
import { RARITY_COLORS } from '../data/titles';
import { FeedbackValidator } from '../systems/FeedbackValidator';
import SmartInventory from './SmartInventory';
import AchievementPanel from './AchievementPanel';
import SkillTreePreview from './SkillTreePreview';
import MapNavigator from './MapNavigator';
import StatsPanel from './StatsPanel';
import Bestiary from './Bestiary';

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
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState(null);
    const [statusCollapsed, setStatusCollapsed] = useState(false);
    const today = new Date().toISOString().slice(0, 10);
    const isInSafeZone = DB.MAPS[player?.loc]?.type === 'safe';
    const activeQuestEntries = getActiveQuestEntries(player);
    const claimableQuestCount = activeQuestEntries.filter((entry) => entry.isComplete).length;
    const hasActiveBounty = activeQuestEntries.some((entry) => entry.isBounty);
    const bountyIssuedToday = player?.stats?.bountyDate === today && player?.stats?.bountyIssued;
    const canRequestBounty = !hasActiveBounty && !bountyIssuedToday;
    const bountyButtonLabel = hasActiveBounty
        ? 'DAILY BOUNTY ACTIVE'
        : bountyIssuedToday
            ? 'BOUNTY CLAIMED TODAY'
            : 'REQUEST DAILY BOUNTY';
    const bountyHelperText = hasActiveBounty
        ? '진행 중인 현상수배를 완료하면 다음 의뢰를 받을 수 있습니다.'
        : bountyIssuedToday
            ? '오늘은 이미 현상수배를 발급했습니다. 내일 다시 요청하세요.'
            : '현재 레벨 기준 토벌 의뢰를 자동 생성합니다.';

    // groupedInv kept for potential custom rendering outside SmartInventory
    // eslint-disable-next-line no-unused-vars
    const groupedInv = player.inv.reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
    }, {});

    const sessionId = _SESSION_ID;

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
        } catch {
            setFeedbackStatus({ type: 'error', text: 'Failed to update multiplier.' });
        }
    }, [actions.liveConfig, updateLiveConfig]);

    const handleBroadcast = useCallback(async () => {
        const raw = window.prompt('Announcement (max 100 chars):', actions.liveConfig?.announcement || '');
        if (raw === null) return;

        const text = raw.trim();
        if (!text) {
            setFeedbackStatus({ type: 'error', text: 'Announcement cannot be empty.' });
            return;
        }

        try {
            await updateLiveConfig({ announcement: text.slice(0, 100) });
            setFeedbackStatus({ type: 'success', text: 'Broadcast updated.' });
        } catch {
            setFeedbackStatus({ type: 'error', text: 'Failed to update broadcast.' });
        }
    }, [actions.liveConfig, updateLiveConfig]);

    const submitFeedback = useCallback(async () => {
        const validation = FeedbackValidator.validate(feedbackText);
        if (!validation.valid) {
            setFeedbackStatus({ type: 'error', text: validation.error });
            return;
        }

        try {
            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
            await addDoc(feedbackCol, {
                uid: actions.getUid(),
                nickname: player.name,
                message: feedbackText.trim(),
                statsSummary: {
                    level: player.level,
                    job: player.job,
                    kills: player.stats?.kills || 0
                },
                timestamp: serverTimestamp()
            });
            FeedbackValidator.markSubmitted();
            setFeedbackText('');
            setFeedbackStatus({ type: 'success', text: 'Transmission complete.' });
        } catch {
            setFeedbackStatus({ type: 'error', text: 'Transmission failed.' });
        }
    }, [actions, feedbackText, player.job, player.level, player.name, player.stats]);

    const feedbackStatusClass = feedbackStatus?.type === 'error'
        ? 'text-red-400 border-red-500/30 bg-red-950/20'
        : 'text-cyber-green border-cyber-green/30 bg-cyber-green/10';

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
                        <div className="flex flex-col h-full">
                            <div className="mb-3 rounded-lg border border-cyber-blue/20 bg-cyber-dark/30 p-3 shrink-0">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-fira">
                                    <span className="text-cyber-blue/80">진행 중 {activeQuestEntries.length}</span>
                                    <span className="text-cyber-green">보상 대기 {claimableQuestCount}</span>
                                    <span className="text-cyber-purple">{isInSafeZone ? '안전 지대' : '필드 지역'}</span>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => actions.requestBounty()}
                                        disabled={!canRequestBounty}
                                        className="min-h-[44px] w-full rounded border border-amber-500/30 bg-amber-500/10 py-2 text-xs font-rajdhani font-bold text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)] transition-all hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-1"
                                    >
                                        <Sword size={14} /> {bountyButtonLabel}
                                    </Motion.button>
                                    <Motion.button
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => actions.setGameState?.('quest_board')}
                                        disabled={!isInSafeZone}
                                        className="min-h-[44px] w-full rounded border border-cyber-blue/30 bg-cyber-blue/10 py-2 text-xs font-rajdhani font-bold text-cyber-blue transition-all hover:bg-cyber-blue/20 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-1"
                                    >
                                        <Scroll size={14} /> {isInSafeZone ? 'OPEN QUEST BOARD' : 'SAFE ZONE ONLY'}
                                    </Motion.button>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-400 font-fira">{bountyHelperText}</div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                                {activeQuestEntries.length > 0 ? (
                                    activeQuestEntries.map((entry, i) => {
                                        return (
                                            <Motion.div
                                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                                key={entry.id}
                                                className={`p-3 rounded-sm border mb-2 transition-all ${entry.isComplete ? 'bg-cyber-green/10 border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,157,0.1)]' : entry.isBounty ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyber-dark/40 border-cyber-blue/10'}`}
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className={`font-bold text-sm font-rajdhani ${entry.isComplete ? 'text-cyber-green' : entry.isBounty ? 'text-amber-300' : 'text-cyber-blue'}`}>{entry.quest.title}</div>
                                                            {entry.isBounty && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-fira text-amber-300">현상수배</span>}
                                                        </div>
                                                        <div className="text-xs text-cyber-blue/50 mt-1">{entry.quest.desc}</div>
                                                        <div className="mt-2 text-[11px] text-slate-300 font-fira">목표: {getQuestObjectiveText(entry.quest)}</div>
                                                        <QuestRewardChips reward={entry.quest.reward} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} />
                                                        <div className="mt-3">
                                                            <div className="mb-1 flex justify-between text-[10px] font-fira">
                                                                <span className={entry.isComplete ? 'text-cyber-green' : 'text-cyber-blue/60'}>{getQuestProgressText(entry.quest, entry.progress)}</span>
                                                                <span className="text-slate-500">{entry.progress}/{entry.quest.goal}</span>
                                                            </div>
                                                            <div className="h-1.5 overflow-hidden rounded-full bg-cyber-black/50">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${entry.isComplete ? 'bg-cyber-green' : entry.isBounty ? 'bg-amber-400' : 'bg-cyber-blue'}`}
                                                                    style={{ width: `${getQuestProgressPercent(entry.progress, entry.quest.goal)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {entry.isComplete ? (
                                                        <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(entry.id)} className={`px-4 py-2 bg-cyber-green hover:bg-emerald-400 text-cyber-black font-bold text-xs rounded-sm animate-pulse shadow-neon-green min-h-[44px] shrink-0`}>CLAIM REWARD</Motion.button>
                                                    ) : (
                                                        <div className="text-xs text-cyber-blue/50 font-fira bg-cyber-black/50 px-2 py-1 rounded border border-cyber-blue/10 shrink-0">진행 중</div>
                                                    )}
                                                </div>
                                            </Motion.div>
                                        );
                                    })
                                ) : (
                                    <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyber-blue/30 text-center py-10 flex flex-col items-center gap-2">
                                        <Scroll size={24} className="opacity-20" />
                                        <span className="text-sm font-rajdhani tracking-widest">NO ACTIVE MISSIONS</span>
                                        <span className="text-[11px] text-cyber-blue/40 font-fira">
                                            {isInSafeZone ? 'QUEST BOARD를 열어 새 임무를 수락하세요.' : '안전 지대로 이동하면 퀘스트를 수락할 수 있습니다.'}
                                        </span>
                                    </Motion.div>
                                )}
                            </div>
                        </div>
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
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-2">
                            <div className="text-xs text-cyber-blue/40 mb-2 font-fira border-l-2 border-cyber-blue/10 pl-3">
                                <p>SESSION: {sessionId}</p>
                                <p>UID: {actions.getUid()}</p>
                                <p>BUILD: v4.0 (STABLE)</p>
                                {(player.meta?.prestigeRank || 0) > 0 && (
                                    <p className="text-purple-400 mt-1">PRESTIGE: {player.meta.prestigeRank}회 환생 완료</p>
                                )}
                            </div>

                            {/* v4.0: 현재 런 유물 */}
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

                            {/* v4.0: 칭호 시스템 */}
                            {(player.titles || []).length > 0 && (
                                <div className="bg-cyber-dark/40 border border-yellow-700/30 rounded-lg p-3">
                                    <div className="text-xs font-bold text-yellow-500 mb-2 flex items-center gap-2">
                                        🏆 보유 칭호 ({player.titles.length})
                                    </div>
                                    <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                                        {player.titles.map((id) => {
                                            const isActive = player.activeTitle === id;
                                            const titleLabel = getTitleLabel(id);
                                            const titleColor = getTitleColor(id);
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => actions.setActiveTitle?.(isActive ? null : id)}
                                                    className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${isActive ? 'bg-yellow-900/40 border border-yellow-600/50' : 'hover:bg-gray-800/50'}`}
                                                >
                                                    <span className={`font-bold ${titleColor}`}>[{titleLabel}]</span>
                                                    {isActive && <span className="text-yellow-500 text-[10px] ml-2">활성</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* v4.0: 일일 프로토콜 */}
                            {(() => {
                                const dp = player.stats?.dailyProtocol;
                                if (!dp || !dp.missions?.length) return null;
                                const today = new Date().toISOString().slice(0, 10);
                                if (dp.date !== today) return null;
                                return (
                                    <div className="bg-cyan-950/30 border border-cyan-700/30 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-xs font-bold text-cyan-400">
                                                📋 일일 프로토콜
                                            </div>
                                            {dp.relicShards > 0 && (
                                                <span className="text-xs text-purple-400">{dp.relicShards}/5 조각</span>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {dp.missions.map((m) => {
                                                const pct = Math.min(100, ((m.progress || 0) / Math.max(1, m.goal)) * 100);
                                                const rewardText = m.reward.essence
                                                    ? `에센스 ${m.reward.essence}`
                                                    : m.reward.item || (m.reward.relicShard ? '유물 조각' : '');
                                                return (
                                                    <div key={m.id}>
                                                        <div className="flex justify-between text-[10px] mb-0.5">
                                                            <span className={m.done ? 'text-cyan-400 line-through' : 'text-gray-300'}>
                                                                {m.type === 'kills' ? `처치 ${m.goal}` : m.type === 'explores' ? `탐색 ${m.goal}` : `골드 지출 ${m.goal}`}
                                                            </span>
                                                            <span className="text-gray-500">{m.progress}/{m.goal} → {rewardText}</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${m.done ? 'bg-cyan-400' : 'bg-cyan-700'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* HONOR OF FAME — v5.0: 모바일 포함, 프레스티지/칭호 표시, "YOU" 마킹 */}
                            <div className="bg-cyber-black/40 p-3 rounded border border-yellow-500/20 mb-2 relative overflow-hidden">
                                <div className="text-xs font-bold text-yellow-500 mb-3 flex items-center gap-2 font-rajdhani tracking-wider"><Crown size={12} /> HALL OF FAME</div>
                                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => {
                                        const isMe = ranker.nickname === player.name;
                                        return (
                                            <div key={i} className={`flex justify-between text-[10px] border-b border-cyber-blue/5 pb-1 last:border-0 p-1 rounded transition-colors font-fira
                                                ${isMe ? 'bg-cyber-green/10 border-l-2 border-l-cyber-green pl-2' : 'hover:bg-cyber-blue/5 text-cyber-blue/70'}`}>
                                                <span className="flex gap-2 items-center min-w-0">
                                                    <span className={`w-4 text-center font-bold shrink-0 ${i === 0 ? 'text-yellow-400 drop-shadow-md' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
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

                            <Motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    const exportData = {
                                        timestamp: new Date().toISOString(),
                                        summary: { name: player.name, level: player.level, job: player.job, gold: player.gold, playtime: "N/A" },
                                        stats: stats,
                                        equipment: player.equip,
                                        history: [...(player.archivedHistory || []), ...player.history]
                                    };
                                    exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                                }}
                                className="w-full bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue py-3 rounded-sm border border-cyber-blue/30 flex items-center justify-center gap-2 font-rajdhani font-bold tracking-wider transition-all hover:shadow-[0_0_15px_rgba(0,204,255,0.3)] min-h-[44px]"
                            >
                                <Save size={16} /> DOWNLOAD LOGS
                            </Motion.button>

                            {actions.isAdmin() && (
                                <div className="bg-red-950/20 p-3 rounded border border-red-500/30 mt-4">
                                    <div className="text-xs font-bold text-red-400 mb-2 font-rajdhani flex items-center gap-2"><Shield size={12} /> ADMIN CONTROLS</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={handleSetMultiplier} className="min-h-[44px] bg-red-900/50 hover:bg-red-800/50 py-2 rounded text-white border border-red-500/30 text-xs">SET MULTIPLIER</button>
                                        <button onClick={handleBroadcast} className="min-h-[44px] bg-red-900/50 hover:bg-red-800/50 py-2 rounded text-white border border-red-500/30 text-xs">BROADCAST</button>
                                    </div>
                                </div>
                            )}

                            {/* FEEDBACK FORM */}
                            <div className="bg-cyber-black/40 p-3 rounded border border-cyber-green/20 mt-4">
                                <div className="text-xs font-bold text-cyber-green/70 mb-2 font-rajdhani">System Feedback</div>
                                {feedbackStatus && (
                                    <div className={`text-xs mb-2 px-2 py-1 rounded border ${feedbackStatusClass}`}>
                                        {feedbackStatus.text}
                                    </div>
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
