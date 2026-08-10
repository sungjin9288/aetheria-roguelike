import { motion as Motion } from 'framer-motion';
import { Gift, MapPin, Heart, ScrollText, ListChecks, Sparkles, X } from 'lucide-react';
import { MSG } from '../data/messages';
import type { Briefing } from '../utils/returnBriefing';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';

/** 게임으로 돌아온 플레이어에게 현재 상태와 남은 목표를 한 번 보여준다. */
interface ReturnBriefingCardProps {
    briefing: Briefing;
    onClose: () => void;
    onOpenGoals: () => void;
}

const ReturnBriefingCard = ({ briefing, onClose, onOpenGoals }: ReturnBriefingCardProps) => {
    usePlatformBackHandler(true, onClose, 50);
    const hpPct = briefing.maxHp > 0
        ? Math.max(0, Math.min(100, Math.round((briefing.hp / briefing.maxHp) * 100)))
        : 0;
    const hasClaimableRewards = briefing.claimableRewardCount > 0;
    const handlePrimaryAction = () => {
        if (hasClaimableRewards && onOpenGoals) {
            onOpenGoals();
            return;
        }
        onClose();
    };

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <div className="aether-overlay" />

            <Motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                data-testid="return-briefing-card"
                className="panel-noise aether-surface-strong relative z-10 w-full max-w-[26rem] overflow-hidden rounded-[1.75rem] shadow-[0_36px_96px_rgba(1,6,14,0.62)]"
            >
                <div className="relative px-6 pb-5 pt-6">
                    <button
                        type="button"
                        data-testid="return-briefing-close-icon"
                        onClick={onClose}
                        aria-label={MSG.UI_CLOSE}
                        className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <X size={16} />
                    </button>

                    <div className="text-[10px] font-fira uppercase tracking-[0.22em] text-slate-500">
                        다시 만난 모험가에게
                    </div>
                    <div className="mt-2 text-[1.4rem] font-rajdhani font-bold tracking-[0.04em] text-[#f6e7c8]">
                        {MSG.RETURN_BRIEFING_TITLE}
                    </div>
                    <div className="mt-1.5 text-[12px] font-fira text-slate-300/80">
                        {MSG.RETURN_BRIEFING_AWAY(briefing.awayHours)}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                        <div className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400">
                                <MapPin size={12} className="text-[#7dd4d8]" />
                                {MSG.RETURN_BRIEFING_LOCATION_LABEL}
                            </div>
                            <div className="mt-2 text-[1rem] font-rajdhani font-bold text-white">
                                {briefing.loc}
                            </div>
                        </div>

                        <div className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400">
                                <Heart size={12} className="text-rose-300" />
                                {MSG.RETURN_BRIEFING_STATUS_LABEL}
                            </div>
                            <div className="mt-2 text-[1rem] font-rajdhani font-bold text-white">
                                레벨 {briefing.level} · 생명 {hpPct}%
                            </div>
                        </div>

                        <div className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400">
                                <ListChecks size={12} className="text-[#d5b180]" />
                                {MSG.RETURN_BRIEFING_DAILY_LABEL}
                            </div>
                            <div className="mt-2 text-[1rem] font-rajdhani font-bold text-white">
                                {MSG.RETURN_BRIEFING_DAILY_VALUE(briefing.dailyCompletedCount, briefing.dailyMissionCount)}
                            </div>
                        </div>

                        <div className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-fira uppercase tracking-[0.16em] text-slate-400">
                                <ScrollText size={12} className="text-[#e3dcff]" />
                                {MSG.RETURN_BRIEFING_CHAINS_LABEL}
                            </div>
                            <div className="mt-2 text-[1rem] font-rajdhani font-bold text-white">
                                {MSG.RETURN_BRIEFING_CHAINS_VALUE(briefing.activeChainCount)}
                            </div>
                        </div>
                    </div>

                    {hasClaimableRewards && (
                        <div className="mt-3 flex items-center justify-between gap-3 border-y border-[#d5b180]/18 py-2.5 text-xs font-fira">
                            <span className="flex items-center gap-2 text-slate-300/82">
                                <Gift size={14} className="text-[#d5b180]" />
                                {MSG.RETURN_BRIEFING_REWARDS_LABEL}
                            </span>
                            <span className="font-bold text-[#f6e7c8]">
                                {MSG.RETURN_BRIEFING_REWARDS_VALUE(briefing.claimableRewardCount)}
                            </span>
                        </div>
                    )}

                    <Motion.button
                        data-testid="return-briefing-primary"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handlePrimaryAction}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[1rem] border border-[#7dd4d8]/24 bg-[#7dd4d8]/10 px-3 py-3 text-sm font-rajdhani font-bold text-[#dff7f5] transition-all hover:bg-[#7dd4d8]/14"
                    >
                        <Sparkles size={15} />
                        {hasClaimableRewards ? MSG.RETURN_BRIEFING_OPEN_REWARDS : MSG.RETURN_BRIEFING_CONTINUE}
                    </Motion.button>
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default ReturnBriefingCard;
