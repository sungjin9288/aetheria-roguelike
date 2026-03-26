import React, { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Compass, Crosshair } from 'lucide-react';
import SignalBadge from '../SignalBadge';
import { getAdventureGuidance, getExplorationForecast, getQuestTracker } from '../../utils/adventureGuide';
import { runGuidanceAction } from '../../utils/adventureGuideActions';
import { calcPerformanceScore, getDifficultyMults } from '../../systems/DifficultyManager';

const DIFF_BADGE = {
    '압도': { label: '⚔️ 압도 중', cls: 'border-amber-500/40 bg-amber-950/40 text-amber-400' },
    '위기': { label: '🛡️ 위기', cls: 'border-red-500/40 bg-red-950/40 text-red-400' },
    '열세': { label: '🛡️ 열세', cls: 'border-orange-500/40 bg-orange-950/40 text-orange-400' },
};

const FocusPanel = ({ player, stats, runtime, actions, setGameState, setSideTab, mobile = false, onMobileOpenDetails }) => {
    const [detailsOpen, setDetailsOpen] = useState(!mobile);
    const mapData = runtime?.mapData;
    const diffBadge = useMemo(() => {
        const score = calcPerformanceScore(player);
        const diff = getDifficultyMults(score);
        return DIFF_BADGE[diff.label] || null;
    }, [player]);
    const guidance = useMemo(
        () => getAdventureGuidance(player, stats, mapData, runtime?.gameState || 'idle'),
        [mapData, player, runtime?.gameState, stats]
    );
    const forecast = useMemo(
        () => getExplorationForecast(player, mapData),
        [mapData, player]
    );
    const questTracker = useMemo(
        () => getQuestTracker(player),
        [player]
    );

    const handleGuidanceAction = (action) => runGuidanceAction({
        action,
        actions,
        setGameState,
        setSideTab,
        onOpenArchive: onMobileOpenDetails,
    });

    const buttonClass = mobile
        ? 'min-h-[40px] rounded-[1rem] border px-3 py-2 text-[11px] font-rajdhani font-bold tracking-[0.16em]'
        : 'min-h-[36px] rounded-lg border px-3 py-2 text-[10px] font-rajdhani font-bold tracking-[0.16em]';

    return (
        <div className={`panel-noise border ${mobile ? 'border-cyan-400/18 rounded-[1.2rem] bg-slate-950/72 shadow-[0_16px_36px_rgba(2,8,20,0.25)]' : 'border-cyber-blue/20 rounded-md bg-cyber-dark/30'} ${mobile ? 'p-3 space-y-2.5' : 'p-3.5 space-y-3'}`}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-fira uppercase tracking-[0.2em] text-cyber-blue/60">
                <span className="flex items-center gap-1.5">
                    <Crosshair size={10} className="text-cyber-blue/70" />
                    {mobile ? 'Next' : '현재 목표'}
                </span>
                <div className="flex items-center gap-2">
                    {diffBadge && (
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-fira font-bold ${diffBadge.cls}`}>
                            {diffBadge.label}
                        </span>
                    )}
                    <SignalBadge
                        tone={
                            guidance.emphasis === '위험'
                                ? 'danger'
                                : guidance.emphasis === '즉시 이득'
                                    ? 'success'
                                    : 'neutral'
                        }
                        size="md"
                    >
                        {guidance.emphasis}
                    </SignalBadge>
                    {mobile && (
                        <button
                            onClick={() => setDetailsOpen((open) => !open)}
                            className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-2 py-1 text-cyber-blue/70"
                            aria-label={detailsOpen ? '목표 상세 닫기' : '목표 상세 열기'}
                        >
                            {detailsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-1">
                <div className={`${mobile ? 'text-[15px]' : 'text-sm'} font-rajdhani font-bold text-white`}>{guidance.title}</div>
                <div className="text-[11px] font-fira text-cyber-blue/60">{guidance.detail}</div>
            </div>

            {(guidance.primaryAction || guidance.secondaryAction) && (
                mobile ? (
                    <div className="space-y-2">
                        {guidance.primaryAction && (
                            <button
                                onClick={() => handleGuidanceAction(guidance.primaryAction)}
                                className={`${buttonClass} w-full border-cyber-green/30 bg-cyber-green/10 text-cyber-green hover:bg-cyber-green/15`}
                            >
                                {guidance.primaryAction.label}
                            </button>
                        )}
                        {guidance.secondaryAction && detailsOpen && (
                            <button
                                onClick={() => handleGuidanceAction(guidance.secondaryAction)}
                                className={`${buttonClass} w-full border-cyber-blue/20 bg-cyber-black/60 text-cyber-blue/80 hover:bg-cyber-blue/10`}
                            >
                                {guidance.secondaryAction.label}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2">
                        {guidance.primaryAction ? (
                            <button
                                onClick={() => handleGuidanceAction(guidance.primaryAction)}
                                className={`${buttonClass} border-cyber-green/30 bg-cyber-green/10 text-cyber-green hover:bg-cyber-green/15`}
                            >
                                {guidance.primaryAction.label}
                            </button>
                        ) : (
                            <div />
                        )}
                        {guidance.secondaryAction ? (
                            <button
                                onClick={() => handleGuidanceAction(guidance.secondaryAction)}
                                className={`${buttonClass} border-cyber-blue/20 bg-cyber-black/60 text-cyber-blue/80 hover:bg-cyber-blue/10`}
                            >
                                {guidance.secondaryAction.label}
                            </button>
                        ) : (
                            <div />
                        )}
                    </div>
                )
            )}

            <AnimatePresence initial={false}>
                {detailsOpen && (
                    <Motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden space-y-3"
                    >
                        {questTracker && (
                            <div className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2">
                                <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                    <span className="text-cyber-blue/50 uppercase tracking-[0.16em]">Quest Pulse</span>
                                    <span>
                                        <SignalBadge
                                            tone={questTracker.kind === 'claimable' ? 'success' : questTracker.kind === 'bounty' ? 'upgrade' : 'resonance'}
                                            size="sm"
                                        >
                                            {questTracker.progressLabel}
                                        </SignalBadge>
                                    </span>
                                </div>
                                <div className="mt-1 text-[11px] font-fira text-slate-200">{questTracker.title}</div>
                            </div>
                        )}

                        <div className="rounded border border-cyber-blue/15 bg-cyber-black/55 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-[10px] font-fira">
                                <span className="flex items-center gap-1 text-cyber-blue/50 uppercase tracking-[0.16em]">
                                    <Compass size={10} />
                                    탐험 예보
                                </span>
                                <SignalBadge tone="success" size="sm">{forecast.mood}</SignalBadge>
                            </div>
                            <div className="mt-1 text-[11px] font-fira text-cyber-blue/65">{forecast.description}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {forecast.chips.map((chip) => (
                                    <SignalBadge key={`${chip.label}_${chip.value}`} tone="neutral" size="sm">
                                        {chip.label} {chip.value}
                                    </SignalBadge>
                                ))}
                            </div>
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FocusPanel;
