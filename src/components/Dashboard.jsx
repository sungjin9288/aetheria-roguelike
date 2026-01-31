import React from 'react';
import { User, Crown, Skull, Save } from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID } from '../data/constants';
import { exportToJson } from '../utils/fileUtils';

const Dashboard = ({ player, sideTab, setSideTab, actions, stats }) => {
    // Inventory Grouping
    const groupedInv = player.inv.reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
    }, {});

    return (
        <aside className="w-1/3 min-w-[300px] hidden md:flex flex-col gap-4">
            {/* STATUS PANEL */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg">
                <h3 className="text-emerald-400 font-bold mb-3 text-sm flex items-center gap-2"><User size={16} /> STATUS</h3>
                <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between"><span>Lv.{player?.level} {player?.job}</span> <span className="text-yellow-400">{player?.gold} G</span></div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
                        <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${(player?.hp / player?.maxHp) * 100}%` }}></div>
                    </div>
                    <div className="text-center text-[10px] text-slate-500">{player?.hp} / {player?.maxHp} HP</div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(player?.mp / player?.maxMp) * 100}%` }}></div>
                    </div>
                    <div className="text-center text-[10px] text-slate-500">{player?.mp} / {player?.maxMp} MP</div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1 relative">
                        <div className="bg-purple-500 h-full transition-all duration-300" style={{ width: `${(player?.exp / player?.nextExp) * 100}%` }}></div>
                    </div>
                    <div className="text-center text-[10px] text-slate-500">{player?.exp} / {player?.nextExp} EXP</div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
                        <div><div className="text-slate-500">ATK</div><div className="text-white">{stats?.atk} <span className="text-[10px] text-slate-400">({stats?.elem})</span></div></div>
                        <div><div className="text-slate-500">DEF</div><div className="text-white">{stats?.def}</div></div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400 truncate">W: {player?.equip?.weapon?.name || '맨손'}</div>
                    <div className="text-[10px] text-slate-400 truncate">A: {player?.equip?.armor?.name || '평상복'}</div>
                </div>
            </div>

            {/* TABS */}
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex-1 overflow-hidden flex flex-col">
                <div className="flex gap-4 mb-3 border-b border-slate-700 pb-2">
                    {['inventory', 'quest', 'system'].map(tab => (
                        <button key={tab} onClick={() => setSideTab(tab)} className={`text-xs font-bold uppercase ${sideTab === tab ? 'text-indigo-400' : 'text-slate-500'}`}>{tab}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {sideTab === 'inventory' && Object.entries(groupedInv).map(([name, count], i) => {
                        const item = player?.inv?.find(it => it.name === name);
                        if (!item) return null;
                        return (
                            <div key={i} className="bg-slate-800/50 p-2 rounded border border-slate-700/50 flex justify-between items-center group">
                                <span className={`text-sm ${item.tier >= 2 ? 'text-purple-300' : 'text-slate-300'}`}>{name} x{count}</span>
                                <button onClick={() => actions.useItem(item)} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded">사용</button>
                            </div>
                        );
                    })}
                    {sideTab === 'quest' && player?.quests?.length === 0 && <div className="text-slate-500 text-center py-4">진행 중인 의뢰가 없습니다.</div>}

                    {sideTab === 'system' && (
                        <div className="space-y-4 p-2">
                            <div className="text-xs text-slate-400 mb-2">
                                <p>Session ID: {Date.now().toString(36).toUpperCase()}</p>
                                <p>User ID: {actions.getUid()}</p>
                                <p>Client Ver: v3.5 (Stable)</p>
                            </div>

                            {/* HONOR OF FAME */}
                            <div className="bg-slate-900/80 p-3 rounded border border-yellow-900/30 mb-2">
                                <div className="text-xs font-bold text-yellow-500 mb-2 flex items-center gap-2"><Crown size={12} /> 명예의 전당 (Top 10)</div>
                                <div className="space-y-1">
                                    {actions.leaderboard?.length > 0 ? actions.leaderboard.map((ranker, i) => (
                                        <div key={i} className="flex justify-between text-[10px] text-slate-300 border-b border-slate-800/50 pb-1 last:border-0 hover:bg-slate-800/50 p-1 rounded transition-colors">
                                            <span className="flex gap-2">
                                                <span className={`w-3 text-center font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>{i + 1}</span>
                                                <span>{ranker.nickname} (Lv.{ranker.level})</span>
                                            </span>
                                            <span className="flex gap-2 items-center">
                                                <span className="text-red-400 flex items-center gap-0.5"><Skull size={8} /> {ranker.totalKills}</span>
                                                <span className="text-yellow-500 flex items-center gap-0.5"><Crown size={8} /> {ranker?.bossKills || 0}</span>
                                            </span>
                                        </div>
                                    )) : <div className="text-[10px] text-slate-600 text-center">랭킹 정보 불러오는 중...</div>}
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
                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded border border-slate-600 flex items-center justify-center gap-2"
                            >
                                <Save size={16} /> <span>전투 기록 다운로드 (JSON)</span>
                            </button>
                            <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-500">
                                * 기록 다운로드는 현재 세션의 모든 이벤트와 선택, 전투 결과를 포함합니다. 클라우드 분석을 위해 주기적으로 백업하세요.
                            </div>

                            {/* ADMIN PANEL (Hidden) */}
                            {actions.isAdmin() && (
                                <div className="bg-red-950/30 p-3 rounded border border-red-800/50 mt-4">
                                    <div className="text-xs font-bold text-red-400 mb-2">🔐 운영자 패널</div>
                                    <div className="text-[10px] text-slate-400 space-y-2">
                                        <p>UID: {actions.getUid()}</p>
                                        <p>Event Multiplier: {actions.liveConfig?.eventMultiplier || 1}x</p>
                                        <button
                                            onClick={async () => {
                                                const newMult = prompt('새 경험치 배율 (1~5):', '1');
                                                if (newMult) {
                                                    const val = parseFloat(newMult);
                                                    if (isNaN(val) || val < 1 || val > 5) {
                                                        alert('⚠️ 배율은 1~5 사이여야 합니다.');
                                                        return;
                                                    }
                                                    const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config');
                                                    await setDoc(configRef, { eventMultiplier: val }, { merge: true });
                                                }
                                            }}
                                            className="w-full bg-red-900 hover:bg-red-800 py-1 rounded text-white"
                                        >
                                            배율 변경
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const newAnn = prompt('공지사항 (최대 100자):');
                                                if (newAnn !== null) {
                                                    if (newAnn.length > 100) {
                                                        alert('⚠️ 공지는 100자 이하로 작성해주세요.');
                                                        return;
                                                    }
                                                    const configRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'config');
                                                    await setDoc(configRef, { announcement: newAnn }, { merge: true });
                                                }
                                            }}
                                            className="w-full bg-red-900 hover:bg-red-800 py-1 rounded text-white"
                                        >
                                            공지 설정
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* FEEDBACK FORM */}
                            <div className="bg-slate-900/80 p-3 rounded border border-slate-700 mt-4">
                                <div className="text-xs font-bold text-slate-400 mb-2">📨 신고/제안</div>
                                <textarea
                                    id="feedbackInput"
                                    placeholder="버그 신고, 기능 제안 등을 작성해주세요..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs text-slate-300 h-20 resize-none focus:outline-none focus:border-indigo-500"
                                    maxLength={500}
                                />
                                <button
                                    onClick={async () => {
                                        const input = document.getElementById('feedbackInput');
                                        const msg = input?.value?.trim();
                                        if (!msg) return alert('내용을 입력해주세요.');
                                        try {
                                            const feedbackCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback');
                                            await addDoc(feedbackCol, {
                                                uid: actions.getUid(),
                                                nickname: player.name,
                                                message: msg,
                                                statsSummary: { level: player.level, job: player.job, kills: player.stats?.kills || 0 },
                                                timestamp: serverTimestamp()
                                            });
                                            input.value = '';
                                            alert('✅ 제출 완료! 감사합니다.');
                                        } catch {
                                            alert('❌ 제출 실패. 다시 시도해주세요.');
                                        }
                                    }}
                                    className="w-full mt-2 bg-indigo-800 hover:bg-indigo-700 py-2 rounded text-white text-xs"
                                >
                                    제출하기
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
