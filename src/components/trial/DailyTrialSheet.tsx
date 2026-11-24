import { useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { useOverlayDialog } from '../../hooks/useOverlayDialog';
import type { DailyTrialControls } from '../../hooks/useDailyTrial';
import { usePlatformBackHandler } from '../../platform/platformBackRegistry';
import { INITIAL_STATE } from '../../reducers/gameReducer';
import type { DailyTrialRecord, Player } from '../../types';
import { getDailyTrialView } from '../../utils/dailyTrialView';
import OverlayCloseButton from '../OverlayCloseButton';
import ActionButton from '../ui/ActionButton';

interface DailyTrialSheetProps {
    player: Player;
    controls: Pick<DailyTrialControls, 'begin' | 'dayKey' | 'peek'>;
    onClose: () => void;
}

const RecordLine = ({ record }: { record: DailyTrialRecord | null }) => (
    <span className="font-fira text-[13px] font-semibold tabular-nums text-ae-ink">
        {record ? MSG.DAILY_TRIAL_RECORD(record) : MSG.DAILY_TRIAL_BEST_NONE}
    </span>
);

/**
 * 오늘의 시련 입구(2026-11, 명세 §3) — 오늘의 조건 · 목표 · 기록과 시작 단추 하나. 조건은 실제 시작 플레이어에서 만든다.
 * 오늘 멈춘 판이 있으면 시작 단추는 '이어 하기'다(새 판을 따로 시작하지 않는다).
 */
const DailyTrialSheet = ({ player, controls, onClose }: DailyTrialSheetProps) => {
    const dialog = useOverlayDialog({ label: MSG.DAILY_TRIAL_TITLE, onEscape: onClose });
    usePlatformBackHandler(true, onClose, 45);
    const [dayKey] = useState(() => controls.dayKey());
    const [paused] = useState(() => controls.peek());
    const view = useMemo(() => getDailyTrialView(INITIAL_STATE.player, player, dayKey), [player, dayKey]);
    const pausedMap = paused?.state?.player?.trialRun?.map ?? 1;

    return (
        <div {...dialog} className="ae-scrim ae-town-overlay fixed inset-0 z-[200] flex justify-center" onClick={onClose}>
            <section
                data-testid="daily-trial-sheet"
                aria-label={MSG.DAILY_TRIAL_TITLE}
                className="ae-sheet ae-town-sheet relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden pt-[var(--aether-safe-area-top)] lg:max-w-[600px]"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="ae-town-head flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                        <p data-testid="daily-trial-day" className="ae-eyebrow font-readable">{MSG.DAILY_TRIAL_DAY(dayKey)}</p>
                        <h2 className="mt-0.5 font-display text-[20px] font-extrabold text-ae-ink">{MSG.DAILY_TRIAL_TITLE}</h2>
                    </div>
                    <OverlayCloseButton data-testid="daily-trial-close" aria-label={MSG.DAILY_TRIAL_CLOSE_ARIA} onClick={onClose} />
                </header>

                <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <div>
                        <p className="font-readable text-[13px] leading-relaxed text-ae-ink-2">{MSG.DAILY_TRIAL_INTRO}</p>
                        <p data-testid="daily-trial-goal" className="mt-2 font-readable text-[14px] font-semibold leading-relaxed text-ae-ink">
                            {MSG.DAILY_TRIAL_GOAL(BALANCE.DAILY_TRIAL_MAPS, view.plan.bossName)}
                        </p>
                    </div>

                    <dl data-testid="daily-trial-conditions" className="ae-town-group px-3">
                        {view.rows.map((row) => (
                            <div key={row.key} data-testid={`daily-trial-cond-${row.key}`} className="ae-town-row flex items-start gap-3 py-2.5">
                                <dt className="w-14 shrink-0 font-readable text-[12px] leading-5 text-ae-ink-2">{row.label}</dt>
                                <dd className="min-w-0 flex-1 space-y-0.5 font-readable text-[13px] font-semibold leading-5 text-ae-ink">
                                    {row.values.map((value) => <p key={value}>{value}</p>)}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    <section data-testid="daily-trial-best" className="ae-card is-quiet px-3.5 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <h3 className="font-readable text-[12px] text-ae-ink-2">{MSG.DAILY_TRIAL_BEST_TITLE}</h3>
                            <span className="font-fira text-[12px] tabular-nums text-ae-ink-2">{MSG.DAILY_TRIAL_TRIES(view.tries)}</span>
                        </div>
                        <p className="mt-1"><RecordLine record={view.best} /></p>
                    </section>

                    <section data-testid="daily-trial-history">
                        <h3 className="font-readable text-[12px] text-ae-ink-2">{MSG.DAILY_TRIAL_HISTORY_TITLE}</h3>
                        {view.history.length === 0 ? (
                            <p className="mt-1.5 font-readable text-[13px] text-ae-ink-2">{MSG.DAILY_TRIAL_HISTORY_NONE}</p>
                        ) : (
                            <ul className="ae-town-group mt-1.5 px-3">
                                {view.history.map((entry) => (
                                    <li key={entry.day} className="ae-town-row flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
                                        <span className="shrink-0 font-readable text-[13px] text-ae-ink-2">{MSG.DAILY_TRIAL_DAY(entry.day)}</span>
                                        <RecordLine record={entry.best} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                <footer className="ae-town-sheet-foot shrink-0 px-4 pb-[max(12px,var(--aether-safe-area-bottom))] pt-3">
                    {paused && (
                        <p data-testid="daily-trial-resume-note" className="mb-2 font-readable text-[12px] text-ae-ink-2">
                            {MSG.DAILY_TRIAL_RESUME_NOTE(pausedMap, BALANCE.DAILY_TRIAL_MAPS, paused.actions)}
                        </p>
                    )}
                    <ActionButton
                        variant="primary"
                        size="lg"
                        data-testid="daily-trial-start"
                        icon={<Hourglass size={18} />}
                        label={paused ? MSG.DAILY_TRIAL_RESUME : MSG.DAILY_TRIAL_START}
                        onClick={() => {
                            onClose();
                            controls.begin();
                        }}
                        className="w-full font-display"
                    />
                </footer>
            </section>
        </div>
    );
};

export default DailyTrialSheet;
