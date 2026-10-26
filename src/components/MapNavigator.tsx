import { useMemo, useState } from 'react';
import { ArrowRight, Check, Compass, LockKeyhole, Route, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import type { FullStats, GameMap, Player } from '../types/index.js';
import { getMoveRecommendations, type MoveRecommendation } from '../utils/adventureGuide';
import { getGravesAtLoc, type GraveEntry } from '../utils/graveUtils';
import { canBossAppearInMap } from '../utils/bossPresence';
import { getExitBadges } from '../utils/mapBadges';
import { getMapProgressState } from '../utils/mapProgress';
import { getMapRouteGate, type MapRouteGate } from '../utils/mapRouteGate';
import { getMapDiscoveredSignatureDrops } from '../utils/mapSignatureHints';
import { getDefaultMapSelection, getMapRequiredLevel, getNextMapTowardTarget } from '../utils/mapTopology';
import RouteTopology, { type RouteTopologyEntry } from './RouteTopology';
import SignalChip from './archive/SignalChip';
import ActionButton from './ui/ActionButton';
import { getExpeditionFocusRouteTargets, getFocusedExpeditionQuestEntries } from '../utils/expeditionMissionFocus';
import type { GameActions } from '../hooks/actionDeps';
import type { GameState } from '../reducers/gameReducer';

type MapState = 'unexplored' | 'exploring' | 'completed';

interface MapEntry extends GameMap {
    name: string;
    state: MapState;
    isCurrent: boolean;
    progress: { discovered: number; total: number; remaining: number };
    graves: GraveEntry[];
    /** 2026-10 Wave 103: 이 지역에서 나오는 각인 중 이미 도감에 있는 것만 — 아직 없는 각인의 획득처는 플레이어가 알아낸다. */
    signatureDrops: Array<{ name: string; rate: number }>;
    badges: Array<{ id: string; label: string }>;
    routeGate: MapRouteGate | null;
    /** 이 플레이어에게 이 지역에서 보스가 실제로 나올 수 있는가(`canBossAppearInMap`) — 배지 · 위험 · 예상 · 경로 노드가 같이 읽는다. */
    bossCanAppear: boolean;
}

interface MapNavigatorProps {
    player: Player;
    grave: GameState['grave'] | undefined;
    stats: FullStats | null | undefined;
    actions?: Pick<GameActions, 'move'>;
}

const MAP_ORDER = Object.entries(DB.MAPS)
    .map(([name, map]) => ({ name, ...map }))
    .sort((left, right) => {
        // 2026-09 N3: `minLv` 우선 분기 제거 — MAPS 52개 중 정의 0개라 도달 불가였다.
        const leftLevel = left.level === 'infinite' ? 999 : (left.level ?? 1);
        const rightLevel = right.level === 'infinite' ? 999 : (right.level ?? 1);
        if (left.type === 'safe' && right.type !== 'safe') return -1;
        if (left.type !== 'safe' && right.type === 'safe') return 1;
        return Number(leftLevel) - Number(rightLevel);
    });

const MAP_BANDS = [
    { key: 'frontier', label: '변방', maxLevel: 10 },
    { key: 'midlands', label: '중부', maxLevel: 20 },
    { key: 'highlands', label: '고지', maxLevel: 35 },
    { key: 'mythic', label: '신화', maxLevel: 60 },
    { key: 'endgame', label: '종장', maxLevel: Number.POSITIVE_INFINITY },
];

const getBandIndex = (map: GameMap) => {
    const level = map.level === 'infinite' ? 999 : getMapRequiredLevel(map, 1);
    if (map.type === 'safe' && level <= 15) return 0;
    return MAP_BANDS.findIndex((band) => level <= band.maxLevel);
};

/**
 * 2026-10 Wave 61: 띠의 레벨 범위는 그 띠에 실제로 놓인 지역에서 센다. 고정 문구 '레벨 1~10'이던 동안 변방에는
 * 정비 지역 묶음 규칙(safe ≤ 15)으로 Lv15 여행자의 쉼터가 들어 있었다. 잠금이 없는 지역(심연)이 있으면 열린 범위다.
 */
const getBandLevelLabel = (bandIndex: number) => {
    const members = MAP_ORDER.filter((map) => getBandIndex(map) === bandIndex);
    const levels = members
        .filter((map) => map.level !== 'infinite')
        .map((map) => getMapRequiredLevel(map, 1));
    if (levels.length === 0) return '';
    const minLevel = Math.min(...levels);
    return members.some((map) => map.level === 'infinite')
        ? MSG.MAP_BAND_LEVEL_FROM(minLevel)
        : MSG.MAP_BAND_LEVEL_RANGE(minLevel, Math.max(...levels));
};

const MAP_BAND_LEVEL_LABELS = MAP_BANDS.map((_, bandIndex) => getBandLevelLabel(bandIndex));

const MAP_STATE = {
    unexplored: { label: '미탐험', badge: 'neutral', dot: 'bg-ae-ink-3/70' },
    exploring: { label: '탐험 중', badge: 'recommended', dot: 'bg-ae-ether' },
    completed: { label: '탐험 완료', badge: 'equipped', dot: 'bg-ae-good' },
} as const;

const formatMapLevel = (map: GameMap | null | undefined, playerLevel = 1) => (
    map?.level === 'infinite' ? '심연' : `레벨 ${getMapRequiredLevel(map, playerLevel)}`
);

/**
 * 2026-09 Wave 13 E2: 카드가 보여주던 `formatMapLevel`은 그 지역 **자신의 잠금**이다
 * (이동 권한도 그대로 이 값으로 판정된다 — `getMapAccess`). 하지만 52곳 중 16곳은
 * 거기까지 가는 모든 길이 더 높은 지역을 지나 실제 진입선이 더 위에 있고(Wave 27부터 시즌 없는
 * 실제 이동 규칙으로 센다 — 도보 경로가 없는 3곳은 진입 레벨이 없다), 무한 심연은 잠금이
 * 아예 없어 숫자조차 없었다. 갈라지는 곳에서만 실제 진입 레벨을
 * 덧붙인다 — 값은 `utils/mapRouteGate.ts`(증빙 리포트와 같은 authority), 문구는 MSG.
 */
const getRouteGateNotice = (routeGate: MapRouteGate | null | undefined) => {
    if (!routeGate?.diverges || routeGate.routeGateLevel === null) return null;
    return {
        level: MSG.MAP_ROUTE_GATE_LEVEL(routeGate.routeGateLevel),
        note: routeGate.declaredIsLocked
            ? MSG.MAP_ROUTE_GATE_NOTE(routeGate.declaredGateLevel, routeGate.routeGateLevel)
            : MSG.MAP_ROUTE_GATE_NOTE_UNGATED(routeGate.routeGateLevel),
    };
};

const getRiskLabel = (map: MapEntry, playerLevel: number) => {
    if (map.type === 'safe') return '안전';
    if (map.bossCanAppear) return '보스';

    const gap = getMapRequiredLevel(map, playerLevel) - playerLevel;
    if (gap > 0) return '레벨 부족';
    if (gap >= -1) return '경계';
    return '적정';
};

const getEncounterLabel = (map: MapEntry, route: MoveRecommendation | undefined) => {
    if (map.type === 'safe') return '정비';
    if (map.bossCanAppear) return '보스 교전';
    return route?.routePlan?.approach || '일반 교전';
};

/** 배지 id → SignalChip tone. 목록 행과 선택 카드가 같은 표를 쓴다(색 의미 일관). */
const BADGE_TONE: Record<string, string> = {
    boss: 'danger',
    bossGauge: 'warning',
    shop: 'upgrade',
    highEvent: 'recommended',
    grave: 'recommended',
};

const getRewardLabel = (entry: MapEntry) => {
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
    <details data-testid="map-world-list" className="ae-card is-quiet group px-3">
        <summary data-testid="map-world-list-toggle" className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-readable text-[13px] font-semibold text-ae-ink [&::-webkit-details-marker]:hidden">
            <span>전체 경로</span>
            <span className="text-[12px] font-normal text-ae-ink-3">{blindMap ? '도전 규칙으로 비공개' : `${entries.length}곳`}</span>
        </summary>

        {blindMap ? (
            <div className="border-t border-ae-ink/10 py-3 font-readable text-[12px] text-ae-ink-3">
                현재 위치에서 이어진 경로만 확인할 수 있습니다.
            </div>
        ) : (
            <div className="space-y-4 border-t border-ae-ink/10 pb-3 pt-3">
                {MAP_BANDS.map((band, bandIndex) => {
                    const bandEntries = entries.filter((entry) => getBandIndex(entry) === bandIndex);
                    if (bandEntries.length === 0) return null;

                    return (
                        <section key={band.key} className="space-y-1.5">
                            <div className="aether-type-meta flex items-center justify-between px-1 font-readable text-ae-ink-3">
                                <span className="ae-eyebrow text-ae-ink-2">{band.label}</span>
                                <span data-testid="map-band-level">{MAP_BAND_LEVEL_LABELS[bandIndex]}</span>
                            </div>
                            <div className="ae-rows">
                                {bandEntries.map((entry) => {
                                    const state = MAP_STATE[entry.state];
                                    const selected = selectedName === entry.name;
                                    const routeNotice = getRouteGateNotice(entry.routeGate);

                                    return (
                                        <button
                                            key={entry.name}
                                            type="button"
                                            data-testid="map-row"
                                            onClick={() => onSelect(entry.name)}
                                            data-active={selected ? 'true' : 'false'}
                                            aria-pressed={selected}
                                            className="ae-select-row flex min-h-[44px] w-full flex-col gap-1 rounded-ae-sm px-1.5 py-2 text-left"
                                        >
                                            <span className="flex w-full items-center gap-2">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} />
                                                <span className="aether-type-body min-w-0 flex-1 font-readable font-semibold text-ae-ink">{entry.name}</span>
                                                <span className="aether-type-meta shrink-0 font-readable text-ae-ink-3">{formatMapLevel(entry, playerLevel)}</span>
                                                {entry.state === 'completed'
                                                    ? <Check size={12} className="shrink-0 text-ae-good" aria-label="탐험 완료" />
                                                    : entry.state === 'exploring'
                                                        ? <Compass size={12} className="shrink-0 text-ae-ether-hi" aria-label="탐험 중" />
                                                        : <LockKeyhole size={12} className="shrink-0 text-ae-ink-3" aria-label="미탐험" />}
                                            </span>
                                            {/* 2026-09 G10: 배지를 선택 카드에서만 보여주던 것을 모든 행으로.
                                                "갈 이유"를 목록에서 바로 비교할 수 있어야 한다.
                                                2026-09 E2: 오른쪽 레벨 칩은 지역 자신의 잠금 그대로 두고,
                                                실제 진입 레벨이 다른 곳만 배지 한 칸을 더 쓴다(행 폭을 안 건드린다). */}
                                            {(entry.badges.length > 0 || routeNotice) && (
                                                <span data-testid="map-row-badges" className="flex flex-wrap gap-1 pl-4">
                                                    {routeNotice && (
                                                        <SignalChip data-testid="map-row-route-gate" tone="warning">
                                                            {routeNotice.level}
                                                        </SignalChip>
                                                    )}
                                                    {entry.badges.map((badge) => (
                                                        <SignalChip key={badge.id} tone={BADGE_TONE[badge.id] || 'recommended'}>
                                                            {badge.label}
                                                        </SignalChip>
                                                    ))}
                                                </span>
                                            )}
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
    const playerLoc = player.loc ?? '';
    const [selection, setSelection] = useState<{ origin: string; name: string | null }>({
        origin: playerLoc,
        name: null,
    });
    const selectedMapName = selection.origin === playerLoc ? selection.name : null;
    const selectMap = (name: string) => setSelection({ origin: playerLoc, name });
    const currentMap = DB.MAPS[playerLoc];
    const playerLevel = player.level || 1;
    const blindMap = player.challengeModifiers?.includes('blindMap') || false;
    // H5(c): 가짜 stats 폴백 제거 — getMoveRecommendations가 내부에서 player.maxHp/maxMp로 폴백한다.
    const moveRecommendations = getMoveRecommendations(player, stats, currentMap, DB.MAPS);
    const focusedQuestEntries = getFocusedExpeditionQuestEntries(player);
    const questTargets = getExpeditionFocusRouteTargets(player).filter((target) => DB.MAPS[target]);
    const questNextSteps = new Set(questTargets
        .map((target) => getNextMapTowardTarget(DB.MAPS, playerLoc, target))
        .filter(Boolean));

    const mapEntries = useMemo<MapEntry[]>(() => MAP_ORDER.map((map) => {
        const progress = getMapProgressState(map.name, player, DB.MAPS);
        return {
            ...map,
            ...progress,
            graves: getGravesAtLoc(grave, map.name),
            signatureDrops: getMapDiscoveredSignatureDrops(map.name, player),
            badges: getExitBadges(map, player, map.name),
            routeGate: getMapRouteGate(DB.MAPS, map.name),
            bossCanAppear: canBossAppearInMap(map.name, map, player),
        } as MapEntry;
    }), [grave, player]);

    const entriesByName = useMemo(
        () => new Map(mapEntries.map((entry) => [entry.name, entry])),
        [mapEntries],
    );

    const topologyRoutes: RouteTopologyEntry[] = moveRecommendations.map((route) => {
        const entry = entriesByName.get(route.name);
        return {
            ...route,
            isMissionRoute: questNextSteps.has(route.name),
            isBoss: Boolean(entry?.bossCanAppear),
            isLocked: playerLevel < getMapRequiredLevel(entry, playerLevel),
        };
    });

    const defaultSelection = getDefaultMapSelection(playerLoc, topologyRoutes);
    const selectedName = selectedMapName || defaultSelection;
    const selectedEntry = entriesByName.get(selectedName) || entriesByName.get(playerLoc) || mapEntries[0];
    const selectedRoute = moveRecommendations.find((route) => route.name === selectedEntry?.name);
    const selectedIsDirectExit = Boolean(selectedRoute);
    const selectedRequiredLevel = getMapRequiredLevel(selectedEntry, playerLevel);
    const selectedIsLocked = selectedIsDirectExit && playerLevel < selectedRequiredLevel;
    const selectedIsCurrent = selectedEntry?.name === playerLoc;
    const canMove = selectedIsDirectExit && !selectedIsLocked && typeof actions?.move === 'function';
    // 2026-10 Wave 62 (원장 §61.2 A10): 길 잃은 여행은 직접 출구만이 아니라 현재 위치 카드도 감춘다(이름 · 설명 · 레벨 · 위험).
    //   이동해도 지역 정보는 드러나지 않는다 — 이동 로그 · 터미널도 숨긴다(utils/challengeRules.ts).
    const hideSelected = blindMap && (selectedIsDirectExit || selectedIsCurrent);
    const selectedDisplayName = hideSelected
        ? (selectedIsCurrent ? MSG.BLIND_MAP_LOCATION : '미확인 경로')
        : selectedEntry?.name;
    const selectedDescription = hideSelected
        ? (selectedIsCurrent ? MSG.MOVE_AREA_DESC_BLIND : MSG.BLIND_MAP_ROUTE_DESC)
        : selectedEntry?.desc;
    const selectedMissionCount = focusedQuestEntries.filter((entry) => entry.targetMaps.includes(selectedEntry?.name)).length;
    // blindMap(도전 규칙)에서는 경로 정보를 감추므로 진입 레벨도 같이 감춘다.
    const selectedRouteNotice = hideSelected
        ? null
        : getRouteGateNotice(selectedEntry?.routeGate);
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
                ? (blindMap ? MSG.MAP_MOVE_TO_BLIND : MSG.MAP_MOVE_TO(selectedEntry?.name ?? ''))
                : '연결 경로에서 선택';

    return (
        <div data-testid="map-navigator" className="space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-1">
                <div className="min-w-0 flex-[1_1_10rem]">
                    <div className="ae-eyebrow">세계 지도</div>
                    <h2 className="aether-type-title mt-0.5 font-readable font-semibold text-ae-ink">
                        {blindMap ? '현재 위치에서 이어진 길' : `${playerLoc}에서 이어진 길`}
                    </h2>
                </div>
                <div data-testid="map-progress-summary" className="ae-well ae-cols grid shrink-0 grid-cols-3" aria-label="지도 진행 요약">
                    {[
                        { label: '미탐험', value: statusCounts.unexplored },
                        { label: '진행', value: statusCounts.exploring },
                        { label: '완료', value: statusCounts.completed },
                    ].map((item) => (
                        <div key={item.label} className="min-w-[44px] px-2 py-1 text-center font-readable">
                            <div className="text-[11px] text-ae-ink-3">{item.label}</div>
                            <strong className="font-fira text-[15px] tabular-nums text-ae-ink">{item.value}</strong>
                        </div>
                    ))}
                </div>
            </header>

            <RouteTopology
                testId="map-topology"
                currentTestId="map-current-location-card"
                connectorTestId="map-route-overview"
                currentName={playerLoc}
                routes={topologyRoutes}
                selectedName={selectedEntry?.name}
                blindMap={blindMap}
                onSelect={(route) => selectMap(route.name)}
                routeTestId={(route, index) => route.isRecommended ? 'map-primary-route' : `map-topology-route-${index}`}
            />

            {selectedEntry && (
                <section data-testid="map-selected-detail" className="ae-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="aether-type-title font-readable font-semibold text-ae-ink">{selectedDisplayName}</h3>
                                {!blindMap && (
                                    <SignalChip tone={MAP_STATE[selectedEntry.state].badge}>
                                        {MAP_STATE[selectedEntry.state].label}
                                    </SignalChip>
                                )}
                                {!blindMap && selectedMissionCount > 0 && (
                                    <SignalChip tone="recommended">집중 임무 <span className="font-fira tabular-nums">{selectedMissionCount}</span></SignalChip>
                                )}
                            </div>
                            <p className="aether-type-body mt-1 font-readable text-ae-ink-2">
                                {selectedDescription}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <span className="aether-type-meta font-readable font-semibold text-ae-ether-hi">
                                {hideSelected ? '정보 없음' : formatMapLevel(selectedEntry, playerLevel)}
                            </span>
                            {selectedRouteNotice && (
                                <div data-testid="map-route-gate-level" className="aether-type-label mt-0.5 font-readable text-ae-gold-text">
                                    {selectedRouteNotice.level}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5 min-[401px]:grid-cols-4" data-testid="map-route-forecast">
                        {[
                            { label: '위험', value: hideSelected ? '미확인' : getRiskLabel(selectedEntry, playerLevel) },
                            { label: '예상', value: hideSelected ? '미확인' : getEncounterLabel(selectedEntry, selectedRoute) },
                            { label: '보상', value: hideSelected ? '미확인' : getRewardLabel(selectedEntry) },
                            { label: '귀환', value: selectedRoute?.routePlan?.returnLabel || (selectedIsCurrent ? '현재 위치' : '경로 확인') },
                        ].map((item) => (
                            <div key={item.label} className="ae-sunk min-w-0 rounded-ae-sm px-2 py-1.5">
                                <div className="aether-type-label font-readable text-ae-ink-3">{item.label}</div>
                                <div className="aether-type-meta mt-0.5 break-words font-readable font-semibold text-ae-ink">{item.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* 위 칸의 '위험'/'레벨'이 선언 잠금 기준이므로, 갈라지는 지역에서는
                        그 숫자가 왜 진입 레벨이 아닌지 바로 아래에서 말한다. */}
                    {selectedRouteNotice && (
                        <p data-testid="map-route-gate-note" className="aether-type-meta mt-2 font-readable text-ae-gold-text">
                            {selectedRouteNotice.note}
                        </p>
                    )}

                    {selectedRoute && !blindMap && (
                        <p className="aether-type-meta mt-2 font-readable text-ae-ink-2">
                            {selectedRoute.reason}
                        </p>
                    )}

                    <ActionButton
                        variant="primary"
                        data-testid="map-move-selected"
                        disabled={!canMove}
                        onClick={moveToSelectedMap}
                        className="mt-3 w-full px-3 text-[14px]"
                        label={(
                            <>
                                <span>{moveButtonLabel}</span>
                                {canMove && <ArrowRight size={15} aria-hidden="true" />}
                            </>
                        )}
                    />

                    {!blindMap && selectedEntry.badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {selectedEntry.badges.map((badge) => (
                                <SignalChip key={badge.id} tone={BADGE_TONE[badge.id] || 'recommended'}>
                                    {badge.label}
                                </SignalChip>
                            ))}
                        </div>
                    )}

                    {!blindMap && selectedEntry.signatureDrops.length > 0 && (
                        <details className="mt-2 border-t border-ae-ink/10 pt-1">
                            <summary className="aether-type-body flex min-h-[44px] cursor-pointer items-center justify-between gap-2 font-readable text-ae-gold-hi">
                                <span className="flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" />전설 각인</span>
                                <span className="font-fira tabular-nums">{selectedEntry.signatureDrops.length}</span>
                            </summary>
                            <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
                                {selectedEntry.signatureDrops.map(({ name, rate }) => (
                                    <span key={name} className="ae-chip ae-chip-gold max-w-full whitespace-normal">
                                        {name} · <span className="font-fira tabular-nums">{Math.max(1, Math.round(rate * 100))}%</span>
                                    </span>
                                ))}
                            </div>
                        </details>
                    )}

                    {!blindMap && selectedEntry.lore && (
                        <details className="mt-1 border-t border-ae-ink/10 pt-1">
                            <summary className="aether-type-body flex min-h-[44px] cursor-pointer items-center gap-1.5 font-readable text-ae-ink-2">
                                <Route size={12} aria-hidden="true" />지역 이야기
                            </summary>
                            <p className="aether-type-body pb-1 font-readable text-ae-ink-2">{selectedEntry.lore}</p>
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
