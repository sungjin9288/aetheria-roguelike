import React from 'react';
import { User, Crown, Skull, Save, Package, Scroll, Shield, Zap, Sword } from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DB } from '../data/db';
import { APP_ID } from '../data/constants';
import { exportToJson } from '../utils/fileUtils';
import { FeedbackValidator } from '../systems/FeedbackValidator';

const Dashboard = ({ player, sideTab, setSideTab, actions, stats, mobile = false }) => {
    // Inventory Grouping
    const groupedInv = player.inv.reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
    }, {});

    const ProgressBar = ({ value, max, color, label }) => (
        <div className="relative w-full">
            <div className="flex justify-between text-[10px] uppercase font-bold mb-0.5 text-cyber-blue/70">
                <span>{label}</span>
                <span>{value}/{max}</span>
            </div>
            <div className={`w-full h-2 bg-cyber-dark/50 rounded-sm overflow-hidden border border-${color}/30 relative`}>
                <div
                    className={`h-full transition-all duration-500 ease-out bg-gradient-to-r from-${color}/50 to-${color} shadow-[0_0_10px_rgba(var(--color-${color}),0.5)]`}
                    style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                ></div>
            </div>
        </div>
    );

    if (mobile) {
        return (
            <div className="md:hidden mt-3 bg-cyber-black/80 backdrop-blur-md border border-cyber-blue/30 rounded-lg p-3 space-y-3 shadow-neon-blue/20">
                <div>
                    <h3 className="text-cyber-green font-rajdhani font-bold text-sm mb-2 flex items-center gap-2 tracking-widest">
                        <User size={14} /> AGENT: {player?.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs font-fira text-cyber-blue/80 mb-2">
                        <div><span className="text-cyber-purple">{player?.job}</span> <span className="text-slate-500">Lv.{player?.level}</span></div>
                        <div className="text-right text-yellow-400 font-bold">{player?.gold} CR</div>
                    </div>
                    <div className="space-y-3">
                        <ProgressBar value={player?.hp} max={player?.maxHp} color="red-500" label="VIT (HP)" />
                        <ProgressBar value={player?.mp} max={player?.maxMp} color="blue-500" label="NRG (MP)" />
                    </div>
                </div>

                <div className="border-t border-cyber-blue/20 pt-3">
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                        {['inventory', 'quest', 'system'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSideTab(tab)}
                                className={`text-[10px] px-3 py-1 rounded-sm border uppercase font-bold tracking-wider transition-all
                                    ${sideTab === tab
                                        ? 'text-cyber-black bg-cyber-blue border-cyber-blue shadow-neon-blue'
                                        : 'text-cyber-blue/50 border-cyber-blue/30 hover:border-cyber-blue/70'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                        {sideTab === 'inventory' && Object.entries(groupedInv).map(([name, count], i) => {
                            const item = player?.inv?.find(it => it.name === name);
                            if (!item) return null;
                            return (
                                <div key={i} className="bg-cyber-dark/40 p-2 rounded-sm border border-cyber-blue/10 flex justify-between items-center group hover:border-cyber-green/50 transition-colors">
                                    <span className={`text-xs font-fira ${item.tier >= 2 ? 'text-cyber-purple' : 'text-cyber-blue/80'}`}>{name} x{count}</span>
                                    <button onClick={() => actions.useItem(item)} className="text-[10px] bg-cyber-blue/10 hover:bg-cyber-blue/30 text-cyber-blue px-2 py-1 rounded border border-cyber-blue/30">USE</button>
                                </div>
                            );
                        })}

                        {sideTab === 'quest' && (
                            player?.quests?.length > 0 ? (
                                player.quests.map((pq, i) => {
                                    const qData = DB.QUESTS.find(q => q.id === pq.id);
                                    if (!qData) return null;
                                    const isComplete = pq.progress >= qData.goal;
                                    return (
                                        <div key={i} className={`p-2 rounded-sm border ${isComplete ? 'bg-cyber-green/10 border-cyber-green/50' : 'bg-cyber-dark/40 border-cyber-blue/10'}`}>
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <div className={`font-bold text-xs ${isComplete ? 'text-cyber-green' : 'text-cyber-blue'}`}>{qData.title}</div>
                                                    <div className="text-[10px] text-cyber-blue/50 mt-1">{qData.desc}</div>
                                                </div>
                                                {isComplete ? (
                                                    <button onClick={() => actions.completeQuest(pq.id)} className="px-2 py-1 bg-cyber-green hover:bg-emerald-400 text-cyber-black font-bold text-[10px] rounded animate-pulse">CLAIM</button>
                                                ) : (
                                                    <div className="text-[10px] text-cyber-blue/50 font-fira">{pq.progress} / {qData.goal}</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-cyber-blue/30 text-center py-3 text-xs font-rajdhani">NO ACTIVE MISSIONS</div>
                            )
                        )}

                        {sideTab === 'system' && (
                            <div className="space-y-2">
                                <div className="text-[10px] text-cyber-blue/50 font-fira border-l-2 border-cyber-blue/20 pl-2">
                                    <p>ID: {actions.getUid()?.slice(0, 8)}...</p>
                                    <p>VER: v3.5 (MOBILE)</p>
                                </div>
                                <button
                                    onClick={() => {
                                        const exportData = {
                                            timestamp: new Date().toISOString(),
                                            summary: {
                                                name: player.name,
                                                level: player.level,
                                                job: player.job,
                                                gold: player.gold,
                                                playtime: "N/A"
                                            },
                                            stats: stats,
                                            equipment: player.equip,
                                            history: [...(player.archivedHistory || []), ...player.history]
                                        };
                                        exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                                    }}
                                    className="w-full bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue py-2 rounded-sm border border-cyber-blue/30 flex items-center justify-center gap-2 text-xs font-rajdhani font-bold"
                                >
                                    <Save size={14} /> DOWNLOAD LOGS
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <aside className="w-80 min-w-[320px] hidden md:flex flex-col gap-4 h-full">
            {/* STATUS PANEL */}
            <div className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-5 rounded-lg shadow-[0_0_15px_rgba(0,204,255,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20">
                    <User size={64} className="text-cyber-blue" />
                </div>

                <h3 className="text-cyber-green font-rajdhani font-bold text-lg mb-4 flex items-center gap-2 tracking-[0.2em] border-b border-cyber-green/20 pb-2">
                    <span className="w-2 h-2 bg-cyber-green rounded-full animate-pulse"></span>
                    AGENT STATUS
                </h3>

                <div className="space-y-4">
                    <div className="flex flex-col font-rajdhani">
                        <span className="text-2xl text-white font-bold tracking-wider">{player?.name}</span>
                        <div className="flex justify-between items-center text-xs mt-1">
                            <span className="text-cyber-purple font-fira uppercase bg-cyber-purple/10 px-2 py-0.5 rounded border border-cyber-purple/30">{player?.job}</span>
                            <span className="text-cyber-blue">LEVEL {player?.level}</span>
                        </div>
                    </div>

                    {/* AVATAR DISPLAY */}
                    <div className="relative w-full aspect-square bg-cyber-dark/50 rounded-lg border border-cyber-blue/30 overflow-hidden shadow-[0_0_20px_rgba(0,204,255,0.1)] group">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                        <img
                            src={`/assets/avatar_${player?.gender || 'male'}.svg`}
                            alt="Avatar"
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700"
                        />
                        {/* Scanline overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-blue/5 to-transparent animate-scanline pointer-events-none"></div>

                        {/* Equipment Overlay (Simple Icons for now) */}
                        <div className="absolute bottom-2 right-2 flex gap-1">
                            {player?.equip?.weapon && (
                                <div className="p-1 bg-black/60 rounded border border-cyber-green/50" title={player.equip.weapon.name}>
                                    <Sword size={12} className="text-cyber-green" />
                                </div>
                            )}
                            {player?.equip?.armor && (
                                <div className="p-1 bg-black/60 rounded border border-cyber-purple/50" title={player.equip.armor.name}>
                                    <Shield size={12} className="text-cyber-purple" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-cyber-dark/80 p-2 rounded border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                        <div className="w-2 h-2 bg-yellow-400 rotate-45"></div>
                        <span className="font-fira text-yellow-400 font-bold tracking-wider">{player?.gold} CR</span>
                    </div>

                    <div className="space-y-4 mt-2">
                        <ProgressBar value={player?.hp} max={player?.maxHp} color="red-500" label="VITALITY" />
                        <ProgressBar value={player?.mp} max={player?.maxMp} color="blue-500" label="ENERGY" />
                        <ProgressBar value={player?.exp} max={player?.nextExp} color="purple-500" label="EXPERIENCE" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-cyber-blue/10">
                        <div className="bg-cyber-dark/30 p-2 rounded border border-cyber-blue/10">
                            <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-1 flex items-center gap-1"><Sword size={10} /> {stats?.isMagic ? 'M.ATK' : 'ATK'}</div>
                            <div className="text-white font-fira font-bold text-lg">{stats?.atk} <span className="text-[10px] text-cyber-purple font-normal">({stats?.elem})</span></div>
                        </div>
                        <div className="bg-cyber-dark/30 p-2 rounded border border-cyber-blue/10">
                            <div className="text-[10px] text-cyber-blue/50 font-bold uppercase mb-1 flex items-center gap-1"><Shield size={10} /> DEF</div>
                            <div className="text-white font-fira font-bold text-lg">{stats?.def}</div>
                        </div>
                    </div>

                    <div className="mt-4 space-y-1 text-xs font-fira text-cyber-blue/60 border-t border-cyber-blue/10 pt-2">
                        <div className="flex justify-between"><span>WPN:</span> <span className="text-white">{player?.equip?.weapon?.name || 'UNARMED'} {stats?.weaponHands === 2 ? '(2H)' : ''}</span></div>
                        <div className="flex justify-between"><span>SUB:</span> <span className="text-white">{player?.equip?.offhand?.name || '---'}</span></div>
                        <div className="flex justify-between"><span>ARM:</span> <span className="text-white">{player?.equip?.armor?.name || 'CIVILIAN'}</span></div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-cyber-black/80 backdrop-blur-xl border border-cyber-blue/30 p-4 rounded-lg flex-1 overflow-hidden flex flex-col shadow-neon-blue/10">
                <div className="flex gap-2 mb-4 border-b border-cyber-blue/20 pb-2">
                    {[{ id: 'inventory', icon: Package }, { id: 'quest', icon: Scroll }, { id: 'system', icon: Zap }].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSideTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold font-rajdhani uppercase tracking-wider rounded-sm transition-all
                                ${sideTab === tab.id
                                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50 shadow-[0_0_10px_rgba(0,204,255,0.2)]'
                                    : 'text-cyber-blue/30 hover:text-cyber-blue/70 hover:bg-cyber-blue/5'}`}
                        >
                            <tab.icon size={14} />
                            {tab.id}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {sideTab === 'inventory' && Object.entries(groupedInv).map(([name, count], i) => {
                        const item = player?.inv?.find(it => it.name === name);
                        if (!item) return null;
                        return (
                            <div key={i} className="bg-cyber-dark/40 p-3 rounded-sm border border-cyber-blue/10 flex justify-between items-center group hover:border-cyber-green/50 hover:bg-cyber-green/5 transition-all cursor-pointer">
                                <span className={`text-sm font-fira ${item.tier >= 2 ? 'text-cyber-purple drop-shadow-sm' : 'text-cyber-blue/80'}`}>{name} <span className="text-cyber-blue/30 text-xs">x{count}</span></span>
                                <button onClick={() => actions.useItem(item)} className="text-[10px] bg-cyber-blue/10 hover:bg-cyber-blue/30 text-cyber-blue px-3 py-1.5 rounded-sm border border-cyber-blue/30 font-bold tracking-wider">USE</button>
                            </div>
                        );
                    })}

                    {sideTab === 'quest' && (
                        player?.quests?.length > 0 ? (
                            player.quests.map((pq, i) => {
                                const qData = DB.QUESTS.find(q => q.id === pq.id);
                                if (!qData) return null;
                                const isComplete = pq.progress >= qData.goal;
                                return (
                                    <div key={i} className={`p-3 rounded-sm border mb-2 transition-all ${isComplete ? 'bg-cyber-green/10 border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,157,0.1)]' : 'bg-cyber-dark/40 border-cyber-blue/10'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className={`font-bold text-sm font-rajdhani ${isComplete ? 'text-cyber-green' : 'text-cyber-blue'}`}>{qData.title}</div>
                                                <div className="text-[10px] text-cyber-blue/50 mt-1">{qData.desc}</div>
                                            </div>
                                            {isComplete ? (
                                                <button onClick={() => actions.completeQuest(pq.id)} className="px-3 py-1 bg-cyber-green hover:bg-emerald-400 text-cyber-black font-bold text-xs rounded-sm animate-pulse shadow-neon-green">CLAIM REWARD</button>
                                            ) : (
                                                <div className="text-xs text-cyber-blue/50 font-fira bg-cyber-black/50 px-2 py-0.5 rounded border border-cyber-blue/10">{pq.progress} / {qData.goal}</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-cyber-blue/30 text-center py-10 flex flex-col items-center gap-2">
                                <Scroll size={24} className="opacity-20" />
                                <span className="text-xs font-rajdhani tracking-widest">NO ACTIVE MISSIONS</span>
                            </div>
                        )
                    )}

                    {sideTab === 'system' && (
                        <div className="space-y-4 p-2">
                            <div className="text-xs text-cyber-blue/40 mb-2 font-fira border-l-2 border-cyber-blue/10 pl-3">
                                <p>SESSION: {Date.now().toString(36).toUpperCase()}</p>
                                <p>UID: {actions.getUid()}</p>
                                <p>BUILD: v3.5.0 (STABLE)</p>
                            </div>

                            {/* HONOR OF FAME */}
                            <div className="bg-cyber-black/40 p-3 rounded border border-yellow-500/20 mb-2 relative overflow-hidden">
                                <div className="text-xs font-bold text-yellow-500 mb-3 flex items-center gap-2 font-rajdhani tracking-wider"><Crown size={12} /> HALL OF FAME</div>
                                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => (
                                        <div key={i} className="flex justify-between text-[10px] text-cyber-blue/70 border-b border-cyber-blue/5 pb-1 last:border-0 hover:bg-cyber-blue/5 p-1 rounded transition-colors font-fira">
                                            <span className="flex gap-2">
                                                <span className={`w-4 text-center font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                                <span className="text-white">{ranker.nickname}</span>
                                            </span>
                                            <span className="flex gap-3 items-center">
                                                <span className="text-red-400 flex items-center gap-1"><Skull size={8} /> {ranker.totalKills}</span>
                                            </span>
                                        </div>
                                    )) : <div className="text-xs text-cyber-blue/30 text-center font-fira animate-pulse">SYNCING NETWORK...</div>}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const exportData = {
                                        timestamp: new Date().toISOString(),
                                        summary: {
                                            name: player.name,
                                            level: player.level,
                                            job: player.job,
                                            gold: player.gold,
                                            playtime: "N/A"
                                        },
                                        stats: stats,
                                        equipment: player.equip,
                                        history: [...(player.archivedHistory || []), ...player.history]
                                    };
                                    exportToJson(`aetheria_log_${Date.now()}.json`, exportData);
                                }}
                                className="w-full bg-cyber-blue/10 hover:bg-cyber-blue/20 text-cyber-blue py-3 rounded-sm border border-cyber-blue/30 flex items-center justify-center gap-2 font-rajdhani font-bold tracking-wider transition-all hover:shadow-neon-blue"
                            >
                                <Save size={16} /> DATA DUMP (JSON)
                            </button>
                            <div className="bg-cyber-blue/5 p-2 rounded text-[10px] text-cyber-blue/40 border-l-2 border-cyber-blue/20">
                                CAUTION: Data export includes sensitive mission logs. Use secure channels for transmission.
                            </div>

                            {/* ADMIN PANEL (Hidden) */}
                            {actions.isAdmin() && (
                                <div className="bg-red-950/20 p-3 rounded border border-red-500/30 mt-4">
                                    <div className="text-xs font-bold text-red-400 mb-2 font-rajdhani flex items-center gap-2"><Shield size={12} /> ADMIN CONTROLS</div>
                                    <div className="text-[10px] text-red-200/50 space-y-2 font-fira">
                                        <p>UID: {actions.getUid()}</p>
                                        <p>Multiplier: {actions.liveConfig?.eventMultiplier || 1}x</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={async () => {
                                                    const newMult = prompt('EXP Multiplier (1-5):', '1');
                                                    if (newMult) {
                                                        const val = parseFloat(newMult);
                                                        if (isNaN(val) || val < 1 || val > 5) return;
                                                        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
                                                        await setDoc(configRef, { config: { eventMultiplier: val } }, { merge: true });
                                                    }
                                                }}
                                                className="bg-red-900/50 hover:bg-red-800/50 py-1 rounded text-white border border-red-500/30"
                                            >
                                                SET MULTIPLIER
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const newAnn = prompt('Announcement (Max 100 chars):');
                                                    if (newAnn) {
                                                        const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data');
                                                        await setDoc(configRef, { config: { announcement: newAnn } }, { merge: true });
                                                    }
                                                }}
                                                className="bg-red-900/50 hover:bg-red-800/50 py-1 rounded text-white border border-red-500/30"
                                            >
                                                BROADCAST
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FEEDBACK FORM */}
                            <div className="bg-cyber-black/40 p-3 rounded border border-cyber-green/20 mt-4">
                                <div className="text-xs font-bold text-cyber-green/70 mb-2 font-rajdhani">System Feedback</div>
                                <textarea
                                    id="feedbackInput"
                                    placeholder="Report anomalies or suggest upgrades..."
                                    className="w-full bg-cyber-black/80 border border-cyber-green/20 rounded p-2 text-xs text-cyber-blue/80 h-20 resize-none focus:outline-none focus:border-cyber-green/50 placeholder:text-cyber-green/20 font-fira"
                                    maxLength={500}
                                />
                                <button
                                    onClick={async () => {
                                        const input = document.getElementById('feedbackInput');
                                        const validationInput = input?.value?.trim() || '';
                                        const validation = FeedbackValidator.validate(validationInput);
                                        if (!validation.valid) return alert(validation.error);
                                        const msg = input?.value?.trim();
                                        if (!msg) return alert('Input required.');
                                        try {
                                            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
                                            await addDoc(feedbackCol, {
                                                uid: actions.getUid(),
                                                nickname: player.name,
                                                message: msg,
                                                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                                                timestamp: serverTimestamp()
                                            });
                                            FeedbackValidator.markSubmitted();
                                            input.value = '';
                                            alert('Access granted. Transmission complete.');
                                        } catch {
                                            alert('Access denied. Transmission failed.');
                                        }
                                    }}
                                    className="w-full mt-2 bg-cyber-green/10 hover:bg-cyber-green/20 py-2 rounded text-cyber-green text-xs border border-cyber-green/30 font-bold tracking-wider"
                                >
                                    TRANSMIT
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Dashboard;
