import React, { useMemo, useState } from 'react';
import { Check, Compass, Lock, MapPin, Route, Sparkles } from 'lucide-react';
import { DB } from '../data/db';
import { getMoveRecommendations } from '../utils/adventureGuide';
import SignalBadge from './SignalBadge';
import { getGravesAtLoc } from '../utils/graveUtils';
import { getMapProgressState } from '../utils/mapProgress';
import { getMapSignatureDrops, getMapUndiscoveredSignatures } from '../utils/mapSignatureHints';

const MAP_ORDER = Object.entries(DB.MAPS)
    .map(([name, map]) => ({ name, ...map }))
    .sort((a, b) => {
        const aLevel = a.level === 'infinite' ? 999 : (a.minLv ?? a.level ?? 1);
        const bLevel = b.level === 'infinite' ? 999 : (b.minLv ?? b.level ?? 1);
        if (a.type === 'safe' && b.type !== 'safe') return -1;
        if (a.type !== 'safe' && b.type === 'safe') return 1;
        return aLevel - bLevel;
    });

const BAND_CONFIG = [
    { key: 'frontier', label: 'Frontier', maxLevel: 10 },
    { key: 'midlands', label: 'Midlands', maxLevel: 20 },
    { key: 'highlands', label: 'Highlands', maxLevel: 35 },
    { key: 'mythic', label: 'Mythic', maxLevel: 60 },
    { key: 'endgame', label: 'Endgame', maxLevel: Number.POSITIVE_INFINITY },
];

// cycle 56: 가독성 우선. 3 컬럼 + 노드 간격 넉넉하게.
// 이전 (4컬럼 / 84px row gap)에서 같은 band에 5+ 지역이 몰릴 때 겹침 발생.
const NODE_X_PATTERN = [20, 50, 80];
const SAFE_X = 50;
const NODE_WIDTH = 100;
const NODE_HALF = NODE_WIDTH / 2;
const NODE_HEIGHT = 78;
const ROW_GAP = 112;       // band 내 추가 행 간격
const BAND_GAP_BASE = 188; // band 간 간격

const STATUS_THEME = {
    unexplored: {
        label: '미탐험',
        badge: 'neutral',
        card: 'border-white/6 bg-black/16 text-slate-500',
        dot: 'bg-slate-500/70',
    },
    exploring: {
        label: '탐험중',
        badge: 'recommended',
        card: 'border-[#7dd4d8]/18 bg-[#7dd4d8]/10 text-[#dff7f5]',
        dot: 'bg-[#7dd4d8]',
    },
    completed: {
        label: '탐험완료',
        badge: 'equipped',
        card: 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100',
        dot: 'bg-emerald-300',
    },
};

const getBandIndex = (map) => {
    if (map.type === 'safe' && (map.minLv ?? map.level ?? 1) <= 15) return 0;
    const mapLevel = map.level === 'infinite' ? 999 : (map.minLv ?? map.level ?? 1);
    return BAND_CONFIG.findIndex((band) => mapLevel <= band.maxLevel);
};

const buildAtlasLayout = (entries) => {
    const bandRows = new Map();
    const nodeMap = new Map();

    entries.forEach((entry) => {
        const bandIndex = Math.max(0, getBandIndex(entry));
        const bandCount = bandRows.get(bandIndex) || 0;
        const laneIndex = entry.type === 'safe' ? null : bandCount % NODE_X_PATTERN.length;
        const y = 42 + bandIndex * BAND_GAP_BASE + Math.floor(bandCount / NODE_X_PATTERN.length) * ROW_GAP;
        const x = entry.type === 'safe' ? SAFE_X : NODE_X_PATTERN[laneIndex];

        bandRows.set(bandIndex, bandCount + 1);
        nodeMap.set(entry.name, { ...entry, x, y, bandIndex });
    });

    const edges = [];
    const added = new Set();

    entries.forEach((entry) => {
        const source = nodeMap.get(entry.name);
        (entry.exits || []).forEach((targetName) => {
            const target = nodeMap.get(targetName);
            if (!source || !target) return;
            const edgeKey = [entry.name, targetName].sort().join('::');
            if (added.has(edgeKey)) return;
            added.add(edgeKey);
            edges.push({
                key: edgeKey,
                x1: source.x,
                y1: source.y + NODE_HEIGHT / 2,
                x2: target.x,
                y2: target.y + NODE_HEIGHT / 2,
            });
        });
    });

    const maxY = [...nodeMap.values()].reduce((acc, node) => Math.max(acc, node.y), 0);
    return {
        nodeMap,
        edges,
        height: maxY + NODE_HEIGHT + 48,
    };
};

