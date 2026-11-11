import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, CircleHelp, Gift, HeartPulse, ShieldAlert, type LucideIcon } from 'lucide-react';
import Chip from './ui/Chip';
import ChoiceCard, { ChoiceCardLine } from './ui/ChoiceCard';
import FocusPanelHeader from './FocusPanelHeader';
import { MSG } from '../data/messages';
import {
    formatEventText,
    getEventChoicePreview,
    getEventChoiceStakes,
    getEventPanelCopy,
    type EventChoiceTone,
} from '../utils/eventPresentation';
import { getLocationVisual } from '../utils/locationVisuals';
import { getStorySceneExcerpt } from '../utils/storySceneLedger';
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
    /** 지난 여정에서 이미 지나간 이야기 단계인가(2026-11 G2, 판정은 `isStorySceneSeen`) — 참이면 '지금 상황'을 첫 문장으로 접는다. */
    sceneSeen?: boolean;
}

// cycle 437: 모바일 포커스 default 값 제거 — 호출자 ControlPanel:192이 명시
//   전달이라 default 도달 불가 (cycle 364-368 redundant default annotation lens).
const EventPanel = ({ currentEvent, actions, location, activeBuff, challengeModifiers, sceneSeen = false }: EventPanelProps) => {
    // 편친 장면은 그 장면에만 — 다음 이벤트가 오면 다시 접힌다.
    const [rereadKey, setRereadKey] = useState<string | null>(null);
    if (!currentEvent) return null;
    const sceneKey = currentEvent._chainId ? `${currentEvent._chainId}:${currentEvent._chainStep ?? ''}` : null;
    const situation = formatEventText(currentEvent.desc);
    const excerpt = sceneSeen && sceneKey ? getStorySceneExcerpt(situation) : null;
    const folded = Boolean(excerpt) && rereadKey !== sceneKey;
    const choices = Array.isArray(currentEvent.choices) ? currentEvent.choices.slice(0, 3) : [];
    const panelCopy = getEventPanelCopy(currentEvent);
    const locationVisual = location ? getLocationVisual(location) : null;
    // 2026-10 에테르 유리: 예상 결과의 색은 토큰 하나씩 — 보상 금 · 회복 초록 · 위험 장밋빛 · 이야기 보라 · 미상 잉크.
    // 아이콘 우물 · 계열 빛도 같은 토큰 채널이다(A6 선택 카드).
    const previewStyle: Record<EventChoiceTone, { icon: LucideIcon; className: string; toneRgb: string }> = {
        reward: { icon: Gift, className: 'text-ae-gold-text', toneRgb: 'var(--aether-gold-rgb)' },
        recovery: { icon: HeartPulse, className: 'text-ae-good', toneRgb: 'var(--aether-good-rgb)' },
        danger: { icon: ShieldAlert, className: 'text-ae-threat', toneRgb: 'var(--aether-threat-rgb)' },
        story: { icon: BookOpen, className: 'text-ae-exp', toneRgb: 'var(--aether-exp-rgb)' },
        unknown: { icon: CircleHelp, className: 'text-ae-ink-2', toneRgb: 'var(--aether-ink-3-rgb)' },
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

            <div data-testid="event-situation" data-scene-folded={folded ? 'true' : 'false'} className="ae-ornate shrink-0 px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="ae-eyebrow font-readable text-ae-gold-text">지금 상황</div>
                    {excerpt && <span data-testid="event-scene-seen" className="font-readable text-[11px] text-ae-ink-3">{MSG.STORY_SCENE_SEEN}</span>}
                </div>
                <div className="mt-1.5 font-readable text-[15px] leading-relaxed text-ae-ink">
                    {folded ? excerpt : situation}
                </div>
                {excerpt && (
                    <button
                        type="button"
                        data-testid="event-scene-reread"
                        aria-expanded={!folded}
                        onClick={() => setRereadKey(folded ? sceneKey : null)}
                        className="mt-1 inline-flex min-h-11 items-center gap-1 font-readable text-[12px] font-semibold text-ae-ether-hi"
                    >
                        {folded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
                        {folded ? MSG.STORY_SCENE_REREAD : MSG.STORY_SCENE_FOLD}
                    </button>
                )}
            </div>

            <div className="mt-3 shrink-0 font-readable text-[12px] font-semibold text-ae-ink-2">어떤 길을 택하시겠습니까?</div>
            <div data-testid="event-choice-list" className="mt-2 flex shrink-0 flex-col gap-2">
                {choices.length > 0 ? choices.map((choice, idx) => {
                    const preview = getEventChoicePreview(currentEvent, idx, { activeBuff, player: { challengeModifiers } });
                    const style = previewStyle[preview.tone];
                    const PreviewIcon = style.icon;
                    const stakeLabels = getEventChoiceStakes(currentEvent, idx).map((stake) => MSG.EVENT_STAKE_LABELS[stake]);
                    return (
                        <ChoiceCard
                            key={`${choice}_${idx}`}
                            data-testid={`event-choice-${idx}`}
                            onClick={(event) => {
                                event.currentTarget.blur();
                                actions?.handleEventChoice(idx);
                            }}
                            toneRgb={style.toneRgb}
                            icon={<span className="ae-choice-card-well"><PreviewIcon size={20} strokeWidth={2} /></span>}
                            head={<span className="ae-eyebrow font-readable">선택 <span className="font-fira tabular-nums">{idx + 1}</span></span>}
                            title={formatEventText(choice)}
                            lines={(
                                <>
                                    <ChoiceCardLine data-testid={`event-choice-preview-${idx}`} className={style.className}>
                                        예상 결과 · {preview.text}
                                    </ChoiceCardLine>
                                    {stakeLabels.length > 0 && (
                                        <span data-testid={`event-choice-stakes-${idx}`} className="ae-choice-dots">
                                            {stakeLabels.map((label) => (
                                                <span key={label} className="ae-choice-dot">{label}</span>
                                            ))}
                                        </span>
                                    )}
                                </>
                            )}
                        />
                    );
                }) : (
                    <ChoiceCard
                        data-testid="event-dismiss"
                        onClick={() => actions?.dismissEvent?.()}
                        title="이곳을 떠납니다."
                    />
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
