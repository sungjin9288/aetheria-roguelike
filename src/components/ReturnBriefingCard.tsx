import { motion as Motion } from 'framer-motion';
import { Gift, MapPin, Heart, ScrollText, ListChecks, Sparkles } from 'lucide-react';
import { MSG } from '../data/messages';
import type { Briefing } from '../utils/returnBriefing';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import ActionButton from './ui/ActionButton';
import MomentCloseButton from './moments/MomentCloseButton';
import { MOMENT_DUR_PANEL, MOMENT_EASE } from './moments/momentMotion';

/** 게임으로 돌아온 플레이어에게 현재 상태와 남은 목표를 한 번 보여준다. */
interface ReturnBriefingCardProps {
    briefing: Briefing;
    onClose: () => void;
    onOpenGoals: () => void;
}

const TILE_CLASS = 'ae-moment-tile min-w-0 rounded-ae-md px-3 py-2.5';
const TILE_LABEL_CLASS = 'flex items-center gap-1.5 font-readable text-[11px] font-bold text-ae-ink-2';
const TILE_VALUE_CLASS = 'mt-1.5 break-keep font-display text-[15px] font-extrabold text-ae-ink';

const ReturnBriefingCard = ({ briefing, onClose, onOpenGoals }: ReturnBriefingCardProps) => {
    usePlatformBackHandler(true, onClose, 50);
    const dialog = useOverlayDialog({ label: MSG.RETURN_BRIEFING_TITLE, onEscape: onClose });
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
            {...dialog}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]"
        >
            <div className="ae-scrim ae-moment-scrim" />

            <Motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: MOMENT_DUR_PANEL, ease: MOMENT_EASE }}
                data-testid="return-briefing-card"
                className="ae-sheet relative z-10 max-h-full w-full max-w-[26rem] overflow-y-auto lg:max-w-[30rem]"
            >
                <div className="px-5 pb-5 pt-3">
                    <div className="flex items-center justify-between gap-3">
                        {/* 감사 A11Y-04: 머리말은 ink-3(4.5:1 이상) — 이전 slate-500은 대비가 모자랐다. */}
                        <div className="ae-eyebrow">
                            다시 만난 모험가에게
                        </div>
                        <MomentCloseButton
                            data-testid="return-briefing-close-icon"
                            aria-label={MSG.UI_CLOSE}
                            onClick={onClose}
                            className="-mr-2"
                        />
                    </div>
                    <h2 className="mt-0.5 font-display text-[22px] font-extrabold leading-tight text-ae-ink">
                        {MSG.RETURN_BRIEFING_TITLE}
                    </h2>
                    <div className="mt-1.5 break-keep font-readable text-[13px] text-ae-ink-2">
                        {MSG.RETURN_BRIEFING_AWAY(briefing.awayHours)}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className={TILE_CLASS}>
                            <div className={TILE_LABEL_CLASS}>
                                <MapPin size={12} className="text-ae-ether" aria-hidden="true" />
                                {MSG.RETURN_BRIEFING_LOCATION_LABEL}
                            </div>
                            <div className={TILE_VALUE_CLASS}>
                                {briefing.loc}
                            </div>
                        </div>

                        <div className={TILE_CLASS}>
                            <div className={TILE_LABEL_CLASS}>
                                <Heart size={12} className="text-ae-life" aria-hidden="true" />
                                {MSG.RETURN_BRIEFING_STATUS_LABEL}
                            </div>
                            <div className={`${TILE_VALUE_CLASS} font-fira tabular-nums`}>
                                레벨 {briefing.level} · 생명 {hpPct}%
                            </div>
                        </div>

                        <div className={TILE_CLASS}>
                            <div className={TILE_LABEL_CLASS}>
                                <ListChecks size={12} className="text-ae-gold" aria-hidden="true" />
                                {MSG.RETURN_BRIEFING_DAILY_LABEL}
                            </div>
                            <div className={`${TILE_VALUE_CLASS} font-fira tabular-nums`}>
                                {MSG.RETURN_BRIEFING_DAILY_VALUE(briefing.dailyCompletedCount, briefing.dailyMissionCount)}
                            </div>
                        </div>

                        <div className={TILE_CLASS}>
                            <div className={TILE_LABEL_CLASS}>
                                <ScrollText size={12} className="text-ae-exp" aria-hidden="true" />
                                {MSG.RETURN_BRIEFING_CHAINS_LABEL}
                            </div>
                            <div className={`${TILE_VALUE_CLASS} font-fira tabular-nums`}>
                                {MSG.RETURN_BRIEFING_CHAINS_VALUE(briefing.activeChainCount)}
                            </div>
                        </div>
                    </div>

                    {hasClaimableRewards && (
                        <div className="ae-moment-signal mt-2 flex items-center justify-between gap-3 rounded-ae-md px-3 py-2.5 font-readable text-[13px]" data-signal-tone="amber">
                            <span className="flex items-center gap-2 text-ae-ink-2">
                                <Gift size={14} className="text-ae-gold" aria-hidden="true" />
                                {MSG.RETURN_BRIEFING_REWARDS_LABEL}
                            </span>
                            <span className="font-fira font-bold tabular-nums text-ae-gold-text">
                                {MSG.RETURN_BRIEFING_REWARDS_VALUE(briefing.claimableRewardCount)}
                            </span>
                        </div>
                    )}

                    <ActionButton
                        variant="primary"
                        data-testid="return-briefing-primary"
                        onClick={handlePrimaryAction}
                        icon={<Sparkles size={17} />}
                        label={hasClaimableRewards ? MSG.RETURN_BRIEFING_OPEN_REWARDS : MSG.RETURN_BRIEFING_CONTINUE}
                        className="mt-4 w-full"
                    />
                </div>
            </Motion.div>
        </Motion.div>
    );
};

export default ReturnBriefingCard;
