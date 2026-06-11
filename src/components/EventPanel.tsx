import { motion as Motion } from 'framer-motion';
import SignalBadge from './SignalBadge';
import FocusPanelHeader from './FocusPanelHeader';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
// cycle 489: 모바일 포커스 prop 인터페이스 제거 — cycle 486 cascade로 caller 0건
//   이라 항상 truthy 전달이었음. fallback 분기 26줄 unreachable 함께 cleanup.
interface EventPanelProps {
    currentEvent?: any;
    actions?: any;
}

// cycle 437: 모바일 포커스 default 값 제거 — 호출자 ControlPanel:192이 명시
//   전달이라 default 도달 불가 (cycle 364-368 redundant default annotation lens).
const EventPanel = ({ currentEvent, actions }: EventPanelProps) => {
    if (!currentEvent) return null;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const panelBody = (
        <div data-testid="event-panel" className="relative flex flex-1 min-h-0 flex-col overflow-y-auto custom-scrollbar">
            <FocusPanelHeader
                eyebrow="Decision Window"
                title="운명의 선택"
                titleClassName="text-[1.2rem]"
                onBack={() => actions.dismissEvent?.()}
                backLabel="복귀"
                backTestId="event-close"
                rightSlot={<SignalBadge tone="resonance" size="sm">Event</SignalBadge>}
            />

            <div className="relative overflow-hidden rounded-[1.25rem] aether-panel-core px-3 py-3 text-white">
                <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-slate-300/84">Prompt</div>
                <div className="mt-1.5 text-[0.95rem] font-readable leading-relaxed text-slate-50">
                    {currentEvent.desc}
                </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
                {choices.length > 0 ? choices.map((choice: any, idx: any) => (
                    <button
                        key={`${choice}_${idx}`}
                        data-testid={`event-choice-${idx}`}
                        onClick={() => actions.handleEventChoice(idx)}
                        className="group rounded-[1.3rem] aether-event-choice px-3 py-3 text-left transition-all hover:border-[#d5b180]/28 hover:bg-[#d5b180]/10 hover:shadow-[0_18px_28px_rgba(213,177,128,0.08)]"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-fira uppercase tracking-[0.18em] text-[#f4e6c8]/78 group-hover:text-[#f4e6c8]">
                                Choice {idx + 1}
                            </div>
                            <span className="rounded-full border border-[#d5b180]/22 bg-black/18 px-2 py-0.5 text-[9px] font-fira uppercase tracking-[0.16em] text-[#f6e7c8]/88 group-hover:text-white">
                                Commit
                            </span>
                        </div>
                        <div className="mt-1 text-[0.98rem] font-readable font-bold text-slate-50">
                            {choice}
                        </div>
                    </button>
                )) : (
                    <button
                        data-testid="event-dismiss"
                        onClick={() => actions.dismissEvent?.()}
                        className="rounded-[1.2rem] aether-panel-muted px-4 py-4 text-left font-bold text-white transition-colors hover:bg-white/[0.04]"
                    >
                        이벤트를 종료합니다.
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <Motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="panel-noise aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.95rem] p-3"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 22%), linear-gradient(145deg, rgba(246,217,140,0.08), transparent 34%)' }}
            />
            {panelBody}
        </Motion.div>
    );
};

export default EventPanel;