const MapNavigator = ({ player, grave, stats, compact = false }) => {
    const [showAllMaps, setShowAllMaps] = useState(false);
    const [selectedMapName, setSelectedMapName] = useState(player?.loc);
    const currentMap = DB.MAPS[player?.loc];
    const moveRecommendations = getMoveRecommendations(
        player,
        stats || { maxHp: player?.maxHp, maxMp: player?.maxMp },
        currentMap,
        DB.MAPS,
    );

    const mapEntries = useMemo(() => MAP_ORDER.map((map) => {
        const progress = getMapProgressState(map.name, player, DB.MAPS);
        const signatureDrops = getMapSignatureDrops(map.name);
        const undiscoveredSignatures = getMapUndiscoveredSignatures(map.name, player);
        return {
            ...map,
            ...progress,
            graves: getGravesAtLoc(grave, map.name),
            signatureDrops,
            undiscoveredSignatures,
        };
    }), [grave, player]);

    const visibleEntries = compact && !showAllMaps ? mapEntries.slice(0, 14) : mapEntries;
    const atlas = useMemo(() => buildAtlasLayout(visibleEntries), [visibleEntries]);
    const selectedEntry = atlas.nodeMap.get(selectedMapName) || atlas.nodeMap.get(player?.loc) || visibleEntries[0] || null;
    const visibleRecommendations = moveRecommendations.slice(0, compact ? 2 : 3);
    const statusCounts = visibleEntries.reduce((acc, entry) => {
        acc[entry.state] += 1;
        return acc;
    }, { unexplored: 0, exploring: 0, completed: 0 });

    return (
        <div className={`rounded-[1rem] border border-white/8 bg-black/18 backdrop-blur-md ${compact ? 'space-y-2 p-2.5' : 'space-y-3 p-3'}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-slate-500 text-xs font-fira tracking-[0.18em] uppercase">Atlas Map</div>
                    <div className="mt-0.5 text-[11px] font-fira text-slate-300/72">도감 기준으로 맵 진행 상태를 표시합니다.</div>
                </div>
                <div className="flex items-center gap-1.5">
                    <SignalBadge tone="neutral" size="sm">미탐험 {statusCounts.unexplored}</SignalBadge>
                    <SignalBadge tone="recommended" size="sm">탐험중 {statusCounts.exploring}</SignalBadge>
                    <SignalBadge tone="equipped" size="sm">완료 {statusCounts.completed}</SignalBadge>
                </div>
            </div>

            <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] font-fira text-slate-300/80">
                현재 위치 <span className="ml-1 font-semibold text-[#dff7f5]">{player?.loc}</span>
                <span className="ml-2 text-slate-500">이동 경로와 도감 완성도를 한 화면에서 확인합니다.</span>
            </div>

            {visibleRecommendations.length > 0 && (
                <div className="rounded-[0.95rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/8 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                        <span className="text-slate-400">추천 경로</span>
                        <span className="text-[#dff7f5]">{visibleRecommendations[0].name}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {visibleRecommendations.map((route) => (
                            <button
                                key={route.name}
                                type="button"
                                onClick={() => setSelectedMapName(route.name)}
                                className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-black/18 px-2.5 py-1 text-[10px] font-fira text-slate-200/84 hover:border-[#7dd4d8]/18"
                            >
                                <span>{route.name} · {route.levelLabel}</span>
                                {route.undiscoveredSignatureCount > 0 && (
                                    <span
                                        data-testid={`move-recommendation-signature-${route.name}`}
                                        data-signature-count={route.undiscoveredSignatureCount}
                                        className="ml-0.5 inline-flex items-center rounded-full px-1 text-[9px] font-bold leading-none"
                                        style={{
                                            color: '#f6e7a2',
                                            border: '1px solid rgba(246,231,162,0.42)',
                                            background: 'rgba(246,231,162,0.12)',
                                        }}
                                        aria-label={`미발견 전설 각인 ${route.undiscoveredSignatureCount}종`}
                                    >
                                        ✦{route.undiscoveredSignatureCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-[1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.01)_100%)] px-2 py-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                    <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/72">World Routes</div>
                    {compact && mapEntries.length > visibleEntries.length ? (
                        <button
                            type="button"
                            onClick={() => setShowAllMaps((prev) => !prev)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[10px] font-fira text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            {showAllMaps ? '요약 보기' : `+${mapEntries.length - visibleEntries.length} 더 보기`}
                        </button>
                    ) : null}
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <div className="relative min-w-[480px]" style={{ height: `${atlas.height}px` }}>
                        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${atlas.height}`} preserveAspectRatio="none" aria-hidden="true">
                            {atlas.edges.map((edge) => (
                                <line
                                    key={edge.key}
                                    x1={edge.x1}
                                    y1={edge.y1}
                                    x2={edge.x2}
                                    y2={edge.y2}
                                    stroke="rgba(148,163,184,0.22)"
                                    strokeWidth="0.6"
                                    strokeDasharray="2 2"
                                />
                            ))}
                        </svg>

                        {visibleEntries.map((entry) => {
                            const node = atlas.nodeMap.get(entry.name);
                            const theme = STATUS_THEME[entry.state];
                            const isSelected = selectedEntry?.name === entry.name;
                            const isCurrent = entry.isCurrent;
                            const graveCount = entry.graves.length;
                            const graveGold = entry.graves.reduce((sum, item) => sum + Math.max(0, item?.gold || 0), 0);

                            return (
                                <button
                                    key={entry.name}
                                    type="button"
                                    onClick={() => setSelectedMapName(entry.name)}
                                    className={`absolute w-[100px] rounded-[1rem] border px-2 py-2 text-left shadow-[0_14px_28px_rgba(3,8,16,0.18)] transition-all ${theme.card} ${isSelected ? 'ring-1 ring-[#d5b180]/36' : ''}`}
                                    style={{ left: `calc(${node.x}% - ${NODE_HALF}px)`, top: `${node.y}px`, minHeight: `${NODE_HEIGHT}px` }}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                                        {isCurrent ? <MapPin size={11} className="text-[#dff7f5]" /> : entry.state === 'completed' ? <Check size={11} className="text-emerald-200" /> : entry.state === 'exploring' ? <Compass size={11} className="text-[#dff7f5]" /> : <Lock size={11} className="text-slate-500" />}
                                    </div>
                                    <div className="mt-1 truncate text-[11px] font-rajdhani font-bold">{entry.name}</div>
                                    <div className="mt-0.5 text-[9px] font-fira text-slate-300/70">
                                        {entry.progress.discovered}/{entry.progress.total || 0} 도감
                                    </div>
                                    {entry.undiscoveredSignatures.length > 0 && (
                                        <div className="mt-1 text-[9px] font-fira text-[#f6e7a2]/90">
                                            ✦ 전설 {entry.undiscoveredSignatures.length}
                                        </div>
                                    )}
                                    {graveCount > 0 && (
                                        <div className="mt-1 text-[9px] font-fira text-rose-200/82">
                                            유해 {graveCount} · {graveGold}G
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedEntry && (
                <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-rajdhani font-bold text-white/92">{selectedEntry.name}</div>
                                <SignalBadge tone={STATUS_THEME[selectedEntry.state].badge} size="sm">{STATUS_THEME[selectedEntry.state].label}</SignalBadge>
                                {selectedEntry.isCurrent && <SignalBadge tone="recommended" size="sm">현재 위치</SignalBadge>}
                            </div>
                            <div className="mt-1 text-[11px] font-fira text-slate-300/76 leading-snug">{selectedEntry.desc}</div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400/70">{selectedEntry.type === 'safe' ? 'Safe' : 'Danger'}</div>
                            <div className="mt-1 text-[11px] font-fira text-white/86">
                                {selectedEntry.level === 'infinite' ? 'Abyss' : `Lv.${selectedEntry.minLv ?? selectedEntry.level ?? 1}`}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                            <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/70">Codex</div>
                            <div className="mt-1 text-[13px] font-fira font-semibold text-white/88">{selectedEntry.progress.discovered}/{selectedEntry.progress.total || 0}</div>
                        </div>
                        <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                            <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/70">Route</div>
                            <div className="mt-1 text-[13px] font-fira font-semibold text-white/88">{selectedEntry.exits?.length || 0}개</div>
                        </div>
                        <div className="rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                            <div className="text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/70">Signal</div>
                            <div className="mt-1 text-[13px] font-fira font-semibold text-white/88">{selectedEntry.state === 'completed' ? 'CLEAR' : selectedEntry.state === 'exploring' ? 'ACTIVE' : 'SEALED'}</div>
                        </div>
                    </div>

                    <div className="mt-3 rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/72">
                            <Route size={11} />
                            <span>연결 지역</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {(selectedEntry.exits || []).map((exitName) => {
                                const exitState = getMapProgressState(exitName, player, DB.MAPS);
                                return (
                                    <SignalBadge key={`${selectedEntry.name}-${exitName}`} tone={STATUS_THEME[exitState.state].badge} size="sm">
                                        {exitName}
                                    </SignalBadge>
                                );
                            })}
                        </div>
                    </div>

                    {selectedEntry.signatureDrops.length > 0 && (
                        <div
                            className="mt-3 rounded-[0.9rem] px-2.5 py-2"
                            style={{
                                border: '1px solid rgba(246,231,162,0.3)',
                                background: 'linear-gradient(180deg, rgba(246,231,162,0.08) 0%, rgba(20,24,30,0.6) 100%)',
                            }}
                        >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.14em] text-[#f6e7a2]">
                                <span className="flex items-center gap-1.5">
                                    <Sparkles size={11} />
                                    전설 각인 드롭
                                </span>
                                {selectedEntry.undiscoveredSignatures.length > 0 && (
                                    <span className="text-[#fef3c7]">
                                        미발견 {selectedEntry.undiscoveredSignatures.length}/{selectedEntry.signatureDrops.length}
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {selectedEntry.signatureDrops.map(({ name, rate }) => {
                                    const discovered = !selectedEntry.undiscoveredSignatures.find((s) => s.name === name);
                                    return (
                                        <span
                                            key={name}
                                            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-fira ${
                                                discovered
                                                    ? 'border-white/10 bg-white/[0.03] text-slate-400/80'
                                                    : 'border-[#f6e7a2]/30 bg-[#f6e7a2]/6 text-[#fef3c7]'
                                            }`}
                                        >
                                            <span>{discovered ? '✓' : '✦'}</span>
                                            <span>{name}</span>
                                            <span className={discovered ? 'text-slate-500' : 'text-[#f6e7a2]/80'}>
                                                {Math.max(1, Math.round(rate * 100))}%
                                            </span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedEntry.lore && (
                        <div className="mt-3 rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-2.5 py-2 text-[11px] font-fira leading-snug text-slate-300/74">
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.14em] text-slate-400/72">
                                <Sparkles size={11} />
                                <span>Area Lore</span>
                            </div>
                            {selectedEntry.lore}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MapNavigator;
