import React from 'react';
import { motion as Motion } from 'framer-motion';
import SignalBadge from './SignalBadge';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
const EventPanel = ({ currentEvent, actions }) => {
    if (!currentEvent) return null;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const overlayPanelClass = 'absolute inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:inset-x-4 md:bottom-4 md:top-20';

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30"
        >
            <div className="aether-overlay" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 28%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />
            <Motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`${overlayPanelClass} panel-noise aether-surface-strong overflow-hidden rounded-[1.9rem] p-3 md:p-5`}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 22%), radial-gradient(circle at top left, rgba(213,177,128,0.1), transparent 30%)' }}
                />
                <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-slate-500">
                                Decision Window
                            </div>
                            <h2 className="mt-1 text-[1.7rem] font-rajdhani font-bold tracking-[0.08em] text-[#f4e6c8]">
                                운명의 선택
                            </h2>
                        </div>
                        <SignalBadge tone="resonance" size="sm">Event</SignalBadge>
                    </div>

                    <div className="relative mt-4 rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-3.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500">Prompt</div>
                        <div className="mt-2 text-[1.05rem] font-fira leading-relaxed text-white/92">
                            {currentEvent.desc}
                        </div>
                    </div>

                    <div className="mt-5 flex flex-1 flex-col justify-center gap-3">
                        {choices.length > 0 ? choices.map((choice, idx) => (
                            <button
                                key={`${choice}_${idx}`}
                                onClick={() => actions.handleEventChoice(idx)}
                                className="group rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-4 text-left transition-all hover:border-[#d5b180]/20 hover:bg-[#d5b180]/8 hover:shadow-[0_18px_28px_rgba(213,177,128,0.08)]"
                            >
                                <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500 group-hover:text-[#f4e6c8]/80">
                                    Choice {idx + 1}
                                </div>
                                <div className="mt-1 text-[1.05rem] font-rajdhani font-bold text-white">
                                    {choice}
                                </div>
                            </button>
                        )) : (
                            <button
                                onClick={() => actions.setGameState('idle')}
                                className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-4 text-left font-bold text-white transition-colors hover:bg-white/[0.04]"
                            >
                                이벤트를 종료합니다.
                            </button>
                        )}
                    </div>
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default EventPanel;
