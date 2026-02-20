import React, { useCallback, useMemo, useState } from 'react';
import { User, Crown, Skull, Save, Package, Scroll, Shield, Zap, Sword } from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { DB } from '../data/db';
import { APP_ID } from '../data/constants';
import { exportToJson } from '../utils/fileUtils';
import { FeedbackValidator } from '../systems/FeedbackValidator';

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

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState(null);

    const groupedInv = player.inv.reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
    }, {});

    const sessionId = useMemo(() => Date.now().toString(36).toUpperCase(), []);

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
        const btnClass = isMobile
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
                    {sideTab === 'inventory' && Object.entries(groupedInv).map(([name, count], i) => {
                        const item = player?.inv?.find(it => it.name === name);
                        if (!item) return null;
                        return (
                            <Motion.div
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                key={i}
                                className="bg-cyber-dark/40 p-3 rounded-sm border border-cyber-blue/10 flex justify-between items-center group hover:border-cyber-green/50 hover:bg-cyber-green/5 transition-all cursor-pointer min-h-[50px]"
                            >
                                <span className={`text-sm font-fira ${item.tier >= 2 ? 'text-cyber-purple drop-shadow-sm' : 'text-cyber-blue/80'}`}>{name} <span className="text-cyber-blue/30 text-xs">x{count}</span></span>
                                <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.useItem(item)} className={btnClass}>USE</Motion.button>
                            </Motion.div>
                        );
                    })}

                    {sideTab === 'quest' && (
                        player?.quests?.length > 0 ? (
                            player.quests.map((pq, i) => {
                                const qData = DB.QUESTS.find(q => q.id === pq.id);
                                if (!qData) return null;
                                const isComplete = pq.progress >= qData.goal;
                                return (
                                    <Motion.div
                                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                                        key={i}
                                        className={`p-3 rounded-sm border mb-2 transition-all ${isComplete ? 'bg-cyber-green/10 border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,157,0.1)]' : 'bg-cyber-dark/40 border-cyber-blue/10'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className={`font-bold text-sm font-rajdhani ${isComplete ? 'text-cyber-green' : 'text-cyber-blue'}`}>{qData.title}</div>
                                                <div className="text-xs text-cyber-blue/50 mt-1">{qData.desc}</div>
                                            </div>
                                            {isComplete ? (
                                                <Motion.button whileTap={{ scale: 0.95 }} onClick={() => actions.completeQuest(pq.id)} className={`px-4 py-2 bg-cyber-green hover:bg-emerald-400 text-cyber-black font-bold text-xs rounded-sm animate-pulse shadow-neon-green min-h-[44px]`}>CLAIM REWARD</Motion.button>
                                            ) : (
                                                <div className="text-xs text-cyber-blue/50 font-fira bg-cyber-black/50 px-2 py-1 rounded border border-cyber-blue/10">{pq.progress} / {qData.goal}</div>
                                            )}
                                        </div>
                                    </Motion.div>
                                );
                            })
                        ) : (
                            <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyber-blue/30 text-center py-10 flex flex-col items-center gap-2">
                                <Scroll size={24} className="opacity-20" />
                                <span className="text-sm font-rajdhani tracking-widest">NO ACTIVE MISSIONS</span>
                            </Motion.div>
                        )
                    )}

                    {sideTab === 'system' && (
                        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-2">
                            <div className="text-xs text-cyber-blue/40 mb-2 font-fira border-l-2 border-cyber-blue/10 pl-3">
                                <p>SESSION: {sessionId}</p>
                                <p>UID: {actions.getUid()}</p>
                                <p>BUILD: v3.5.1 (STABLE)</p>
                            </div>

                            {/* HONOR OF FAME */}
                            {!isMobile && (
                                <div className="bg-cyber-black/40 p-3 rounded border border-yellow-500/20 mb-2 relative overflow-hidden">
                                    <div className="text-xs font-bold text-yellow-500 mb-3 flex items-center gap-2 font-rajdhani tracking-wider"><Crown size={12} /> HALL OF FAME</div>
                                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                        {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => (
                                            <div key={i} className="flex justify-between text-[10px] text-cyber-blue/70 border-b border-cyber-blue/5 pb-1 last:border-0 hover:bg-cyber-blue/5 p-1 rounded transition-colors font-fira">
                                                <span className="flex gap-2">
                                                    <span className={`w-4 text-center font-bold ${i === 0 ? 'text-yellow-400 drop-shadow-md' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                                    <span className="text-white">{ranker.nickname}</span>
                                                </span>
                                                <span className="flex gap-3 items-center">
                                                    <span className="text-red-400 flex items-center gap-1"><Skull size={8} /> {ranker.totalKills}</span>
                                                </span>
                                            </div>
                                        )) : <div className="text-xs text-cyber-blue/30 text-center font-fira animate-pulse">SYNCING NETWORK...</div>}
                                    </div>
                                </div>
                            )}

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
                    <ProgressBar value={player?.hp} max={player?.maxHp} variant="hp" label="VIT (HP)" />
                    <ProgressBar value={player?.mp} max={player?.maxMp} variant="mp" label="NRG (MP)" />
                </div>

                <div className="border-t border-cyber-blue/20 pt-4">
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
                        {['inventory', 'quest', 'system'].map(tab => (
                            <Motion.button
                                whileTap={{ scale: 0.95 }}
                                key={tab}
                                onClick={() => setSideTab(tab)}
                                className={`min-h-[44px] flex-1 text-xs px-2 py-2 rounded border uppercase font-bold tracking-wider transition-all
                                    ${sideTab === tab
                                        ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-[0_0_10px_rgba(0,204,255,0.4)]'
                                        : 'text-cyber-blue/50 border-cyber-blue/30 hover:border-cyber-blue/70 bg-cyber-dark/40'}`}
                            >
                                {tab}
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
        <aside className="hidden md:flex flex-col gap-4 h-full min-h-0 w-full transition-all duration-300">
            {/* STATUS PANEL */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-5 rounded-lg shadow-[0_0_20px_rgba(0,204,255,0.15)] relative overflow-x-hidden overflow-y-auto custom-scrollbar group max-h-[clamp(20rem,52dvh,36rem)]"
            >
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity duration-700">
                    <User size={80} className="text-cyber-blue" />
                </div>

                <h3 className="text-cyber-green font-rajdhani font-bold text-lg mb-4 flex items-center gap-2 tracking-[0.2em] border-b border-cyber-green/20 pb-2">
                    <span className="w-2 h-2 bg-cyber-green rounded-full animate-pulse shadow-[0_0_10px_#00ff9d]"></span>
                    AGENT STATUS
                </h3>

                <div className="space-y-4">
                    <div className="flex flex-col font-rajdhani">
                        <span className="text-2xl text-white font-bold tracking-wider drop-shadow-md">{player?.name}</span>
                        <div className="flex justify-between items-center text-xs mt-1">
                            <span className="text-cyber-purple font-fira uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/30 drop-shadow-sm">{player?.job}</span>
                            <span className="text-cyber-blue">LEVEL {player?.level}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-cyber-dark/80 p-2 rounded border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                        <div className="w-2 h-2 bg-yellow-400 rotate-45 animate-pulse"></div>
                        <span className="font-fira text-yellow-400 font-bold tracking-wider">{player?.gold} CR</span>
                    </div>

                    <div className="space-y-4 mt-2">
                        <ProgressBar value={player?.hp} max={player?.maxHp} variant="hp" label="VITALITY" />
                        <ProgressBar value={player?.mp} max={player?.maxMp} variant="mp" label="ENERGY" />
                        <ProgressBar value={player?.exp} max={player?.nextExp} variant="exp" label="EXPERIENCE" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-cyber-blue/10">
                        <div className="bg-cyber-dark/30 p-2 rounded border border-cyber-blue/10 hover:border-cyber-blue/30 transition-colors">
                            <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-1 flex items-center gap-1"><Sword size={10} /> {stats?.isMagic ? 'M.ATK' : 'ATK'}</div>
                            <div className="text-white font-fira font-bold text-lg">{stats?.atk} <span className="text-[10px] text-cyber-purple font-normal">({stats?.elem})</span></div>
                        </div>
                        <div className="bg-cyber-dark/30 p-2 rounded border border-cyber-blue/10 hover:border-cyber-blue/30 transition-colors">
                            <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-1 flex items-center gap-1"><Shield size={10} /> DEF</div>
                            <div className="text-white font-fira font-bold text-lg">{stats?.def}</div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs font-fira text-cyber-blue/60 border-t border-cyber-blue/10 pt-3">
                        <div className="flex justify-between"><span>WPN:</span> <span className="text-white">{player?.equip?.weapon?.name || 'UNARMED'} {stats?.weaponHands === 2 ? '(2H)' : ''}</span></div>
                        <div className="flex justify-between"><span>SUB:</span> <span className="text-white">{player?.equip?.offhand?.name || '---'}</span></div>
                        <div className="flex justify-between"><span>ARM:</span> <span className="text-white">{player?.equip?.armor?.name || 'CIVILIAN'}</span></div>
                    </div>
                </div>
            </Motion.div>

            {/* TABS */}
            <Motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-4 rounded-lg flex-1 min-h-0 overflow-hidden flex flex-col shadow-[0_0_20px_rgba(0,204,255,0.1)]"
            >
                <div className="flex gap-2 mb-4 border-b border-cyber-blue/20 pb-3">
                    {[{ id: 'inventory', icon: Package }, { id: 'quest', icon: Scroll }, { id: 'system', icon: Zap }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSideTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold font-rajdhani uppercase tracking-wider rounded-sm transition-all
                                ${sideTab === tab.id
                                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 shadow-[0_0_10px_rgba(0,204,255,0.3)]'
                                    : 'text-cyber-blue/30 hover:text-cyber-blue/70 hover:bg-cyber-blue/5'}`}
                        >
                            <tab.icon size={14} />
                            {tab.id}
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
