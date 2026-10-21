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
import PendingQuestRewardList from './PendingQuestRewardList';
import AscensionCycleSummary from './AscensionCycleSummary';
import ChallengeModifierPicker from './ChallengeModifierPicker';
import { MSG } from '../data/messages';
import { getAscensionOutcome } from '../utils/ascensionPreview';
import { getChallengeSlotCount, toggleChallengeSelection } from '../utils/runStart';
import { getAscensionRuleOfferView, getAscensionRuleRerollView } from '../utils/ascensionRuleView';
import { getJourneySurfaceText } from '../utils/journeyScope';

interface TrueEndingScreenProps {
    player: Player;
    actions?: {
        completeQuest?: (questId: string | number) => void;
        confirmAscension?: (challengeModifiers?: string[], declineRule?: boolean, ruleId?: string | null) => void;
        rerollAscensionRuleOffer?: (expectedRerolls: number) => void;
        cancelAscension?: () => void;
    };
}

/**
 * 2026-10 Wave 134(원장 §147): 계승하면 무엇이 남고 무엇이 새로 시작하는지 — 계승 화면과 같은 표(`JOURNEY_RESET_SURFACE`)를
 * 그린다. 이전에는 계승을 영어 이름으로 부르고 남는 것을 손으로 적은 목록이었는데, 영구 성장 · 도감 · 계승 기록"만" 남는다고
 * 말해 전설 각인 수집 · 직업 여정 · 시즌 진행이 남는다는 것을 빼먹었다. 미수령 보상 안내는 위의 보상 칸(`TRUE_ENDING_PENDING_GUIDANCE`)이 한다.
 */
export const TrueEndingJourneyNote = () => (
    <div data-testid="true-ending-new-game-plus-guidance" className="max-w-sm space-y-1 break-words text-[11px] leading-relaxed text-slate-400">
        <p>{MSG.JOURNEY_KEPT_LINE(getJourneySurfaceText('ascension', 'kept'))}</p>
        <p>{MSG.JOURNEY_RESET_LINE(getJourneySurfaceText('ascension', 'reset'))}</p>
    </div>
);

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
    // 2026-10 Wave 58: 새 여정의 도전 조건 — 계승 화면과 같다(슬롯은 새 단계 기준).
    const challengeSlots = getChallengeSlotCount(getAscensionOutcome(player.meta).nextRank);
    const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
    const [ruleDeclined, setRuleDeclined] = useState(false);
    // 2026-10 Wave 94: 새 단계의 회차 규칙 카드 — 계승 화면과 같다.
    const ruleOfferView = getAscensionRuleOfferView(player, getAscensionOutcome(player.meta).nextRank);
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(ruleOfferView.defaultId);
    // 2026-10 Wave 95: 다시 뽑아 고른 카드가 패에서 사라지면 새 패의 기본 카드(가장 가벼운 카드)가 골라져 있다.
    const selectedRule = ruleOfferView.cards.find((card) => card.id === selectedRuleId)
        ?? ruleOfferView.cards.find((card) => card.id === ruleOfferView.defaultId)
        ?? null;
    const ruleRerollView = getAscensionRuleRerollView(player, getAscensionOutcome(player.meta).nextRank);
    const rerollRule = () => {
        if (!ruleRerollView?.available) return;
        setRuleDeclined(false);
        actions?.rerollAscensionRuleOffer?.(ruleRerollView.rerolls);
    };

    const confirmNewGamePlus = useCallback(() => {
        if (confirmationAcceptedRef.current) return;
        confirmationAcceptedRef.current = true;
        setConfirmationAccepted(true);
        actions?.confirmAscension?.(selectedChallenges, ruleDeclined, selectedRule?.id ?? null);
    }, [actions, selectedChallenges, ruleDeclined, selectedRule?.id]);

    const stats = [
        { label: '총 처치', value: (player?.stats?.kills || 0).toLocaleString() },
        { label: '보스 처치', value: player?.stats?.bossKills || 0 },
        { label: '사망 횟수', value: player?.stats?.deaths || 0 },
        { label: '최고 심연층', value: player?.stats?.abyssFloor || 0 },
        { label: MSG.TRUE_ENDING_STAT_PRESTIGE, value: player?.meta?.prestigeRank || 0 },
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
                        <h1 className="font-fira text-[14px] uppercase tracking-[0.32em] text-[#d5b180]">{MSG.TRUE_ENDING_TITLE}</h1>
                        <p className="break-words text-[12px] font-fira tracking-wider text-slate-300">
                            {player?.name || '영웅'} — {MSG.LEVEL_LABEL(player?.level || 1)} {player?.job || '모험가'}
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

                    {revealState === 'complete' && (
                        <div className="mb-7 w-full min-w-0 max-w-sm px-1 sm:px-6">
                            <AscensionCycleSummary player={player} testIdPrefix="true-ending" />
                        </div>
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
                                    {MSG.TRUE_ENDING_PENDING_GUIDANCE}
                                </p>
                            </div>
                            <PendingQuestRewardList entries={claimableQuests} testIdPrefix="true-ending" onClaim={actions?.completeQuest} player={player} />
                        </Motion.section>
                    )}

                    {revealState === 'complete' && (
                        <Motion.div
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
                            className="flex min-w-0 flex-col items-center gap-3"
                        >
                            <div className="w-full max-w-sm">
                                <ChallengeModifierPicker
                                    testIdPrefix="true-ending"
                                    rule={selectedRule}
                                    ruleOffer={ruleOfferView.cards}
                                    onSelectRule={setSelectedRuleId}
                                    ruleReroll={ruleRerollView}
                                    onRerollRule={rerollRule}
                                    ruleDeclined={ruleDeclined}
                                    onToggleRule={() => setRuleDeclined((current) => !current)}
                                    selected={selectedChallenges}
                                    slots={challengeSlots}
                                    onToggle={(id) => setSelectedChallenges((current) => toggleChallengeSelection(current, id, challengeSlots))}
                                />
                            </div>
                            <button
                                type="button"
                                data-testid="true-ending-confirm"
                                onClick={confirmNewGamePlus}
                                disabled={confirmationAccepted || hasPendingQuestRewards}
                                aria-describedby={hasPendingQuestRewards ? 'true-ending-pending-quests-title' : undefined}
                                className="min-h-[44px] rounded-[1.2rem] border border-[#d5b180]/40 bg-[#d5b180]/12 px-8 py-3 font-fira text-[12px] uppercase tracking-[0.24em] text-[#d5b180] transition-all hover:border-[#d5b180]/60 hover:bg-[#d5b180]/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {confirmationAccepted ? MSG.ASCENSION_CONFIRMING : MSG.ASCENSION_CONFIRM}
                            </button>
                            <button
                                type="button"
                                data-testid="true-ending-continue"
                                onClick={() => actions?.cancelAscension?.()}
                                disabled={confirmationAccepted}
                                className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-[12px] font-readable font-bold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {MSG.ASCENSION_CONTINUE}
                            </button>
                            <TrueEndingJourneyNote />
                        </Motion.div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TrueEndingScreen;
