import React from 'react';
import { motion as Motion } from 'framer-motion';
import SignalBadge from './SignalBadge';
import FocusPanelHeader from './FocusPanelHeader';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
interface EventPanelProps {
    currentEvent?: any;
    actions?: any;
    mobileFocused?: boolean;
}

const EventPanel = ({ currentEvent, actions, mobileFocused = false }: EventPanelProps) => {
    if (!currentEvent) return null;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const overlayPanelClass = 'absolute inset-x-2 top-[calc(env(safe-area-inset-top)+4.75rem)] bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]';
    const panelBody = (
        <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto custom-scrollbar">
            <FocusPanelHeader
                eyebrow="Decision Window"
                title="운명의 선택"
                titleClassName="text-[1.2rem]"
                onBack={() => actions.dismissEvent?.()}
                backLabel="복귀"
                rightSlot={<SignalBadge tone="resonance" size="sm">Event</SignalBadge>}
            />

            <div className="relative overflow-hidden rounded-[1.25rem] aether-panel-core px-3 py-3 text-white">
                <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-400/68">Prompt</div>
                <div className="mt-1.5 text-[0.95rem] font-fira leading-relaxed text-white/92">
                    {currentEvent.desc}
                </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
                {choices.length > 0 ? choices.map((choice: any, idx: any) => (
                    <button
                        key={`${choice}_${idx}`}
                        onClick={() => actions.handleEventChoice(idx)}
                        className="group rounded-[1.3rem] aether-panel-muted px-3 py-3 text-left transition-all hover:border-[#d5b180]/20 hover:bg-[#d5b180]/8 hover:shadow-[0_18px_28px_rgba(213,177,128,0.08)]"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-500 group-hover:text-[#f4e6c8]/80">
                                Choice {idx + 1}
                            </div>
                            <span className="rounded-full border border-white/8 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.16em] text-slate-300/70 group-hover:text-white/88">
                                Commit
                            </span>
                        </div>
                        <div className="mt-0.5 text-[0.95rem] font-rajdhani font-bold text-white">
                            {choice}
                        </div>
                    </button>
                )) : (
                    <button
                        onClick={() => actions.dismissEvent?.()}
                        className="rounded-[1.2rem] aether-panel-muted px-4 py-4 text-left font-bold text-white transition-colors hover:bg-white/[0.04]"
                    >
                        이벤트를 종료합니다.
                    </button>
                )}
            </div>
        </div>
    );

    if (mobileFocused) {
        return (
            <Motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="panel-noise aether-surface-strong relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] p-3"
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 22%), radial-gradient(circle at top left, rgba(213,177,128,0.1), transparent 30%)' }}
                />
                {panelBody}
            </Motion.div>
        );
    }

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
                className={`${overlayPanelClass} panel-noise aether-surface-strong overflow-hidden rounded-[2rem] p-3`}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 22%), radial-gradient(circle at top left, rgba(213,177,128,0.1), transparent 30%)' }}
                />
                {panelBody}
            </Motion.div>
        </Motion.div>
    );
};

export default EventPanel;
