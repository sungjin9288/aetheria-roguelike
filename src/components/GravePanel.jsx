import React, { useEffect, useState } from 'react';
import { Skull, Swords, RefreshCw } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '../firebase';
import { APP_ID, BALANCE } from '../data/constants';
import { calcInvasionChance } from '../utils/graveUtils';

const GRAVES_LIMIT = 10;

const GravePanel = ({ player, actions, compact = false }) => {
    const [graves, setGraves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [invadingUid, setInvadingUid] = useState(null);

    const playerAtk = player?.atk || 10;
    const today = new Date().toDateString();
    const lastDate = player?.stats?.lastInvadeDate;
    const usedCount = lastDate === today ? (player?.stats?.dailyInvadeCount || 0) : 0;
    const remainingInvades = Math.max(0, BALANCE.DAILY_INVADE_LIMIT - usedCount);

    const fetchGraves = async () => {
        if (!hasFirebaseConfig) return;
        setLoading(true);
        try {
            const gravesCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'graves');
            const q = query(gravesCol, orderBy('createdAt', 'desc'), limit(GRAVES_LIMIT));
            const snap = await getDocs(q);
            const fetched = [];
            snap.forEach((d) => {
                const data = d.data();
                if (data.uid !== player?.uid) fetched.push({ ...data, uid: d.id });
            });
            setGraves(fetched.filter((g) => g.uid !== player?.uid));
        } catch (e) {
            console.warn('Grave fetch failed', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGraves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInvade = async (grave) => {
        if (remainingInvades <= 0) return;
        setInvadingUid(grave.uid);
        await actions?.invadeGrave?.(grave);
        setGraves((prev) => prev.filter((g) => g.uid !== grave.uid));
        setTimeout(() => setInvadingUid(null), 600);
    };

    const tierColor = (items) => {
        if (!items?.length) return 'text-slate-500';
        const maxTier = Math.max(...items.map((i) => i.tier || 1));
        if (maxTier >= 5) return 'text-yellow-400';
        if (maxTier >= 4) return 'text-purple-400';
        if (maxTier >= 3) return 'text-blue-400';
        return 'text-slate-300';
    };

    return (
        <div className={`space-y-${compact ? '2' : '3'}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Skull size={compact ? 11 : 13} className="text-[#d5b180]/70" />
                    <span className={`font-fira uppercase tracking-widest ${compact ? 'text-[9px]' : 'text-[10px]'} text-[#d5b180]/80`}>
                        Grave Invasion
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} text-slate-400 font-fira`}>
                        침략 {remainingInvades}/{BALANCE.DAILY_INVADE_LIMIT}
                    </span>
                    <button
                        onClick={fetchGraves}
                        disabled={loading}
                        className="p-1 rounded-md border border-white/10 bg-black/20 hover:border-[#7dd4d8]/30 transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={10} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Graves list */}
            {!hasFirebaseConfig && (
                <div className={`text-center py-4 ${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-fira`}>
                    오프라인 모드 — 묘비 침략 불가
                </div>
            )}

            {hasFirebaseConfig && loading && graves.length === 0 && (
                <div className={`text-center py-4 ${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-fira`}>
                    불러오는 중...
                </div>
            )}

            {hasFirebaseConfig && !loading && graves.length === 0 && (
                <div className={`text-center py-4 ${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-fira`}>
                    침략 가능한 묘비가 없습니다.
                </div>
            )}

            {graves.map((grave) => {
                const chance = calcInvasionChance(playerAtk, grave.guardPower || 10);
                const chancePercent = Math.round(chance * 100);
                const isInvading = invadingUid === grave.uid;
                const noItems = !grave.items?.length;

                return (
                    <div
                        key={grave.uid}
                        className={`aether-card p-${compact ? '2' : '3'} space-y-1.5`}
                    >
                        {/* Grave info */}
                        <div className="flex items-center justify-between">
                            <div>
                                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-fira text-[#f4e6c8]`}>
                                    {grave.playerName || '무명 용사'}
                                </span>
                                <span className={`ml-2 ${compact ? 'text-[8px]' : 'text-[9px]'} text-slate-500 font-fira`}>
                                    Lv.{grave.level || 1} · {grave.loc || '?'}
                                </span>
                            </div>
                            <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-fira text-[#d5b180]/70`}>
                                {grave.gold || 0}G
                            </span>
                        </div>

                        {/* Items */}
                        {grave.items?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {grave.items.map((item, idx) => (
                                    <span
                                        key={idx}
                                        className={`px-1.5 py-0.5 rounded-md border border-white/10 bg-white/5 ${compact ? 'text-[7px]' : 'text-[8px]'} font-fira ${tierColor([item])}`}
                                    >
                                        {item.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Invasion button + chance */}
                        <div className="flex items-center justify-between pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#7dd4d8]/50 to-[#7dd4d8] rounded-full transition-all"
                                        style={{ width: `${chancePercent}%` }}
                                    />
                                </div>
                                <span className={`${compact ? 'text-[7px]' : 'text-[8px]'} font-fira text-slate-400`}>
                                    {chancePercent}%
                                </span>
                            </div>
                            <button
                                onClick={() => handleInvade(grave)}
                                disabled={remainingInvades <= 0 || noItems || isInvading}
                                className={`flex items-center gap-1 px-2 py-1 rounded-[0.7rem] border transition-all ${compact ? 'text-[8px]' : 'text-[9px]'} font-fira uppercase tracking-wider
                                    ${remainingInvades <= 0 || noItems
                                        ? 'border-white/8 text-slate-600 cursor-not-allowed'
                                        : 'border-[#d5b180]/30 bg-[#d5b180]/10 text-[#d5b180] hover:bg-[#d5b180]/20 hover:border-[#d5b180]/50'
                                    }`}
                            >
                                <Swords size={compact ? 8 : 9} />
                                {isInvading ? '...' : noItems ? '빈 묘비' : '침략'}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GravePanel;
