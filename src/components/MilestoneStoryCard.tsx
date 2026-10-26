import { motion as Motion } from 'framer-motion';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import { MSG } from '../data/messages';
import ActionButton from './ui/ActionButton';
import MomentCloseButton from './moments/MomentCloseButton';
import { MOMENT_DUR_PANEL, MOMENT_EASE } from './moments/momentMotion';

interface MilestoneStoryCardProps {
    story: MilestoneStoryBeat;
    onClose: () => void;
}

const MilestoneStoryCard = ({ story, onClose }: MilestoneStoryCardProps) => {
    usePlatformBackHandler(true, onClose, 72);
    const dialog = useOverlayDialog({ label: story.title, onEscape: onClose });
    return (
    <Motion.div
        {...dialog}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[72] flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
    >
        <div className="ae-scrim ae-moment-scrim" />
        <Motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE }}
            data-testid="milestone-story-card"
            data-story-id={story.id}
            aria-label={story.eyebrow}
            className="ae-sheet relative z-10 max-h-full w-full max-w-[24rem] overflow-y-auto lg:max-w-[28rem]"
        >
            <div className="flex items-center justify-between gap-3 pl-5 pr-3 pt-3">
                <div className="ae-eyebrow text-ae-ether-hi">{story.eyebrow}</div>
                <MomentCloseButton
                    data-testid="milestone-story-close-icon"
                    aria-label={MSG.UI_CLOSE}
                    onClick={onClose}
                />
            </div>

            {/* 감사 VD-09: 이야기의 한 장 — 화면의 장식 패널 하나 */}
            <div className="ae-ornate mx-4 mt-1 px-5 pb-5 pt-5">
                <div className="ae-moment-medallion flex h-11 w-11 items-center justify-center rounded-full" aria-hidden="true">
                    <BookOpen size={20} />
                </div>
                <h2 className="mt-3 break-keep font-display text-[22px] font-extrabold leading-tight text-ae-ink">{story.title}</h2>
                <p className="mt-3 break-keep font-readable text-[13px] leading-relaxed text-ae-ink-2">{story.body}</p>
                <div className="ae-divider mt-3" />
                <p className="mt-3 break-keep font-readable text-[13px] font-semibold leading-relaxed text-ae-gold-text">{story.closing}</p>
            </div>

            <div className="p-4">
                <ActionButton
                    variant="primary"
                    data-testid="milestone-story-close"
                    onClick={onClose}
                    icon={<CheckCircle2 size={17} />}
                    label={MSG.MILESTONE_STORY_CONTINUE}
                    className="w-full"
                />
            </div>
        </Motion.section>
    </Motion.div>
    );
};

export default MilestoneStoryCard;
