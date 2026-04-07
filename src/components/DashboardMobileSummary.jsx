import React from 'react';
import { motion as Motion } from 'framer-motion';
import { DB } from '../data/db';
import SignalBadge from './SignalBadge';

/**
 * DashboardMobileSummary — 모바일 Field Snapshot 요약 카드 (mobileSection === 'summary')
 */
const DashboardMobileSummary = ({ player }) => {
    const mapData = DB.MAPS[player?.loc];
    const sectorLabel = mapData?.boss ? '보스 권역' : mapData?.type === 'safe' ? '안전 지대' : '탐험 구역';
    const loadoutEntries = [
        { label: 'LEFT', item: player?.equip?.offhand, fallback: 'EMPTY' },
        { label: 'RIGHT', item: player?.equip?.weapon, fallback: 'EMPTY' },
        { label: 'ARMOR', item: player?.equip?.armor, fallback: 'EMPTY' },
    ];

    return (
        <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden panel-noise aether-surface rounded-[1.7rem] px-3 py-3 overflow-hidden"
        >
            <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-[#d5b180]/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-[#7dd4d8]/8 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-fira uppercase tracking-[0.2em] text-slate-400/68">
                        Field Snapshot
                    </div>
                    <div className="mt-1 truncate text-[16px] font-rajdhani font-bold tracking-[0.04em] text-white/94">
                        {player?.loc}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-fira text-slate-300/74">
                        <span className="aether-pill rounded-full px-2 py-0.5 uppercase tracking-[0.16em]">{player?.job}</span>
                        <span className="aether-pill rounded-full px-2 py-0.5 uppercase tracking-[0.16em]">Lv.{player?.level}</span>
                        <span className="truncate">{sectorLabel}</span>
                    </div>
                </div>
                <SignalBadge
                    tone={mapData?.boss ? 'danger' : mapData?.type === 'safe' ? 'upgrade' : 'neutral'}
                    size="sm"
                >
                    {mapData?.boss ? '보스' : mapData?.type === 'safe' ? '안전' : '탐험'}
                </SignalBadge>
            </div>

            <div className="relative mt-3 grid grid-cols-3 gap-1.5 rounded-[1.15rem] border border-white/8 bg-black/18 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                {loadoutEntries.map((entry) => (
                    <div
                        key={entry.label}
                        className="min-w-0 rounded-[1rem] aether-panel-muted px-2 py-1.75"
                    >
                        <div className="text-[8px] font-fira uppercase tracking-[0.18em] text-slate-500">
                            {entry.label}
                        </div>
                        <div className="mt-1 flex items-center gap-1 min-w-0">
                            <span className="truncate text-[10px] font-fira leading-none text-slate-200/88">
                                {entry.item?.name || entry.fallback}
                            </span>
                            {(entry.item?.enhance || 0) > 0 && (
                                <span className="shrink-0 text-[11px] font-bold font-fira text-[#d5b180]">+{entry.item.enhance}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Motion.div>
    );
};

export default DashboardMobileSummary;
