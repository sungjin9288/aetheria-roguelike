import { Flag, LogOut, Skull, Trophy } from 'lucide-react';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { useOverlayDialog } from '../../hooks/useOverlayDialog';
import type { DailyTrialSlot } from '../../reducers/dailyTrial';
import { isNewDailyTrialBest, readDailyTrialLedger } from '../../systems/dailyTrial';
import ActionButton from '../ui/ActionButton';

interface DailyTrialResultProps {
    slot: DailyTrialSlot;
    onReturn: () => void;
}

const OUTCOME_ICON = { cleared: Trophy, dead: Skull, left: LogOut } as const;
const OUTCOME_TONE = { cleared: 'text-ae-gold-text', dead: 'text-ae-threat', left: 'text-ae-ink-2' } as const;

/** 시련의 끝 — 완주 · 사망 · 포기의 기록과 여정으로 돌아가는 단추 하나. 닫는 길은 그 단추뿐이다. */
const DailyTrialResult = ({ slot, onReturn }: DailyTrialResultProps) => {
    const dialog = useOverlayDialog({ label: MSG.DAILY_TRIAL_TITLE });
    const { result, dayKey, main } = slot;
    if (!result) return null;
    const Icon = OUTCOME_ICON[result.outcome];
    const newBest = isNewDailyTrialBest(readDailyTrialLedger(main.player.stats), dayKey, result);

    return (
        <div
            {...dialog}
            data-testid="daily-trial-result"
            data-outcome={result.outcome}
            className="ae-trial-result fixed inset-0 z-[190] flex items-center justify-center overflow-y-auto px-4 py-[max(var(--aether-safe-area-top),1rem)] pb-[max(var(--aether-safe-area-bottom),1rem)]"
        >
            <section className="ae-sheet w-full max-w-[24rem] px-5 pb-5 pt-6">
                <p className="ae-eyebrow font-readable">{MSG.DAILY_TRIAL_TITLE} · {MSG.DAILY_TRIAL_DAY(dayKey)}</p>
                <div className="mt-2 flex items-center gap-2.5">
                    <Icon size={24} aria-hidden="true" className={`shrink-0 ${OUTCOME_TONE[result.outcome]}`} />
                    <h2 data-testid="daily-trial-result-title" className="min-w-0 font-display text-[20px] font-extrabold text-ae-ink">
                        {MSG.DAILY_TRIAL_RESULT_TITLE[result.outcome]}
                    </h2>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                    <div className="ae-sunk rounded-ae-sm p-3">
                        <dt className="font-readable text-[12px] text-ae-ink-2">{MSG.DAILY_TRIAL_RESULT_MAPS}</dt>
                        <dd data-testid="daily-trial-result-maps" className="mt-1 font-fira text-[18px] font-bold tabular-nums text-ae-ink">
                            {MSG.DAILY_TRIAL_RESULT_MAPS_VALUE(result.maps, BALANCE.DAILY_TRIAL_MAPS)}
                        </dd>
                    </div>
                    <div className="ae-sunk rounded-ae-sm p-3">
                        <dt className="font-readable text-[12px] text-ae-ink-2">{MSG.DAILY_TRIAL_RESULT_ACTIONS}</dt>
                        <dd data-testid="daily-trial-result-actions" className="mt-1 font-fira text-[18px] font-bold tabular-nums text-ae-ink">
                            {MSG.DAILY_TRIAL_RESULT_ACTIONS_VALUE(result.actions)}
                        </dd>
                    </div>
                </dl>
                {newBest && (
                    <p data-testid="daily-trial-result-best" className="mt-3 flex items-center gap-2 font-readable text-[13px] font-semibold text-ae-gold-text">
                        <Flag size={15} aria-hidden="true" className="shrink-0" />
                        {MSG.DAILY_TRIAL_RESULT_NEW_BEST}
                    </p>
                )}
                {result.outcome === 'left' && (
                    <p className="mt-3 font-readable text-[13px] text-ae-ink-2">{MSG.DAILY_TRIAL_RESULT_LEFT_NOTE}</p>
                )}
                <p className="mt-2 font-readable text-[13px] text-ae-ink-2">{MSG.DAILY_TRIAL_RESULT_MAIN_NOTE}</p>
                <ActionButton
                    variant="primary"
                    size="lg"
                    data-testid="daily-trial-return"
                    label={MSG.DAILY_TRIAL_RETURN}
                    onClick={onReturn}
                    className="mt-5 w-full font-display"
                />
            </section>
        </div>
    );
};

export default DailyTrialResult;
