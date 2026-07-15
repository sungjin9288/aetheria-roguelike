import { motion as Motion } from 'framer-motion';
import { MapPin, Heart, ScrollText, ListChecks, Sparkles, X } from 'lucide-react';
import { MSG } from '../data/messages';
import type { Briefing } from '../utils/returnBriefing';

/** 게임으로 돌아온 플레이어에게 현재 상태와 남은 목표를 한 번 보여준다. */
interface ReturnBriefingCardProps {
    briefing: Briefing;
    onClose?: () => void;
}

const ReturnBriefingCard = ({ briefing, onClose }: ReturnBriefingCardProps) => {
    const hpPct = briefing.maxHp > 0
        ? Math.max(0, Math.min(100, Math.round((briefing.hp / briefing.maxHp) * 100)))
        : 0;

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]"
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
                                {MSG.RETURN_BRIEFING_MISSIONS_LABEL}
                            </div>
                            <div className="mt-2 text-[1rem] font-rajdhani font-bold text-white">
                                {MSG.RETURN_BRIEFING_MISSIONS_VALUE(briefing.incompleteMissionCount)}
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

                    <Motion.button
                        data-testid="return-briefing-close"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onClose}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[1rem] border border-[#7dd4d8]/24 bg-[#7dd4d8]/10 px-3 py-3 text-sm font-rajdhani font-bold text-[#dff7f5] transition-all hover:bg-[#7dd4d8]/14"
                    >
                        <Sparkles size={15} />
                        {MSG.RETURN_BRIEFING_CLOSE}
                    </Motion.button>
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default ReturnBriefingCard;
