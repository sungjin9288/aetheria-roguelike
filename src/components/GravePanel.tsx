import { useState } from 'react';
import {
    Coins,
    MapPinned,
    Navigation,
    PackageOpen,
    RefreshCw,
    ShieldCheck,
    Skull,
    Sparkles,
    Swords,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '../firebase';
import { APP_ID, BALANCE } from '../data/constants';
import { isSignatureItem } from '../data/signatureItems.js';
import { calcInvasionChance, getGraveRecoveryGroups } from '../utils/graveUtils';
import {
    PRODUCTION_GAME_CAPABILITIES,
    type GameCapabilities,
} from '../platform/gameCapabilities';
import type { Player } from '../types/index.js';

const GRAVES_LIMIT = 10;

interface GravePanelProps {
    player: Player;
    grave?: any;
    actions?: any;
    onOpenMap?: () => void;
    capabilities?: Readonly<GameCapabilities>;
}

const GravePanel = ({
    player,
    grave,
    actions,
    onOpenMap,
    capabilities = PRODUCTION_GAME_CAPABILITIES,
}: GravePanelProps) => {
    const [view, setView] = useState<'mine' | 'public'>('mine');
    const [publicGraves, setPublicGraves] = useState<any[]>([]);
    const [publicLoaded, setPublicLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [invadingUid, setInvadingUid] = useState<any>(null);

    const recoveryGroups = getGraveRecoveryGroups(grave, player?.loc);
    const recoveryGold = recoveryGroups.reduce((sum: number, group: any) => sum + group.gold, 0);
    const recoveryItems = recoveryGroups.reduce((sum: number, group: any) => sum + group.items.length, 0);
    const playerAtk = player?.atk || 10;
    const today = new Date().toDateString();
    const lastDate = player?.stats?.lastInvadeDate;
    const usedCount = lastDate === today ? (player?.stats?.dailyInvadeCount || 0) : 0;
    const remainingInvades = Math.max(0, BALANCE.DAILY_INVADE_LIMIT - usedCount);

    const fetchGraves = async () => {
        if (!capabilities.publicGraveInvasion || !hasFirebaseConfig || loading) return;
        setLoading(true);
        try {
            const gravesCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'graves');
            const graveQuery = query(gravesCol, orderBy('createdAt', 'desc'), limit(GRAVES_LIMIT));
            const snapshot = await getDocs(graveQuery);
            const fetched: any[] = [];
            snapshot.forEach((document: any) => {
                const data = document.data();
                if (data.uid !== player?.uid) fetched.push({ ...data, uid: document.id });
            });
            setPublicGraves(fetched);
            setPublicLoaded(true);
        } catch (error) {
            console.warn('Grave fetch failed', error);
            setPublicLoaded(true);
        } finally {
            setLoading(false);
        }
    };

    const selectView = (nextView: 'mine' | 'public') => {
        if (nextView === 'public' && !capabilities.publicGraveInvasion) return;
        setView(nextView);
        if (nextView === 'public' && !publicLoaded) void fetchGraves();
    };

    const handleInvade = async (targetGrave: any) => {
        if (!capabilities.publicGraveInvasion || remainingInvades <= 0) return;
        setInvadingUid(targetGrave.uid);
        await actions?.invadeGrave?.(targetGrave);
        setPublicGraves((current: any[]) => current.filter((entry: any) => entry.uid !== targetGrave.uid));
        setTimeout(() => setInvadingUid(null), 600);
    };

    const tierColor = (item: any) => {
        if ((item?.tier || 1) >= 5) return 'text-yellow-200 border-yellow-200/24';
        if ((item?.tier || 1) >= 4) return 'text-fuchsia-200 border-fuchsia-200/22';
        if ((item?.tier || 1) >= 3) return 'text-sky-200 border-sky-200/22';
        return 'text-slate-300 border-white/10';
    };

    return (
        <div data-testid="grave-recovery-panel" className="space-y-3 pb-2">
            <div
                role="tablist"
                aria-label="무덤 기록"
                className={`grid gap-1 rounded-lg border border-white/8 bg-black/20 p-1 ${capabilities.publicGraveInvasion ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={view === 'mine'}
                    data-testid="grave-view-mine"
                    onClick={() => selectView('mine')}
                    className={`min-h-[44px] rounded-md px-3 text-[12px] font-readable font-bold transition-colors ${view === 'mine'
                        ? 'bg-[#d5b180]/14 text-[#f4e6c8]'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                >
                    내 유해 {recoveryGroups.length > 0 ? recoveryGroups.length : ''}
                </button>
                {capabilities.publicGraveInvasion && (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'public'}
                        data-testid="grave-view-public"
                        onClick={() => selectView('public')}
                        className={`min-h-[44px] rounded-md px-3 text-[12px] font-readable font-bold transition-colors ${view === 'public'
                            ? 'bg-[#7dd4d8]/12 text-[#dff7f5]'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                    >
                        다른 모험가
                    </button>
                )}
            </div>

            {view === 'mine' && (
                <section data-testid="grave-mine-view" className="space-y-3">
                    {recoveryGroups.length === 0 ? (
                        <div className="flex min-h-[148px] flex-col items-center justify-center border-y border-white/8 px-5 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200/16 bg-emerald-300/[0.05] text-emerald-100/80">
                                <ShieldCheck size={20} />
                            </span>
                            <h3 className="mt-3 text-[14px] font-readable font-bold text-white/90">잃어버린 유해가 없습니다</h3>
                            <p className="mt-1 text-[12px] font-readable text-slate-400">다음 원정을 준비할 수 있습니다.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 divide-x divide-white/8 border-y border-white/8 py-3">
                                <div className="px-2 text-center">
                                    <div className="text-[11px] font-readable text-slate-400">회수 지역</div>
                                    <strong className="mt-1 block text-[16px] font-readable text-white/92">{recoveryGroups.length}</strong>
                                </div>
                                <div className="px-2 text-center">
                                    <div className="text-[11px] font-readable text-slate-400">골드</div>
                                    <strong className="mt-1 block text-[16px] font-readable text-[#f0d69b]">{recoveryGold.toLocaleString('ko-KR')}</strong>
                                </div>
                                <div className="px-2 text-center">
                                    <div className="text-[11px] font-readable text-slate-400">장비·물품</div>
                                    <strong className="mt-1 block text-[16px] font-readable text-[#bcebea]">{recoveryItems}</strong>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {recoveryGroups.map((group: any) => (
                                    <article
                                        key={group.loc}
                                        data-testid={`grave-recovery-${group.loc}`}
                                        data-current-location={group.atCurrentLocation ? 'true' : 'false'}
                                        className={`rounded-lg border p-3 ${group.atCurrentLocation
                                            ? 'border-[#d5b180]/28 bg-[#d5b180]/[0.06]'
                                            : 'border-white/9 bg-black/16'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-[11px] font-readable text-slate-400">
                                                    <MapPinned size={13} />
                                                    <span>{group.atCurrentLocation ? '현재 위치' : '회수 목적지'}</span>
                                                    {group.count > 1 && <span>· 유해 {group.count}구</span>}
                                                </div>
                                                <h3 className="mt-1 truncate text-[15px] font-readable font-bold text-white/92">{group.loc}</h3>
                                            </div>
                                            {group.atCurrentLocation && (
                                                <span className="shrink-0 rounded-md border border-[#d5b180]/24 bg-[#d5b180]/10 px-2 py-1 text-[11px] font-readable text-[#f4e6c8]">
                                                    회수 가능
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-readable">
                                            <span className="inline-flex items-center gap-1.5 text-[#f0d69b]">
                                                <Coins size={13} /> {group.gold.toLocaleString('ko-KR')} 골드
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-[#bcebea]">
                                                <PackageOpen size={13} /> {group.items.length}개
                                            </span>
                                        </div>

                                        {group.items.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {group.items.slice(0, 3).map((item: any, index: number) => (
                                                    <span
                                                        key={`${item.id || item.name}-${index}`}
                                                        className={`rounded-md border bg-black/18 px-2 py-1 text-[11px] font-readable ${tierColor(item)}`}
                                                    >
                                                        {item.name || '이름 없는 물품'}
                                                    </span>
                                                ))}
                                                {group.items.length > 3 && (
                                                    <span className="rounded-md border border-white/8 bg-black/18 px-2 py-1 text-[11px] font-readable text-slate-400">
                                                        +{group.items.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            data-testid={group.atCurrentLocation ? 'grave-recover-here' : `grave-open-map-${group.loc}`}
                                            onClick={group.atCurrentLocation ? actions?.lootGrave : onOpenMap}
                                            className={`mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border px-3 text-[12px] font-readable font-bold transition-colors ${group.atCurrentLocation
                                                ? 'border-[#d5b180]/32 bg-[#d5b180]/12 text-[#f4e6c8] hover:bg-[#d5b180]/18'
                                                : 'border-[#7dd4d8]/24 bg-[#7dd4d8]/[0.06] text-[#dff7f5] hover:bg-[#7dd4d8]/12'
                                            }`}
                                        >
                                            {group.atCurrentLocation ? <PackageOpen size={15} /> : <Navigation size={15} />}
                                            {group.atCurrentLocation ? '이곳 유해 회수' : '지도에서 경로 확인'}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            )}

            {capabilities.publicGraveInvasion && (
                <section data-testid="grave-public-view" className="space-y-2">
                    <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-white/8 pb-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[12px] font-readable font-bold text-white/88">
                                <Swords size={14} className="text-[#d5b180]" />
                                유해 침입
                            </div>
                            <p className="mt-1 text-[11px] font-readable text-slate-400">
                                오늘 {remainingInvades}/{BALANCE.DAILY_INVADE_LIMIT}회 남음
                            </p>
                        </div>
                        <button
                            type="button"
                            title="목록 새로고침"
                            aria-label="목록 새로고침"
                            onClick={() => void fetchGraves()}
                            disabled={loading || !hasFirebaseConfig}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-slate-300 transition-colors hover:border-[#7dd4d8]/24 hover:text-white disabled:opacity-40"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {!hasFirebaseConfig && (
                        <div className="py-8 text-center text-[12px] font-readable text-slate-400">
                            오프라인에서는 다른 모험가의 유해를 불러올 수 없습니다.
                        </div>
                    )}

                    {hasFirebaseConfig && loading && publicGraves.length === 0 && (
                        <div className="py-8 text-center text-[12px] font-readable text-slate-400">불러오는 중...</div>
                    )}

                    {hasFirebaseConfig && publicLoaded && !loading && publicGraves.length === 0 && (
                        <div className="py-8 text-center text-[12px] font-readable text-slate-400">지금 침입할 수 있는 유해가 없습니다.</div>
                    )}

                    {publicGraves.map((targetGrave: any) => {
                        const chancePercent = Math.round(calcInvasionChance(playerAtk, targetGrave.guardPower || 10) * 100);
                        const isInvading = invadingUid === targetGrave.uid;
                        const items = Array.isArray(targetGrave.items) ? targetGrave.items : [];
                        const noItems = items.length === 0;
                        const signatureItems = items.filter((item: any) => isSignatureItem(item));

                        return (
                            <article
                                key={targetGrave.uid}
                                data-testid={`public-grave-${targetGrave.uid}`}
                                data-has-signature={signatureItems.length > 0 ? 'true' : 'false'}
                                className={`rounded-lg border p-3 ${signatureItems.length > 0
                                    ? 'border-yellow-200/24 bg-yellow-200/[0.05]'
                                    : 'border-white/9 bg-black/16'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <Skull size={13} className="shrink-0 text-slate-400" />
                                            <strong className="truncate text-[13px] font-readable text-white/90">
                                                {targetGrave.playerName || '무명 용사'}
                                            </strong>
                                            {signatureItems.length > 0 && (
                                                <span
                                                    data-testid={`grave-signature-bounty-${targetGrave.uid}`}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-yellow-200/24 bg-yellow-200/[0.06] px-1.5 py-0.5 text-[11px] font-readable text-yellow-100"
                                                >
                                                    <Sparkles size={10} /> 전설 {signatureItems.length}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-[11px] font-readable text-slate-400">
                                            레벨 {targetGrave.level || 1} · {targetGrave.loc || '알 수 없는 곳'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[12px] font-readable text-[#f0d69b]">
                                        {(targetGrave.gold || 0).toLocaleString('ko-KR')} 골드
                                    </span>
                                </div>

                                {items.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {items.map((item: any, index: number) => (
                                            <span
                                                key={`${item.id || item.name}-${index}`}
                                                data-is-signature={isSignatureItem(item) ? 'true' : 'false'}
                                                className={`rounded-md border bg-black/18 px-2 py-1 text-[11px] font-readable ${tierColor(item)}`}
                                            >
                                                {isSignatureItem(item) ? '전설 · ' : ''}{item.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-3 flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between text-[11px] font-readable text-slate-400">
                                            <span>성공 확률</span>
                                            <strong className="text-slate-200">{chancePercent}%</strong>
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                                            <div className="h-full rounded-full bg-[#7dd4d8]" style={{ width: `${chancePercent}%` }} />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleInvade(targetGrave)}
                                        disabled={remainingInvades <= 0 || noItems || isInvading}
                                        className="min-h-[44px] shrink-0 rounded-lg border border-[#d5b180]/28 bg-[#d5b180]/10 px-4 text-[12px] font-readable font-bold text-[#f4e6c8] transition-colors hover:bg-[#d5b180]/16 disabled:border-white/8 disabled:bg-black/12 disabled:text-slate-600"
                                    >
                                        {isInvading ? '진행 중' : noItems ? '빈 유해' : '침입'}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </div>
    );
};

export default GravePanel;
