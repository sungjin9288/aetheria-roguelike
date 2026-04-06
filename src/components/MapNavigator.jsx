import React, { useState } from 'react';
import { Check, Lock, MapPin } from 'lucide-react';
import { DB } from '../data/db';
import { getMoveRecommendations } from '../utils/adventureGuide';
import SignalBadge from './SignalBadge';
import { getGravesAtLoc } from '../utils/graveUtils';

const MAP_ORDER = Object.entries(DB.MAPS)
    .map(([name, map]) => ({ name, ...map }))
    .sort((a, b) => {
        const aLevel = a.level === 'infinite' ? 999 : (a.minLv ?? a.level ?? 1);
        const bLevel = b.level === 'infinite' ? 999 : (b.minLv ?? b.level ?? 1);
        if (a.type === 'safe' && b.type !== 'safe') return -1;
        if (a.type !== 'safe' && b.type === 'safe') return 1;
        return aLevel - bLevel;
    });

/**
 * MapNavigator — 읽기 전용 월드맵
 * 이동은 MOVE 커맨드/패널만 사용하고, 여기서는 탐험한 지역 확인만 제공합니다.
 */
const MapNavigator = ({ player, grave, stats, compact = false }) => {
    const [showAllMaps, setShowAllMaps] = useState(false);
    const visitedMaps = new Set([...(player?.stats?.visitedMaps || []), player?.loc]);
    const discoveredCount = visitedMaps.size;
    const totalCount = MAP_ORDER.length;
    const currentMap = DB.MAPS[player?.loc];
    const moveRecommendations = getMoveRecommendations(
        player,
        stats || { maxHp: player?.maxHp, maxMp: player?.maxMp },
        currentMap,
        DB.MAPS
    );
    const visibleRecommendations = moveRecommendations.slice(0, compact ? 1 : 2);
    const compactVisibleMaps = (() => {
        const orderedNames = [];
        const pushName = (name) => {
            if (!name || orderedNames.includes(name)) return;
            orderedNames.push(name);
        };

        pushName(player?.loc);
        MAP_ORDER.filter((map) => getGravesAtLoc(grave, map.name).length > 0).forEach((map) => pushName(map.name));
        moveRecommendations.slice(0, 2).forEach((route) => pushName(route.name));
        MAP_ORDER.filter((map) => visitedMaps.has(map.name)).forEach((map) => pushName(map.name));
        MAP_ORDER.forEach((map) => pushName(map.name));

        return orderedNames.slice(0, 5);
    })();
    const visibleMapEntries = compact && !showAllMaps
        ? compactVisibleMaps
            .map((name) => MAP_ORDER.find((map) => map.name === name))
            .filter(Boolean)
        : MAP_ORDER;
    const hiddenMapCount = Math.max(0, MAP_ORDER.length - visibleMapEntries.length);

    return (
        <div className={`bg-black/18 border border-white/8 rounded-[1rem] backdrop-blur-md ${compact ? 'space-y-1.5 p-2' : 'space-y-3 p-3'}`}>
            <div className={`flex items-center justify-between gap-3 font-fira ${compact ? 'text-[11px]' : 'text-xs'}`}>
                <span className="text-slate-500 tracking-[0.18em] uppercase">World Map</span>
                <SignalBadge tone="recommended" size="sm">{discoveredCount}/{totalCount} 탐험</SignalBadge>
            </div>

            <div className={`rounded-[0.95rem] border border-white/8 bg-white/[0.03] font-fira text-slate-300/78 ${compact ? 'px-2 py-1.25 text-[10px]' : 'px-3 py-2 text-[11px]'}`}>
                현재 위치 <span className="ml-1 text-[#dff7f5] font-bold">{player?.loc}</span>
                {currentMap?.level === 'infinite' && (
                    <span className="ml-2 text-[#d9d0f3] font-bold">
                        🌀 심연 {player?.stats?.abyssFloor || 1}층 (층당 스탯 +8%)
                    </span>
                )}
                {(player?.stats?.abyssRecord || 0) > 0 && (
                    <span className="ml-2 text-[#c4b5fd] text-[10px]">
                        최고 {player.stats.abyssRecord}층
                    </span>
                )}
                <span className="ml-2 text-slate-500">{compact ? '이동은 `MOVE`' : '이동은 `MOVE` 명령 또는 하단 `MOVE` 패널에서만 가능합니다.'}</span>
            </div>

            {visibleRecommendations.length > 0 && (
                <div className={`rounded-[0.95rem] border border-[#7dd4d8]/18 bg-[#7dd4d8]/8 ${compact ? 'space-y-1 px-2 py-1.5' : 'space-y-2 px-3 py-2.5'}`}>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                        <span className="text-slate-400">추천 이동</span>
                        <span className="text-[#dff7f5]">{visibleRecommendations[0].name}</span>
                    </div>
                    <div className={`grid ${compact ? 'gap-1.5' : 'gap-2 md:grid-cols-2'}`}>
                        {visibleRecommendations.map((route) => (
                            <div
                                key={route.name}
                                className={`rounded border ${compact ? 'px-2 py-1.25' : 'px-3 py-2'} ${
                                    route.isRecommended
                                        ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10'
                                        : 'border-white/8 bg-black/18'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                    <span className="text-slate-100">{route.name}</span>
                                    <span>
                                        <SignalBadge tone={route.isRecommended ? 'recommended' : 'neutral'} size="sm">
                                        {route.isRecommended ? '추천' : route.badge}
                                        </SignalBadge>
                                    </span>
                                </div>
                                <div className={`${compact ? 'mt-0.25 text-[9px]' : 'mt-1 text-[10px]'} font-fira text-slate-400/72`}>
                                    {compact ? route.levelLabel : `${route.levelLabel} · ${route.reason}`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {compact && (
                <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                    <span className="text-slate-500">{showAllMaps ? '전체 지도' : '우선 지역'}</span>
                    {hiddenMapCount > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowAllMaps(true)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            +{hiddenMapCount} 더 보기
                        </button>
                    ) : showAllMaps ? (
                        <button
                            type="button"
                            onClick={() => setShowAllMaps(false)}
                            className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] text-slate-300/78 hover:bg-white/[0.04]"
                        >
                            요약 보기
                        </button>
                    ) : null}
                </div>
            )}

            <div className={`grid grid-cols-1 ${compact ? 'gap-1' : 'gap-2 xl:grid-cols-2'}`}>
                {visibleMapEntries.map((map) => {
                    const isCurrent = player?.loc === map.name;
                    const isVisited = visitedMaps.has(map.name);
                    const gravesAtMap = getGravesAtLoc(grave, map.name);
                    const hasGrave = gravesAtMap.length > 0;
                    const graveGold = gravesAtMap.reduce((total, entry) => total + Math.max(0, entry?.gold || 0), 0);
                    const levelText = map.level === 'infinite' ? 'Abyss' : `Lv.${map.minLv ?? map.level ?? 1}`;

                    return (
                        <div
                            key={map.name}
                            className={`rounded border transition-colors ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'} ${
                                isCurrent
                                    ? 'border-[#7dd4d8]/24 bg-[#7dd4d8]/10'
                                    : hasGrave
                                        ? 'border-rose-300/24 bg-rose-400/10'
                                        : isVisited
                                            ? 'border-white/8 bg-black/18'
                                            : 'border-white/6 bg-black/12'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={`font-rajdhani font-bold ${compact ? 'text-[12px]' : 'text-sm'} truncate ${isCurrent ? 'text-[#dff7f5]' : hasGrave ? 'text-rose-200' : isVisited ? 'text-slate-100' : 'text-slate-500'}`}>
                                        {hasGrave && <span className="mr-1 text-rose-300">✝</span>}
                                        {map.name}
                                    </div>
                                    <div className={`${compact ? 'mt-0.5 text-[9px]' : 'mt-1 text-[10px]'} font-fira text-slate-500`}>
                                        {map.type === 'safe' ? '마을 / 안전지대' : map.boss ? '보스 지역' : '탐험 지역'} · {levelText}
                                        {hasGrave && <span className="ml-1 text-rose-300/80">· 유해 {gravesAtMap.length}구 · {graveGold}G</span>}
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    {isCurrent ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-[#7dd4d8]/24 bg-[#7dd4d8]/10 px-2 py-1 text-[10px] font-fira text-[#dff7f5]">
                                            <MapPin size={11} /> 현재
                                        </span>
                                    ) : hasGrave ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/24 bg-rose-400/10 px-2 py-1 text-[10px] font-fira text-rose-200">
                                            ✝ 사망 지점 {gravesAtMap.length > 1 ? `x${gravesAtMap.length}` : ''}
                                        </span>
                                    ) : isVisited ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-fira text-slate-200/82">
                                            <Check size={11} /> 탐험 완료
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-white/6 px-2 py-1 text-[10px] font-fira text-slate-500">
                                            <Lock size={11} /> 미탐험
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MapNavigator;
