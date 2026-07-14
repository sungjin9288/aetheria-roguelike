import { motion as Motion } from 'framer-motion';
import { ArrowRight, BookOpen, CircleHelp, Gift, HeartPulse, ShieldAlert } from 'lucide-react';
import SignalBadge from './SignalBadge';
import FocusPanelHeader from './FocusPanelHeader';
import { formatEventText, getEventChoicePreview, getEventPanelCopy } from '../utils/eventPresentation';

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
    const panelCopy = getEventPanelCopy(currentEvent);
    const previewStyle = {
        reward: { icon: Gift, className: 'text-[#f6e7c8]' },
        recovery: { icon: HeartPulse, className: 'text-emerald-200' },
        danger: { icon: ShieldAlert, className: 'text-rose-200' },
        story: { icon: BookOpen, className: 'text-[#e3dcff]' },
        unknown: { icon: CircleHelp, className: 'text-slate-300/76' },
    };
    const panelBody = (
        <div data-testid="event-panel" className="relative flex flex-1 min-h-0 flex-col overflow-y-auto custom-scrollbar">
            <FocusPanelHeader
                eyebrow="탐험 중 마주친 일"
                title={panelCopy.title}
                titleClassName="text-[1.2rem]"
                onBack={() => actions.dismissEvent?.()}
                backLabel="복귀"
                backTestId="event-close"
                rightSlot={<SignalBadge tone="resonance" size="sm">{panelCopy.kind}</SignalBadge>}
            />

            <div data-testid="event-situation" className="border-l-2 border-[#7dd4d8]/45 bg-[#7dd4d8]/[0.05] px-3 py-3 text-white">
                <div className="font-readable text-[11px] text-[#bce8e8]/82">지금 상황</div>
                <div className="mt-1.5 text-[0.95rem] font-readable leading-relaxed text-slate-50">
                    {formatEventText(currentEvent.desc)}
                </div>
            </div>

            <div className="mt-3 font-readable text-[12px] text-slate-300/82">어떤 길을 택하시겠습니까?</div>
            <div className="mt-2 flex flex-col gap-2">
                {choices.length > 0 ? choices.map((choice: any, idx: any) => {
                    const preview = getEventChoicePreview(currentEvent, idx);
                    const PreviewIcon = previewStyle[preview.tone].icon;
                    return (
                        <button
                            key={`${choice}_${idx}`}
                            data-testid={`event-choice-${idx}`}
                            onClick={() => actions.handleEventChoice(idx)}
                            className="group min-h-[72px] rounded-[1rem] aether-event-choice px-3.5 py-3 text-left transition-all hover:border-[#d5b180]/28 hover:bg-[#d5b180]/10 hover:shadow-[0_18px_28px_rgba(213,177,128,0.08)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="font-readable text-[11px] text-[#f4e6c8]/72">선택 {idx + 1}</div>
                                    <div className="mt-0.5 text-[0.98rem] font-readable font-bold leading-snug text-slate-50">
                                        {formatEventText(choice)}
                                    </div>
                                    <div
                                        data-testid={`event-choice-preview-${idx}`}
                                        className={`mt-1.5 flex items-center gap-1.5 font-readable text-[11px] ${previewStyle[preview.tone].className}`}
                                    >
                                        <PreviewIcon size={12} className="shrink-0" />
                                        <span>예상 결과 · {preview.text}</span>
                                    </div>
                                </div>
                                <ArrowRight size={17} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#f6e7c8]" />
                            </div>
                        </button>
                    );
                }) : (
                    <button
                        data-testid="event-dismiss"
                        onClick={() => actions.dismissEvent?.()}
                        className="rounded-[1.2rem] aether-panel-muted px-4 py-4 text-left font-bold text-white transition-colors hover:bg-white/[0.04]"
                    >
                        이곳을 떠납니다.
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
            className="panel-noise aether-focus-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
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
