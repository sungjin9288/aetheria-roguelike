import { motion as Motion } from 'framer-motion';
import { ArrowRight, BookOpen, CircleHelp, Gift, HeartPulse, ShieldAlert, type LucideIcon } from 'lucide-react';
import Chip from './ui/Chip';
import FocusPanelHeader from './FocusPanelHeader';
import { MSG } from '../data/messages';
import { formatEventText, getEventChoicePreview, getEventPanelCopy, type EventChoiceTone } from '../utils/eventPresentation';
import { getLocationVisual } from '../utils/locationVisuals';
import type { GameActions } from '../hooks/actionDeps';
import type { GameEvent } from '../types/session.js';
import type { Player } from '../types/index.js';

/**
 * EventPanel - Dynamic event choice UI
 * Separated from ControlPanel for cleaner architecture
 */
// cycle 489: 모바일 포커스 prop 인터페이스 제거 — cycle 486 cascade로 caller 0건
//   이라 항상 truthy 전달이었음. fallback 분기 26줄 unreachable 함께 cleanup.
interface EventPanelProps {
    currentEvent?: GameEvent | null;
    actions?: Pick<GameActions, 'dismissEvent' | 'handleEventChoice'>;
    location?: string;
    /** 지금 걸린 강화 — 미리보기가 "더 센 강화가 있어 붙지 않음"을 판정하는 입력(Wave 62 C6, 판정은 eventPresentation 소유). */
    activeBuff?: Player['tempBuff'] | null;
    /** 도전 조건 — 미리보기의 골드 금액이 실제로 받는 금액('빈손의 시작'이면 절반)이 되게 한다(판정은 eventPresentation 소유). */
    challengeModifiers?: Player['challengeModifiers'];
}

// cycle 437: 모바일 포커스 default 값 제거 — 호출자 ControlPanel:192이 명시
//   전달이라 default 도달 불가 (cycle 364-368 redundant default annotation lens).
const EventPanel = ({ currentEvent, actions, location, activeBuff, challengeModifiers }: EventPanelProps) => {
    if (!currentEvent) return null;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const panelCopy = getEventPanelCopy(currentEvent);
    const locationVisual = location ? getLocationVisual(location) : null;
    // 2026-10 에테르 유리: 예상 결과의 색은 토큰 하나씩 — 보상 금 · 회복 초록 · 위험 장밋빛 · 이야기 보라 · 미상 잉크.
    const previewStyle: Record<EventChoiceTone, { icon: LucideIcon; className: string }> = {
        reward: { icon: Gift, className: 'text-ae-gold-text' },
        recovery: { icon: HeartPulse, className: 'text-ae-good' },
        danger: { icon: ShieldAlert, className: 'text-ae-threat' },
        story: { icon: BookOpen, className: 'text-ae-exp' },
        unknown: { icon: CircleHelp, className: 'text-ae-ink-2' },
    };
    const panelBody = (
        <div data-testid="event-panel" className="relative flex flex-1 min-h-0 flex-col overflow-x-hidden overflow-y-auto custom-scrollbar">
            <FocusPanelHeader
                eyebrow="탐험 중 마주친 일"
                title={panelCopy.title}
                titleClassName="text-[1.2rem]"
                onBack={() => actions?.dismissEvent?.()}
                backLabel={MSG.UI_BACK}
                backTestId="event-close"
                rightSlot={<Chip tone="ether">{panelCopy.kind}</Chip>}
                bleedClassName=""
            />

            <div data-testid="event-situation" className="ae-ornate shrink-0 px-4 py-3.5">
                <div className="ae-eyebrow font-readable text-ae-gold-text">지금 상황</div>
                <div className="mt-1.5 font-readable text-[15px] leading-relaxed text-ae-ink">
                    {formatEventText(currentEvent.desc)}
                </div>
            </div>

            <div className="mt-3 shrink-0 font-readable text-[12px] font-semibold text-ae-ink-2">어떤 길을 택하시겠습니까?</div>
            <div data-testid="event-choice-list" className="mt-2 flex shrink-0 flex-col gap-2">
                {choices.length > 0 ? choices.map((choice, idx) => {
                    const preview = getEventChoicePreview(currentEvent, idx, { activeBuff, player: { challengeModifiers } });
                    const PreviewIcon = previewStyle[preview.tone].icon;
                    return (
                        <button
                            key={`${choice}_${idx}`}
                            data-testid={`event-choice-${idx}`}
                            onClick={(event) => {
                                event.currentTarget.blur();
                                actions?.handleEventChoice(idx);
                            }}
                            className="aether-event-choice ae-event-choice group min-h-[72px] rounded-ae-md px-3.5 py-3 text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="ae-eyebrow font-readable">선택 <span className="font-fira tabular-nums">{idx + 1}</span></div>
                                    <div className="mt-0.5 font-readable text-[15px] font-bold leading-snug text-ae-ink">
                                        {formatEventText(choice)}
                                    </div>
                                    <div
                                        data-testid={`event-choice-preview-${idx}`}
                                        className={`mt-1.5 flex items-start gap-1.5 font-readable text-[12px] font-semibold leading-snug ${previewStyle[preview.tone].className}`}
                                    >
                                        <PreviewIcon size={14} aria-hidden="true" className="mt-px shrink-0" />
                                        <span>예상 결과 · {preview.text}</span>
                                    </div>
                                </div>
                                <ArrowRight size={18} aria-hidden="true" className="ae-event-choice-arrow shrink-0 text-ae-ink-3" />
                            </div>
                        </button>
                    );
                }) : (
                    <button
                        data-testid="event-dismiss"
                        onClick={() => actions?.dismissEvent?.()}
                        className="aether-event-choice ae-event-choice min-h-[56px] rounded-ae-md px-4 py-4 text-left font-readable text-[15px] font-bold text-ae-ink"
                    >
                        이곳을 떠납니다.
                    </button>
                )}
            </div>

            {locationVisual && (
                <Motion.div
                    data-testid="event-location-visual"
                    data-location-visual={locationVisual.key}
                    aria-hidden="true"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-none flex min-h-0 flex-1 items-center justify-center overflow-hidden"
                >
                    <img
                        src={locationVisual.src}
                        alt=""
                        className="ae-event-art h-32 w-32 max-h-full max-w-full object-contain [image-rendering:pixelated]"
                    />
                </Motion.div>
            )}
        </div>
    );

    return (
        <Motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="aether-focus-panel ae-event-panel relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden p-3"
        >
            {panelBody}
        </Motion.div>
    );
};

export default EventPanel;
