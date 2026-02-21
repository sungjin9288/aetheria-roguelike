import React from 'react';
import { motion as Motion } from 'framer-motion';
import { MapPin, Lock } from 'lucide-react';
import { DB } from '../data/db';

/**
 * MapNavigator — 현재 위치 + 연결 지역 노드 맵 시각화 (Feature #6)
 * 레벨 요건 미달 지역은 잠금 표시
 */
const MapNavigator = ({ player, onMove, isAiThinking }) => {
    const currentMap = DB.MAPS[player.loc];
    if (!currentMap) return null;

    const exits = currentMap.exits || [];

    return (
        <div className="bg-cyber-black/60 border border-cyber-blue/20 rounded-lg p-3 backdrop-blur-md">
            <div className="text-cyber-blue/50 text-xs font-fira mb-3 tracking-widest">
                ▸ NAVIGATION MAP
            </div>

            {/* Current Node */}
            <div className="flex flex-col items-center mb-3">
                <Motion.div
                    animate={{ boxShadow: ['0 0 10px rgba(0,204,255,0.3)', '0 0 20px rgba(0,204,255,0.6)', '0 0 10px rgba(0,204,255,0.3)'] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="bg-cyber-blue/20 border-2 border-cyber-blue rounded-lg px-4 py-2 text-center relative"
                >
                    <MapPin size={14} className="inline mr-1 mb-0.5 text-cyber-blue" />
                    <span className="text-cyber-blue font-rajdhani font-bold text-sm">{player.loc}</span>
                    {currentMap.type === 'safe' && (
                        <span className="absolute -top-2 -right-2 text-[10px] bg-cyber-green text-cyber-black px-1 rounded font-bold">SAFE</span>
                    )}
                </Motion.div>

                {exits.length > 0 && (
                    <div className="w-px h-4 bg-cyber-blue/20 mt-1"></div>
                )}
            </div>

            {/* Exit Nodes */}
            <div className={`grid gap-2 ${exits.length <= 2 ? 'grid-cols-' + exits.length : 'grid-cols-2'}`}>
                {exits.map((exit) => {
                    const exitMap = DB.MAPS[exit];
                    if (!exitMap) return null;
                    const reqLv = exitMap.minLv ?? exitMap.level ?? 1;
                    const locked = player.level < reqLv;

                    return (
                        <Motion.button
                            key={exit}
                            whileTap={!locked && !isAiThinking ? { scale: 0.95 } : {}}
                            onClick={() => !locked && !isAiThinking && onMove(exit)}
                            disabled={locked || isAiThinking}
                            className={`relative rounded border p-2 text-center transition-all min-h-[52px] flex flex-col items-center justify-center gap-1
                                ${locked
                                    ? 'border-cyber-blue/10 bg-cyber-dark/20 opacity-40 cursor-not-allowed'
                                    : exitMap.type === 'safe'
                                        ? 'border-cyber-green/30 bg-cyber-green/5 hover:bg-cyber-green/10 text-cyber-green'
                                        : exitMap.boss
                                            ? 'border-red-500/30 bg-red-950/20 hover:bg-red-900/30 text-red-400'
                                            : 'border-cyber-blue/20 bg-cyber-dark/30 hover:bg-cyber-blue/10 text-cyber-blue'
                                }`}
                        >
                            {locked ? (
                                <>
                                    <Lock size={14} className="text-cyber-blue/30" />
                                    <span className="text-cyber-blue/30 text-xs font-fira">Lv.{reqLv}</span>
                                </>
                            ) : (
                                <>
                                    {exitMap.boss && (
                                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] bg-red-600 text-white px-1.5 rounded font-bold">BOSS</span>
                                    )}
                                    <span className="text-xs font-rajdhani font-bold leading-tight">{exit}</span>
                                    <span className="text-[10px] opacity-60 font-fira">Lv.{reqLv}</span>
                                </>
                            )}
                        </Motion.button>
                    );
                })}
            </div>
        </div>
    );
};

export default MapNavigator;
