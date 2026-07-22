import { useMemo, useState } from 'react';
import { ArrowRight, Check, Compass, LockKeyhole, Route, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import type { GameMap } from '../types/index.js';
import { getMoveRecommendations } from '../utils/adventureGuide';
import { getGravesAtLoc } from '../utils/graveUtils';
import { getExitBadges } from '../utils/mapBadges';
import { getMapProgressState } from '../utils/mapProgress';
import { getMapSignatureDrops, getMapUndiscoveredSignatures } from '../utils/mapSignatureHints';
import { getMapRequiredLevel, getNextMapTowardTarget } from '../utils/mapTopology';
import RouteTopology, { type RouteTopologyEntry } from './RouteTopology';
import SignalBadge from './SignalBadge';
import { getExpeditionFocusRouteTargets, getFocusedExpeditionQuestEntries } from '../utils/expeditionMissionFocus';

type MapState = 'unexplored' | 'exploring' | 'completed';

interface MapEntry extends GameMap {
    name: string;
    state: MapState;
    isCurrent: boolean;
    progress: { discovered: number; total: number; remaining: number };
    graves: any[];
    signatureDrops: Array<{ name: string; rate: number }>;
    undiscoveredSignatures: Array<{ name: string; rate: number }>;
    badges: Array<{ id: string; label: string }>;
}

interface MapNavigatorProps {
    player: any;
    grave: any;
    stats: any;
    actions?: any;
}

const MAP_ORDER = Object.entries(DB.MAPS)
    .map(([name, map]) => ({ name, ...map }))
    .sort((left, right) => {
        const leftLevel = left.level === 'infinite' ? 999 : (left.minLv ?? left.level ?? 1);
        const rightLevel = right.level === 'infinite' ? 999 : (right.minLv ?? right.level ?? 1);
        if (left.type === 'safe' && right.type !== 'safe') return -1;
        if (left.type !== 'safe' && right.type === 'safe') return 1;
        return Number(leftLevel) - Number(rightLevel);
    });

const MAP_BANDS = [
    { key: 'frontier', label: '변방', levelLabel: '레벨 1~10', maxLevel: 10 },
    { key: 'midlands', label: '중부', levelLabel: '레벨 11~20', maxLevel: 20 },
    { key: 'highlands', label: '고지', levelLabel: '레벨 21~35', maxLevel: 35 },
    { key: 'mythic', label: '신화', levelLabel: '레벨 36~60', maxLevel: 60 },
    { key: 'endgame', label: '종장', levelLabel: '레벨 61 이상', maxLevel: Number.POSITIVE_INFINITY },
];

const MAP_STATE = {
    unexplored: { label: '미탐험', badge: 'neutral', dot: 'bg-slate-500/70' },
    exploring: { label: '탐험 중', badge: 'recommended', dot: 'bg-[#7dd4d8]' },
    completed: { label: '탐험 완료', badge: 'equipped', dot: 'bg-emerald-300' },
} as const;

const formatMapLevel = (map: GameMap | null | undefined, playerLevel = 1) => (
    map?.level === 'infinite' ? '심연' : `레벨 ${getMapRequiredLevel(map, playerLevel)}`
);

const getBandIndex = (map: GameMap) => {
    const level = map.level === 'infinite' ? 999 : getMapRequiredLevel(map, 1);
    if (map.type === 'safe' && level <= 15) return 0;
    return MAP_BANDS.findIndex((band) => level <= band.maxLevel);
};

const getRiskLabel = (map: GameMap, playerLevel: number) => {
    if (map.type === 'safe') return '안전';
    if (map.boss) return '보스';

    const gap = getMapRequiredLevel(map, playerLevel) - playerLevel;
    if (gap > 0) return '레벨 부족';
    if (gap >= -1) return '경계';
    return '적정';
};

const getEncounterLabel = (map: GameMap, route: any) => {
    if (map.type === 'safe') return '정비';
    if (map.boss) return '보스 교전';
    return route?.routePlan?.approach || '일반 교전';
};

const getRewardLabel = (entry: MapEntry) => {
    if (entry.undiscoveredSignatures.length > 0) return `전설 ${entry.undiscoveredSignatures.length}종`;
    if (entry.type === 'safe') return '회복·보급';
    if (entry.state === 'unexplored') return '첫 발견';
    return '전리품';
};

const WorldRouteList = ({
    entries,
    selectedName,
    playerLevel,
    blindMap,
    onSelect,
}: {
    entries: MapEntry[];
    selectedName: string;
    playerLevel: number;
    blindMap: boolean;
    onSelect: (name: string) => void;
}) => (
    <details className="aether-map-world-list">
        <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-1 font-readable text-[11px] text-slate-300/84">
            <span>전체 경로</span>
            <span className="text-slate-500">{blindMap ? '도전 규칙으로 비공개' : `${entries.length}곳`}</span>
        </summary>

        {blindMap ? (
            <div className="border-t border-white/8 px-1 py-3 font-readable text-[11px] text-slate-400">
                현재 위치에서 이어진 경로만 확인할 수 있습니다.
            </div>
        ) : (
            <div className="space-y-4 border-t border-white/8 pt-3">
                {MAP_BANDS.map((band, bandIndex) => {
                    const bandEntries = entries.filter((entry) => getBandIndex(entry) === bandIndex);
                    if (bandEntries.length === 0) return null;

                    return (
                        <section key={band.key} className="space-y-1.5">
                            <div className="aether-type-meta flex items-center justify-between px-1 font-readable text-slate-500">
                                <span className="text-slate-300/80">{band.label}</span>
                                <span>{band.levelLabel}</span>
                            </div>
                            <div className="divide-y divide-white/6 border-y border-white/6">
                                {bandEntries.map((entry) => {
                                    const state = MAP_STATE[entry.state];
                                    const selected = selectedName === entry.name;

                                    return (
                                        <button
                                            key={entry.name}
                                            type="button"
                                            onClick={() => onSelect(entry.name)}
                                            className={`flex min-h-[44px] w-full items-center gap-2 px-1.5 py-2 text-left ${selected ? 'bg-[#7dd4d8]/8' : 'hover:bg-white/[0.025]'}`}
                                        >
                                            <span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
                                            <span className="aether-type-body min-w-0 flex-1 font-readable font-semibold text-slate-100/90">{entry.name}</span>
                                            <span className="aether-type-meta shrink-0 font-readable text-slate-500">{formatMapLevel(entry, playerLevel)}</span>
                                            {entry.state === 'completed'
                                                ? <Check size={12} className="shrink-0 text-emerald-200" aria-label="탐험 완료" />
                                                : entry.state === 'exploring'
                                                    ? <Compass size={12} className="shrink-0 text-[#b9f1ec]" aria-label="탐험 중" />
                                                    : <LockKeyhole size={12} className="shrink-0 text-slate-600" aria-label="미탐험" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        )}
    </details>
);

const MapNavigator = ({ player, grave, stats, actions }: MapNavigatorProps) => {
    const [selection, setSelection] = useState<{ origin: string; name: string | null }>({
        origin: player.loc,
        name: null,
    });
    const selectedMapName = selection.origin === player.loc ? selection.name : null;
    const selectMap = (name: string) => setSelection({ origin: player.loc, name });
    const currentMap = DB.MAPS[player.loc];
    const playerLevel = player.level || 1;
    const blindMap = player.challengeModifiers?.includes('blindMap') || false;
    const moveRecommendations = getMoveRecommendations(
        player,
        stats || { maxHp: player.maxHp, maxMp: player.maxMp },
        currentMap,
        DB.MAPS,
    );
    const focusedQuestEntries = getFocusedExpeditionQuestEntries(player);
    const questTargets = getExpeditionFocusRouteTargets(player).filter((target) => DB.MAPS[target]);
    const questNextSteps = new Set(questTargets
        .map((target) => getNextMapTowardTarget(DB.MAPS, player.loc, target))
        .filter(Boolean));
    const areaBossDefeated = player.stats?.areaBossDefeated;
    const bossGauge = player.stats?.bossGauge;

    const mapEntries = useMemo<MapEntry[]>(() => MAP_ORDER.map((map) => {
        const progress = getMapProgressState(map.name, player, DB.MAPS);
        return {
            ...map,
            ...progress,
            graves: getGravesAtLoc(grave, map.name),
            signatureDrops: getMapSignatureDrops(map.name),
            undiscoveredSignatures: getMapUndiscoveredSignatures(map.name, player),
            badges: getExitBadges(map, areaBossDefeated, bossGauge),
        } as MapEntry;
    }), [areaBossDefeated, bossGauge, grave, player]);

    const entriesByName = useMemo(
        () => new Map(mapEntries.map((entry) => [entry.name, entry])),
        [mapEntries],
    );

    const topologyRoutes: RouteTopologyEntry[] = moveRecommendations.map((route: any) => {
        const entry = entriesByName.get(route.name);
        return {
            ...route,
            isMissionRoute: questNextSteps.has(route.name),
            isBoss: Boolean(entry?.boss),
            isLocked: playerLevel < getMapRequiredLevel(entry, playerLevel),
        };
    });

    const defaultSelection = topologyRoutes[0]?.name || player.loc;
    const selectedName = selectedMapName || defaultSelection;
    const selectedEntry = entriesByName.get(selectedName) || entriesByName.get(player.loc) || mapEntries[0];
    const selectedRoute = moveRecommendations.find((route: any) => route.name === selectedEntry?.name);
    const selectedIsDirectExit = Boolean(selectedRoute);
    const selectedRequiredLevel = getMapRequiredLevel(selectedEntry, playerLevel);
    const selectedIsLocked = selectedIsDirectExit && playerLevel < selectedRequiredLevel;
    const selectedIsCurrent = selectedEntry?.name === player.loc;
    const canMove = selectedIsDirectExit && !selectedIsLocked && typeof actions?.move === 'function';
    const selectedDisplayName = blindMap && selectedIsDirectExit ? '미확인 경로' : selectedEntry?.name;
    const selectedDescription = blindMap && selectedIsDirectExit
        ? '이동하면 지역 정보가 드러납니다.'
        : selectedEntry?.desc;
    const selectedMissionCount = focusedQuestEntries.filter((entry) => entry.targetMaps.includes(selectedEntry?.name)).length;
    const statusCounts = mapEntries.reduce<Record<MapState, number>>((counts, entry) => {
        counts[entry.state] += 1;
        return counts;
    }, { unexplored: 0, exploring: 0, completed: 0 });

    const moveToSelectedMap = () => {
        if (!canMove || !selectedEntry) return;
        actions.move(selectedEntry.name);
    };

    const moveButtonLabel = selectedIsCurrent
        ? '현재 위치'
        : selectedIsLocked
            ? `레벨 ${selectedRequiredLevel} 필요`
            : selectedIsDirectExit
                ? `${blindMap ? '이 경로' : selectedEntry?.name}(으)로 이동`
                : '연결 경로에서 선택';

    return (
        <div data-testid="map-navigator" className="aether-readable-surface space-y-3 rounded-[0.75rem] p-3">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="aether-label">세계 지도</div>
                    <h2 className="aether-type-title mt-0.5 font-readable font-semibold text-white">
                        {blindMap ? '현재 위치에서 이어진 길' : `${player.loc}에서 이어진 길`}
                    </h2>
                </div>
                <div data-testid="map-progress-summary" className="grid shrink-0 grid-cols-3 gap-1" aria-label="지도 진행 요약">
                    {[
                        { label: '미탐험', value: statusCounts.unexplored },
                        { label: '진행', value: statusCounts.exploring },
                        { label: '완료', value: statusCounts.completed },
                    ].map((item) => (
                        <div key={item.label} className="min-w-[34px] text-center font-readable">
                            <div className="aether-type-label text-slate-500">{item.label}</div>
                            <strong className="aether-type-metric text-slate-200/88">{item.value}</strong>
                        </div>
                    ))}
                </div>
            </header>

            <RouteTopology
                testId="map-topology"
                currentTestId="map-current-location-card"
                connectorTestId="map-route-overview"
                currentName={player.loc}
                routes={topologyRoutes}
                selectedName={selectedEntry?.name}
                blindMap={blindMap}
                onSelect={(route) => selectMap(route.name)}
                routeTestId={(route, index) => route.isRecommended ? 'map-primary-route' : `map-topology-route-${index}`}
            />

            {selectedEntry && (
                <section data-testid="map-selected-detail" className="border-y border-white/8 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="aether-type-title font-readable font-semibold text-white/94">{selectedDisplayName}</h3>
                                {!blindMap && (
                                    <SignalBadge tone={MAP_STATE[selectedEntry.state].badge} size="sm">
                                        {MAP_STATE[selectedEntry.state].label}
                                    </SignalBadge>
                                )}
                                {!blindMap && selectedMissionCount > 0 && (
                                    <SignalBadge tone="recommended" size="sm">집중 임무 {selectedMissionCount}</SignalBadge>
                                )}
                            </div>
                            <p className="aether-type-body mt-1 font-readable text-slate-300/78">
                                {selectedDescription}
                            </p>
                        </div>
                        <span className="aether-type-meta shrink-0 font-readable font-semibold text-[#dff7f5]">
                            {blindMap && selectedIsDirectExit ? '정보 없음' : formatMapLevel(selectedEntry, playerLevel)}
                        </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1 min-[401px]:grid-cols-4" data-testid="map-route-forecast">
                        {[
                            { label: '위험', value: blindMap && selectedIsDirectExit ? '미확인' : getRiskLabel(selectedEntry, playerLevel) },
                            { label: '예상', value: blindMap && selectedIsDirectExit ? '미확인' : getEncounterLabel(selectedEntry, selectedRoute) },
                            { label: '보상', value: blindMap && selectedIsDirectExit ? '미확인' : getRewardLabel(selectedEntry) },
                            { label: '귀환', value: selectedRoute?.routePlan?.returnLabel || (selectedIsCurrent ? '현재 위치' : '경로 확인') },
                        ].map((item) => (
                            <div key={item.label} className="aether-map-forecast-cell min-w-0 px-1.5 py-1.5">
                                <div className="aether-type-label font-readable text-slate-500">{item.label}</div>
                                <div className="aether-type-meta mt-0.5 break-words font-readable font-semibold text-slate-100/86">{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {selectedRoute && !blindMap && (
                        <p className="aether-type-meta mt-2 font-readable text-slate-300/72">
                            {selectedRoute.reason}
                        </p>
                    )}

                    <button
                        type="button"
                        data-testid="map-move-selected"
                        disabled={!canMove}
                        onClick={moveToSelectedMap}
                        className="aether-cta-primary aether-type-body mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[0.5rem] px-3 font-readable font-semibold text-[#dff7f5] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.03] disabled:text-slate-500"
                    >
                        <span>{moveButtonLabel}</span>
                        {canMove && <ArrowRight size={14} aria-hidden="true" />}
                    </button>

                    {!blindMap && selectedEntry.badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {selectedEntry.badges.map((badge) => (
                                <SignalBadge key={badge.id} tone={badge.id === 'boss' ? 'danger' : badge.id === 'bossGauge' ? 'warning' : badge.id === 'shop' ? 'upgrade' : 'recommended'} size="sm">
                                    {badge.label}
                                </SignalBadge>
                            ))}
                        </div>
                    )}

                    {!blindMap && selectedEntry.signatureDrops.length > 0 && (
                        <details className="mt-2 border-t border-white/6 pt-2">
                            <summary className="aether-type-body flex min-h-[44px] cursor-pointer items-center justify-between gap-2 font-readable text-[#f6e7a2]">
                                <span className="flex items-center gap-1.5"><Sparkles size={11} />전설 각인</span>
                                <span>미발견 {selectedEntry.undiscoveredSignatures.length}/{selectedEntry.signatureDrops.length}</span>
                            </summary>
                            <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
                                {selectedEntry.signatureDrops.map(({ name, rate }) => (
                                    <span key={name} className="aether-type-meta rounded-full border border-[#f6e7a2]/20 px-2 py-0.5 font-readable text-[#f6e7a2]/86">
                                        {name} · {Math.max(1, Math.round(rate * 100))}%
                                    </span>
                                ))}
                            </div>
                        </details>
                    )}

                    {!blindMap && selectedEntry.lore && (
                        <details className="mt-1 border-t border-white/6 pt-1">
                            <summary className="aether-type-body flex min-h-[44px] cursor-pointer items-center gap-1.5 font-readable text-slate-400">
                                <Route size={11} />지역 이야기
                            </summary>
                            <p className="aether-type-body pb-1 font-readable text-slate-300/70">{selectedEntry.lore}</p>
                        </details>
                    )}
                </section>
            )}

            <WorldRouteList
                entries={mapEntries}
                selectedName={selectedEntry?.name || ''}
                playerLevel={playerLevel}
                blindMap={blindMap}
                onSelect={selectMap}
            />
        </div>
    );
};

export default MapNavigator;
