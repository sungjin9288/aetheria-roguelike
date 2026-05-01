import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Player } from '../types/index.js';
import { getTraitProfile } from '../utils/runProfile';
import { isSignatureItem } from '../data/signatureItems.js';

interface DashboardMobileSummaryProps {
    player?: Player | null;
}

/**
 * DashboardMobileSummary — 장비 로드아웃 + 한눈에 보기 상태 pill 스트립
 * StatusBar와 중복되는 위치/직업/레벨 정보는 제거하고 핵심 진행 상태만 표시
 */
const DashboardMobileSummary = ({ player }: DashboardMobileSummaryProps) => {
    const loadoutEntries = [
        { label: 'LEFT', item: player?.equip?.offhand, fallback: 'EMPTY' },
        { label: 'RIGHT', item: player?.equip?.weapon, fallback: 'EMPTY' },
        { label: 'ARMOR', item: player?.equip?.armor, fallback: 'EMPTY' },
    ];

    const statusPills = useMemo(() => {
        if (!player) return [];
        const pills: any[] = [];
        const activeQuests = player.quests?.filter((q: any) => !q.done)?.length || 0;
        const completedQuests = player.quests?.filter((q: any) => q.done)?.length || 0;
        if (activeQuests > 0 || completedQuests > 0) {
            pills.push({ key: 'quest', label: `퀘스트 ${completedQuests}/${activeQuests + completedQuests}`, tone: completedQuests > 0 ? 'success' : 'neutral' });
        }
        const relicCount = player.relics?.length || 0;
        if (relicCount > 0) {
            pills.push({ key: 'relic', label: `유물 ×${relicCount}`, tone: 'resonance' });
        }
        const trait = getTraitProfile(player);
        if (trait?.label) {
            pills.push({ key: 'trait', label: trait.label, tone: 'recommended' });
        }
        const codex = player.stats?.codex;
        if (codex) {
            const count: number = (Object.values(codex) as any[]).reduce((sum: number, cat: any) => sum + Object.keys(cat || {}).length, 0);
            if (count > 0) pills.push({ key: 'codex', label: `도감 ${count}`, tone: 'neutral' });
        }
        const passTier = player.seasonPass?.tier || 0;
        if (passTier > 0) {
            pills.push({ key: 'pass', label: `Pass Lv.${passTier}`, tone: 'upgrade' });
        }
        return pills;
    }, [player]);

    return (
        <Motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel-noise aether-surface rounded-[1.7rem] px-3 py-2.5 overflow-hidden"
        >
            {/* 장비 로드아웃 */}
            <div className="grid grid-cols-3 gap-1.5 rounded-[1.15rem] border border-white/8 bg-black/18 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                {loadoutEntries.map((entry: any) => {
                    const isSignature = entry.item ? isSignatureItem(entry.item) : false;
                    const tileStyle = isSignature
                        ? {
                            border: '1px solid rgba(246,231,162,0.42)',
                            background: 'linear-gradient(180deg, rgba(246,231,162,0.12) 0%, rgba(18,16,10,0.72) 100%)',
                        }
                        : undefined;
                    const tileClassName = isSignature
                        ? 'min-w-0 rounded-[1rem] px-2 py-1.75'
                        : 'min-w-0 rounded-[1rem] aether-panel-muted px-2 py-1.75';
                    return (
                        <div
                            key={entry.label}
                            data-is-signature={isSignature ? 'true' : 'false'}
                            data-testid={isSignature ? `mobile-summary-signature-${entry.label.toLowerCase()}` : undefined}
                            style={tileStyle}
                            className={tileClassName}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-fira uppercase tracking-[0.18em] text-slate-500">
                                    {entry.label}
                                </span>
                                {isSignature && (
                                    <Sparkles size={9} style={{ color: '#f6e7a2' }} />
                                )}
                            </div>
                            <div className="mt-1 flex items-center gap-1 min-w-0">
                                <span
                                    className={`truncate text-[10px] font-fira leading-none ${isSignature ? '' : 'text-slate-200/88'}`}
                                    style={isSignature ? { color: '#f6e7a2' } : undefined}
                                >
                                    {entry.item?.name || entry.fallback}
                                </span>
                                {(entry.item?.enhance || 0) > 0 && (
                                    <span className="shrink-0 text-[11px] font-bold font-fira text-[#d5b180]">+{entry.item.enhance}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 진행 상태 pill 스트립 */}
            {statusPills.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                    {statusPills.map((pill: any) => (
                        <span
                            key={pill.key}
                            className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.14em] backdrop-blur-md ${
                                pill.tone === 'success' ? 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100'
                                : pill.tone === 'resonance' ? 'border-[#9a8ac0]/28 bg-[#9a8ac0]/10 text-[#e3dcff]'
                                : pill.tone === 'recommended' ? 'border-[#7dd4d8]/28 bg-[#7dd4d8]/10 text-[#dff7f5]'
                                : pill.tone === 'upgrade' ? 'border-[#d5b180]/28 bg-[#d5b180]/10 text-[#f6e7c8]'
                                : 'border-white/8 bg-white/[0.035] text-slate-300'
                            }`}
                        >
                            {pill.label}
                        </span>
                    ))}
                </div>
            )}
        </Motion.div>
    );
};

export default DashboardMobileSummary;
