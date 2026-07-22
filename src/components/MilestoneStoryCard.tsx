import { motion as Motion } from 'framer-motion';
import { BookOpen, CheckCircle2, X } from 'lucide-react';
import type { MilestoneStoryBeat } from '../utils/milestoneStory.js';

interface MilestoneStoryCardProps {
    story: MilestoneStoryBeat;
    onClose: () => void;
}

const MilestoneStoryCard = ({ story, onClose }: MilestoneStoryCardProps) => (
    <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[72] flex items-center justify-center px-3 py-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
    >
        <div className="aether-overlay" />
        <Motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            data-testid="milestone-story-card"
            data-story-id={story.id}
            aria-label={story.eyebrow}
            className="panel-noise aether-surface-strong relative z-10 w-full max-w-[24rem] overflow-hidden rounded-[1.5rem] shadow-[0_32px_90px_rgba(1,6,14,0.68)]"
        >
            <button
                type="button"
                data-testid="milestone-story-close-icon"
                onClick={onClose}
                aria-label="닫기"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/8 hover:text-white"
            >
                <X size={17} />
            </button>

            <div className="px-5 pb-4 pt-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d5b180]/24 bg-[#d5b180]/10 text-[#f6e7c8]">
                    <BookOpen size={17} />
                </div>
                <div className="aether-type-label mt-4 font-readable font-semibold text-[#b9f1ec]">{story.eyebrow}</div>
                <h2 className="aether-type-title mt-1 font-readable font-bold text-white">{story.title}</h2>
                <p className="aether-type-body mt-3 font-readable leading-relaxed text-slate-200/88">{story.body}</p>
                <p className="aether-type-body mt-3 border-t border-white/8 pt-3 font-readable text-[#f6e7c8]/88">{story.closing}</p>
            </div>

            <div className="border-t border-white/8 p-3">
                <Motion.button
                    type="button"
                    data-testid="milestone-story-close"
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="aether-cta-primary aether-type-body flex min-h-[48px] w-full items-center justify-center gap-2 px-4 font-readable font-bold text-[#dff7f5]"
                >
                    <CheckCircle2 size={15} />
                    다음 장면으로
                </Motion.button>
            </div>
        </Motion.section>
    </Motion.div>
);

export default MilestoneStoryCard;
