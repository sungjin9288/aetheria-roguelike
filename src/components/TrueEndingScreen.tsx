import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import {
    ENDING_LINES,
    TRUE_ENDING_STARS,
    getNextTrueEndingTimedStep,
    resolveTrueEndingBackAction,
    type TrueEndingRevealState,
} from '../utils/trueEndingPresentation';
import { getClaimableQuestEntries } from '../utils/questProgress';
import type { Player } from '../types/index.js';

interface TrueEndingScreenProps {
    player: Player;
    actions?: {
        completeQuest?: (questId: string | number) => void;
        confirmAscension?: () => void;
        cancelAscension?: () => void;
    };
}

const formatQuestReward = (reward: Record<string, any> | undefined) => {
    const parts = [
        Number(reward?.exp) > 0 ? `경험치 ${Number(reward?.exp).toLocaleString()}` : null,
        Number(reward?.gold) > 0 ? `골드 ${Number(reward?.gold).toLocaleString()}` : null,
        typeof reward?.item === 'string' && reward.item.trim() ? reward.item : null,
        typeof reward?.title === 'string' && reward.title.trim() ? `칭호 ${reward.title}` : null,
    ].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? `기본 보상 · ${parts.join(' · ')}` : '보상 확인';
};

const TrueEndingScreen = ({ player, actions }: TrueEndingScreenProps) => {
    const prefersReducedMotion = useReducedMotion() === true;
    const [revealState, setRevealState] = useState<TrueEndingRevealState>(
        prefersReducedMotion ? 'complete' : 'narrative',
    );
    const [lineIndex, setLineIndex] = useState(
        prefersReducedMotion ? ENDING_LINES.length : 0,
    );
    const [confirmationAccepted, setConfirmationAccepted] = useState(false);
    const revealCompleteRef = useRef(prefersReducedMotion);
    const confirmationAcceptedRef = useRef(false);
    const revealTimerRef = useRef<number | null>(null);

    const clearRevealTimer = useCallback(() => {
        if (revealTimerRef.current === null) return;
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
    }, []);

    const revealAll = useCallback(() => {
        if (revealCompleteRef.current) return;
        revealCompleteRef.current = true;
        clearRevealTimer();
        setLineIndex(ENDING_LINES.length);
        setRevealState('complete');
    }, [clearRevealTimer]);

    useEffect(() => {
        if (prefersReducedMotion) revealAll();
    }, [prefersReducedMotion, revealAll]);

    useEffect(() => {
        if (revealState === 'complete') return undefined;
        const step = getNextTrueEndingTimedStep(lineIndex);
        revealTimerRef.current = window.setTimeout(() => {
            revealTimerRef.current = null;
            setLineIndex(step.nextLineIndex);
            if (step.revealState === 'complete') {
                revealCompleteRef.current = true;
                setRevealState('complete');
            }
        }, step.delayMs);
        return clearRevealTimer;
    }, [clearRevealTimer, lineIndex, revealState]);

    usePlatformBackHandler(true, () => {
        if (resolveTrueEndingBackAction(revealState) === 'reveal_all') revealAll();
        return true;
    }, 500);

    const claimableQuests = getClaimableQuestEntries(player);
    const hasPendingQuestRewards = claimableQuests.length > 0;

    const confirmNewGamePlus = useCallback(() => {
        if (confirmationAcceptedRef.current) return;
        confirmationAcceptedRef.current = true;
        setConfirmationAccepted(true);
        actions?.confirmAscension?.();
    }, [actions]);

    const stats = [
        { label: '총 처치', value: (player?.stats?.kills || 0).toLocaleString() },
        { label: '보스 처치', value: player?.stats?.bossKills || 0 },
        { label: '사망 횟수', value: player?.stats?.deaths || 0 },
        { label: '최고 심연층', value: player?.stats?.abyssFloor || 0 },
        { label: '에테르 환생', value: player?.meta?.prestigeRank || 0 },
        { label: '마왕 토벌', value: player?.stats?.demonKingSlain || 0 },
    ];

    return (
        <div
            data-testid="true-ending-screen"
            data-reveal-state={revealState}
            className="fixed inset-0 z-50 h-[100dvh] overflow-x-hidden overflow-y-auto bg-black px-4 pt-[max(var(--aether-safe-area-top),1rem)] pb-[max(var(--aether-safe-area-bottom),1rem)]"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {TRUE_ENDING_STARS.map((star) => (
                    <Motion.div
                        key={`${star.top}-${star.left}`}
                        className="absolute rounded-full bg-white"
                        style={{ width: star.w, height: star.w, top: star.top, left: star.left }}
                        animate={prefersReducedMotion ? { opacity: 0.45 } : { opacity: [0.2, 1, 0.2] }}
                        transition={prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: star.dur, repeat: Infinity, delay: star.delay }}
                    />
                ))}
            </div>

            <div className="relative z-10 mx-auto flex min-h-full w-full max-w-lg min-w-0 flex-col">
                <div className="flex min-h-[44px] w-full justify-end">
                    {revealState === 'narrative' && (
                        <button
                            type="button"
                            data-testid="true-ending-skip"
                            onClick={revealAll}
                            className="min-h-[44px] rounded-lg border border-white/14 bg-black/45 px-4 text-[12px] font-readable font-bold text-slate-200 transition-colors hover:border-[#d5b180]/40 hover:text-[#f4e6c8]"
                        >
                            이야기 건너뛰기
                        </button>
                    )}
                </div>

                <main className="flex min-w-0 flex-1 flex-col items-center justify-center py-5 text-center">
                    <Motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 1.5 }}
                        className="mb-7 flex min-w-0 flex-col items-center gap-3"
                    >
                        <Star size={28} className="text-[#d5b180]" />
                        <h1 className="font-fira text-[14px] uppercase tracking-[0.32em] text-[#d5b180]">True Ending</h1>
                        <p className="break-words text-[12px] font-fira tracking-wider text-slate-300">
                            {player?.name || '영웅'} — Lv.{player?.level || 1} {player?.job || '모험가'}
                        </p>
                    </Motion.div>

                    <div
                        data-testid="true-ending-narrative"
                        aria-live="polite"
                        className="mb-7 min-h-[140px] w-full min-w-0 max-w-md space-y-4 px-2 sm:px-6"
                    >
                        {ENDING_LINES.slice(0, lineIndex).map((line, index) => (
                            <Motion.p
                                key={line}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.8 }}
                                className={`break-words text-center font-fira text-[12px] leading-relaxed ${index === lineIndex - 1 ? 'text-[#f4e6c8]' : 'text-slate-300'}`}
                            >
                                {line}
                            </Motion.p>
                        ))}
                    </div>

                    {revealState === 'complete' && (
                        <Motion.div
                            data-testid="true-ending-stats"
                            initial={prefersReducedMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
                            className="mb-7 w-full min-w-0 max-w-sm px-1 sm:px-6"
                        >
                            <div className="grid grid-cols-2 gap-3 rounded-[1.2rem] border border-[#d5b180]/20 bg-[#d5b180]/5 p-4 sm:grid-cols-3">
                                {stats.map(({ label, value }) => (
                                    <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                                        <span className="font-fira text-[16px] font-bold text-[#f4e6c8]">{value}</span>
                                        <span className="break-words text-[11px] font-fira uppercase tracking-wider text-slate-400">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </Motion.div>
                    )}

                    {revealState === 'complete' && hasPendingQuestRewards && (
                        <Motion.section
                            data-testid="true-ending-pending-quests"
                            aria-labelledby="true-ending-pending-quests-title"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
                            className="mb-7 flex w-full min-w-0 max-w-md flex-col gap-3 rounded-[1.2rem] border border-amber-200/20 bg-amber-200/5 p-4 text-left"
                        >
                            <div className="min-w-0">
                                <h2 id="true-ending-pending-quests-title" className="break-words text-[12px] font-readable font-bold text-amber-100">
                                    먼저 회수할 임무 보상
                                </h2>
                                <p data-testid="true-ending-pending-reward-guidance" className="mt-1 break-words text-[11px] leading-relaxed text-amber-100/75">
                                    완료한 임무 보상을 지금 수령할 수 있습니다. 수령 기록은 영구 보존되며, 보상 장비를 이번 여정에서 사용하려면 현재 여정을 계속하세요.
                                </p>
                            </div>
                            <div className="flex min-w-0 flex-col gap-2">
                                {claimableQuests.map((entry) => (
                                    <div
                                        key={String(entry.id)}
                                        data-testid={`true-ending-pending-quest-${String(entry.id)}`}
                                        className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="break-words text-[12px] font-readable font-bold text-slate-100">
                                                {entry.quest?.title || `임무 ${String(entry.id)}`}
                                            </p>
                                            <p className="mt-1 break-words text-[11px] font-readable text-slate-400">
                                                {formatQuestReward(entry.quest?.reward)}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            data-testid={`true-ending-claim-quest-${String(entry.id)}`}
                                            aria-label={`${entry.quest?.title || `임무 ${String(entry.id)}`} 보상 받기`}
                                            onClick={() => actions?.completeQuest?.(entry.id)}
                                            className="min-h-[44px] shrink-0 rounded-lg border border-emerald-300/35 bg-emerald-300/16 px-3 py-2 text-[11px] font-readable font-bold text-emerald-100 transition-colors hover:bg-emerald-300/24"
                                        >
                                            보상 받기
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Motion.section>
                    )}

                    {revealState === 'complete' && (
                        <Motion.div
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
                            className="flex min-w-0 flex-col items-center gap-3"
                        >
                            <button
                                type="button"
                                data-testid="true-ending-confirm"
                                onClick={confirmNewGamePlus}
                                disabled={confirmationAccepted || hasPendingQuestRewards}
                                aria-describedby={hasPendingQuestRewards ? 'true-ending-pending-quests-title' : undefined}
                                className="min-h-[44px] rounded-[1.2rem] border border-[#d5b180]/40 bg-[#d5b180]/12 px-8 py-3 font-fira text-[12px] uppercase tracking-[0.24em] text-[#d5b180] transition-all hover:border-[#d5b180]/60 hover:bg-[#d5b180]/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {confirmationAccepted ? '계승 중…' : 'New Game+'}
                            </button>
                            <button
                                type="button"
                                data-testid="true-ending-continue"
                                onClick={() => actions?.cancelAscension?.()}
                                disabled={confirmationAccepted}
                                className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-[12px] font-readable font-bold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                현재 여정 계속
                            </button>
                            <p className="break-words text-[11px] font-readable text-slate-400">
                                {hasPendingQuestRewards
                                    ? '보상 수령 전에는 현재 여정을 계속할 수 있습니다.'
                                    : '영구 성장과 기록을 계승해 다음 여정을 시작합니다.'}
                            </p>
                            <p data-testid="true-ending-new-game-plus-guidance" className="max-w-sm break-words text-[11px] leading-relaxed text-slate-500">
                                {hasPendingQuestRewards
                                    ? 'New Game+는 현재 장비와 소지 골드를 초기화합니다. 보상 장비를 사용하려면 수령 후 현재 여정을 계속하세요.'
                                    : 'New Game+는 현재 장비와 소지 골드를 초기화하고 영구 성장과 기록만 계승합니다.'}
                            </p>
                        </Motion.div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TrueEndingScreen;
