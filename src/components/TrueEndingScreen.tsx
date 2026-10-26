import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Crown, RotateCcw, Star } from 'lucide-react';
import { usePlatformBackHandler } from '../platform/platformBackRegistry';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
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
import ActionButton from './ui/ActionButton';

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
    <div data-testid="true-ending-new-game-plus-guidance" className="aether-type-label max-w-sm space-y-1 break-words font-readable leading-relaxed text-ae-ink-3">
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
    // 감사 A11Y-01: Escape는 뒤로가기와 같다 — 연출 중이면 한 번에 펼친다.
    const dialog = useOverlayDialog({
        label: MSG.TRUE_ENDING_TITLE,
        onEscape: () => {
            if (resolveTrueEndingBackAction(revealState) === 'reveal_all') revealAll();
        },
    });

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
            {...dialog}
            data-testid="true-ending-screen"
            data-reveal-state={revealState}
            className="ae-true-ending fixed inset-0 z-50 h-[100dvh] overflow-x-hidden overflow-y-auto px-4 pt-[max(var(--aether-safe-area-top),1rem)] pb-[max(var(--aether-safe-area-bottom),1rem)]"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {TRUE_ENDING_STARS.map((star) => (
                    <Motion.div
                        key={`${star.top}-${star.left}`}
                        className="absolute rounded-full bg-ae-ink"
                        style={{ width: star.w, height: star.w, top: star.top, left: star.left }}
                        animate={prefersReducedMotion ? { opacity: 0.45 } : { opacity: [0.2, 1, 0.2] }}
                        transition={prefersReducedMotion
                            ? { duration: 0 }
                            : { duration: star.dur, repeat: Infinity, delay: star.delay }}
                    />
                ))}
            </div>

            <div className="relative z-10 mx-auto flex min-h-full w-full max-w-xl min-w-0 flex-col">
                <div className="flex min-h-[44px] w-full justify-end">
                    {revealState === 'narrative' && (
                        <ActionButton
                            variant="ghost"
                            data-testid="true-ending-skip"
                            onClick={revealAll}
                            label="이야기 건너뛰기"
                            className="min-h-[44px] px-4 font-readable"
                        />
                    )}
                </div>

                <main className="flex min-w-0 flex-1 flex-col items-center justify-center py-5 text-center">
                    <Motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 1.5 }}
                        className="ae-ornate mb-7 flex w-full min-w-0 max-w-sm flex-col items-center gap-2.5 px-6 py-6"
                    >
                        <Star size={28} aria-hidden="true" className="text-ae-gold" />
                        <h1 className="aether-type-display font-readable font-bold text-ae-gold-hi">{MSG.TRUE_ENDING_TITLE}</h1>
                        <p className="aether-type-meta break-words font-readable text-ae-ink-2">
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
                                className={`aether-type-body break-words text-center font-readable leading-relaxed ${index === lineIndex - 1 ? 'text-ae-ink' : 'text-ae-ink-2'}`}
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
                            <div className="ae-well grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                                {stats.map(({ label, value }) => (
                                    <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                                        <span className="aether-type-heading font-fira font-bold tabular-nums text-ae-gold-hi">{value}</span>
                                        <span className="aether-type-label break-words font-readable text-ae-ink-3">{label}</span>
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
                            className="ae-card mb-7 flex w-full min-w-0 max-w-md flex-col gap-3 p-4 text-left"
                        >
                            <div className="min-w-0">
                                <h2 id="true-ending-pending-quests-title" className="aether-type-meta break-words font-readable font-bold text-ae-gold-text">
                                    먼저 회수할 임무 보상
                                </h2>
                                <p data-testid="true-ending-pending-reward-guidance" className="aether-type-label mt-1 break-words font-readable leading-relaxed text-ae-ink-2">
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
                            {/* VD-03 소유자 결정: 계승 · 계속은 같은 무게의 한 쌍(계승 화면과 같다) — 금빛 주 행동이 없다. */}
                            <div className="grid w-full max-w-sm grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <ActionButton
                                    variant="glass"
                                    data-testid="true-ending-confirm"
                                    onClick={confirmNewGamePlus}
                                    disabled={confirmationAccepted || hasPendingQuestRewards}
                                    aria-describedby={hasPendingQuestRewards ? 'true-ending-pending-quests-title' : undefined}
                                    icon={<Crown size={15} />}
                                    label={confirmationAccepted ? MSG.ASCENSION_CONFIRMING : MSG.ASCENSION_CONFIRM}
                                    className="ae-choice-pair w-full px-4 font-readable"
                                />
                                <ActionButton
                                    variant="glass"
                                    data-testid="true-ending-continue"
                                    onClick={() => actions?.cancelAscension?.()}
                                    disabled={confirmationAccepted}
                                    icon={<RotateCcw size={15} />}
                                    label={MSG.ASCENSION_CONTINUE}
                                    className="ae-choice-pair w-full px-4 font-readable"
                                />
                            </div>
                            <TrueEndingJourneyNote />
                        </Motion.div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default TrueEndingScreen;
