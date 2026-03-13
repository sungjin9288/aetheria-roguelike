import React from 'react';
import { Check, Lock, MapPin } from 'lucide-react';
import { DB } from '../data/db';
import { getMoveRecommendations } from '../utils/adventureGuide';

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
const MapNavigator = ({ player, stats }) => {
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

    return (
        <div className="bg-cyber-black/60 border border-cyber-blue/20 rounded-lg p-3 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between gap-3 text-xs font-fira">
                <span className="text-cyber-blue/60 tracking-widest">WORLD MAP</span>
                <span className="text-cyber-green">{discoveredCount}/{totalCount} 탐험</span>
            </div>

            <div className="rounded border border-cyber-blue/15 bg-cyber-dark/30 px-3 py-2 text-[11px] font-fira text-cyber-blue/75">
                현재 위치: <span className="text-cyber-green font-bold">{player?.loc}</span>
                <span className="ml-2 text-cyber-blue/40">이동은 `MOVE` 명령 또는 하단 `MOVE` 패널에서만 가능합니다.</span>
            </div>

            {moveRecommendations.length > 0 && (
                <div className="rounded border border-cyber-green/15 bg-cyber-green/5 px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-fira uppercase tracking-[0.16em]">
                        <span className="text-cyber-blue/55">추천 이동</span>
                        <span className="text-cyber-green">{moveRecommendations[0].name}</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        {moveRecommendations.slice(0, 2).map((route) => (
                            <div
                                key={route.name}
                                className={`rounded border px-3 py-2 ${
                                    route.isRecommended
                                        ? 'border-cyber-green/25 bg-cyber-green/10'
                                        : 'border-cyber-blue/15 bg-cyber-black/35'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                    <span className="text-slate-100">{route.name}</span>
                                    <span className={route.isRecommended ? 'text-cyber-green' : 'text-cyber-blue/70'}>
                                        {route.isRecommended ? '추천' : route.badge}
                                    </span>
                                </div>
                                <div className="mt-1 text-[10px] font-fira text-cyber-blue/55">
                                    {route.levelLabel} · {route.reason}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {MAP_ORDER.map((map) => {
                    const isCurrent = player?.loc === map.name;
                    const isVisited = visitedMaps.has(map.name);
                    const levelText = map.level === 'infinite' ? 'Abyss' : `Lv.${map.minLv ?? map.level ?? 1}`;

                    return (
                        <div
                            key={map.name}
                            className={`rounded border px-3 py-2.5 transition-colors ${
                                isCurrent
                                    ? 'border-cyber-green/40 bg-cyber-green/10'
                                    : isVisited
                                        ? 'border-cyber-blue/20 bg-cyber-dark/40'
                                        : 'border-slate-700/70 bg-slate-900/60'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={`font-rajdhani font-bold text-sm truncate ${isCurrent ? 'text-cyber-green' : isVisited ? 'text-cyber-blue' : 'text-slate-400'}`}>
                                        {map.name}
                                    </div>
                                    <div className="mt-1 text-[10px] font-fira text-slate-500">
                                        {map.type === 'safe' ? '마을 / 안전지대' : map.boss ? '보스 지역' : '탐험 지역'} · {levelText}
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    {isCurrent ? (
                                        <span className="inline-flex items-center gap-1 rounded border border-cyber-green/30 bg-cyber-green/10 px-2 py-1 text-[10px] font-fira text-cyber-green">
                                            <MapPin size={11} /> 현재
                                        </span>
                                    ) : isVisited ? (
                                        <span className="inline-flex items-center gap-1 rounded border border-cyber-blue/20 bg-cyber-blue/10 px-2 py-1 text-[10px] font-fira text-cyber-blue">
                                            <Check size={11} /> 탐험 완료
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] font-fira text-slate-500">
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
