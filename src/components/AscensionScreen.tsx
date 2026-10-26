import { useState } from 'react';
import {
    ArrowRight,
    BookOpenCheck,
    Crown,
    Gem,
    RotateCcw,
    ShieldAlert,
    Sparkles,
    Swords,
} from 'lucide-react';
import { getSignatureDiscoveryProgress } from '../utils/signatureDiscovery';
import { MSG } from '../data/messages.js';
import { BALANCE } from '../data/constants';
import type { Player } from '../types/index.js';
import { getAscensionOutcome, isNewAscensionTitle } from '../utils/ascensionPreview';
import AscensionCycleSummary from './AscensionCycleSummary';
import EndgameJourney from './EndgameJourney';
import PendingQuestRewardList from './PendingQuestRewardList';
import { getClaimableQuestEntries } from '../utils/questProgress';
import type { GameActions } from '../hooks/actionDeps';
import ChallengeModifierPicker from './ChallengeModifierPicker';
import { getChallengeSlotCount, toggleChallengeSelection } from '../utils/runStart';
import { getAscensionRuleOfferView, getAscensionRuleRerollView } from '../utils/ascensionRuleView';
import { getJourneySurfaceText } from '../utils/journeyScope';
import AscensionGrowthTable from './AscensionGrowthTable';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import ActionButton from './ui/ActionButton';

interface AscensionScreenProps {
    player: Player;
    actions?: Pick<GameActions, 'cancelAscension' | 'confirmAscension' | 'completeQuest' | 'rerollAscensionRuleOffer'>;
    /** 2026-09 G3: 승천 화면에서 곧바로 에테르 거울로 — SystemTab과 같은 진입점을 재사용. */
    onOpenMirror?: () => void;
}

const AscensionScreen = ({ player, actions, onOpenMirror }: AscensionScreenProps) => {
    const dialog = useOverlayDialog({ label: MSG.A11Y_DIALOG_ASCENSION });
    const claimableQuests = getClaimableQuestEntries(player);
    const hasPendingQuestRewards = claimableQuests.length > 0;
    const outcome = getAscensionOutcome(player.meta);
    const signatureProgress = getSignatureDiscoveryProgress(player);
    // 2026-10 Wave 58: 새 여정의 도전 조건은 여기서 고른다 — 계승은 인트로를 다시 거치지 않는다. 슬롯은 새 단계 기준.
    const challengeSlots = getChallengeSlotCount(outcome.nextRank);
    const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
    const [ruleDeclined, setRuleDeclined] = useState(false);
    // 2026-10 Wave 94: 새 단계의 회차 규칙 카드 — 처음에는 패에서 가장 가벼운 카드가 골라져 있다(리듀서 기본값과 같다).
    const ruleOfferView = getAscensionRuleOfferView(player, outcome.nextRank);
    const [selectedRuleId, setSelectedRuleId] = useState<string | null>(ruleOfferView.defaultId);
    // 2026-10 Wave 95: 다시 뽑아 고른 카드가 패에서 사라지면 새 패의 기본 카드(가장 가벼운 카드)가 골라져 있다.
    const selectedRule = ruleOfferView.cards.find((card) => card.id === selectedRuleId)
        ?? ruleOfferView.cards.find((card) => card.id === ruleOfferView.defaultId)
        ?? null;
    const ruleRerollView = getAscensionRuleRerollView(player, outcome.nextRank);
    const rerollRule = () => {
        if (!ruleRerollView?.available) return;
        setRuleDeclined(false);
        actions?.rerollAscensionRuleOffer?.(ruleRerollView.rerolls);
    };
    const ruleDeclinedNow = Boolean(selectedRule?.optional && ruleDeclined);

    return (
        <div
            {...dialog}
            data-testid="ascension-screen"
            className="fixed inset-0 z-[200] flex h-[100dvh] items-stretch justify-center sm:items-center sm:p-4"
        >
            <div className="ae-scrim" aria-hidden="true" />
            <section className="ae-sheet ae-choice-sheet relative z-10 flex min-h-0 w-full max-w-[40rem] flex-col overflow-hidden rounded-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-ae-xl lg:max-w-[44rem]">
                <header className="ae-choice-sheet-head shrink-0 px-4 pb-3 pt-[max(var(--aether-safe-area-top),1rem)] sm:px-5 sm:pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="ae-eyebrow">마왕을 쓰러뜨린 뒤</div>
                            <h1 className="aether-type-display mt-1 break-keep font-readable font-bold text-ae-ink">다음 여정으로 계승</h1>
                            <p className="aether-type-meta mt-1 font-readable leading-relaxed text-ae-ink-2">
                                이번 여정을 마치고 더 강한 세계에서 다시 시작합니다.
                            </p>
                        </div>
                        <div className="ae-well shrink-0 px-3 py-2 text-center">
                            <div className="aether-type-label font-readable text-ae-ink-3">계승 단계</div>
                            <div className="aether-type-heading mt-0.5 flex items-center justify-center gap-1 font-fira font-bold tabular-nums text-ae-ether-hi">
                                {outcome.currentRank} <ArrowRight aria-hidden="true" size={13} className="text-ae-ink-3" /> {outcome.nextRank}
                            </div>
                        </div>
                    </div>
                </header>

                <main
                    data-testid="ascension-scroll-region"
                    className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4"
                >
                    {hasPendingQuestRewards && (
                        <section data-testid="ascension-pending-quests" aria-labelledby="ascension-pending-quests-title" className="space-y-3 pb-1 font-readable">
                            <h2 id="ascension-pending-quests-title" className="aether-type-strong font-bold text-ae-gold-text">{MSG.ASCEND_PENDING_QUESTS_TITLE}</h2>
                            <p className="aether-type-body leading-6 text-ae-ink-2">{MSG.ASCEND_PENDING_QUESTS_GUIDANCE}</p>
                            <PendingQuestRewardList entries={claimableQuests} testIdPrefix="ascension" onClaim={actions?.completeQuest} player={player} />
                            <div className="ae-divider" aria-hidden="true" />
                        </section>
                    )}
                    <section
                        data-testid="ascension-primary-reward"
                        className="ae-ornate px-4 py-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="ae-well flex h-10 w-10 shrink-0 items-center justify-center text-ae-gold-hi">
                                <Crown size={18} aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div data-testid="ascension-title-label" className="aether-type-label font-readable text-ae-gold-text">
                                    {isNewAscensionTitle(outcome, player.titles) ? MSG.ASCEND_NEW_TITLE_LABEL : MSG.ASCEND_TITLE_OWNED_LABEL}
                                </div>
                                <div className="aether-type-heading mt-0.5 break-keep font-readable font-bold text-ae-gold-hi">
                                    {outcome.title}
                                </div>
                                {outcome.milestone && (
                                    <div data-testid="ascension-current-unlock" className="ae-choice-divided mt-2 pt-2">
                                        <div className="aether-type-meta flex items-center gap-1.5 font-readable font-bold text-ae-ink">
                                            <Sparkles size={13} aria-hidden="true" className="shrink-0 text-ae-gold-text" />
                                            {outcome.milestone.name}
                                        </div>
                                        <p className="aether-type-label mt-1 font-readable leading-relaxed text-ae-ink-2">
                                            {outcome.milestone.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* 회차 규칙 카드 · 도전 규칙은 계승 보상 바로 아래 — 첫 화면에서 카드를 보고 고른 뒤 확정한다(확정 버튼 위 줄이 고른 카드를 말한다).
                        스크롤 끝에 있던 동안 확정 버튼은 늘 보이는데 카드는 스크롤해야 보여, 카드를 보지 않고 기본 카드로 계승할 수 있었다. */}
                    <ChallengeModifierPicker
                        testIdPrefix="ascension"
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

                    <AscensionCycleSummary player={player} testIdPrefix="ascension" />

                    <section data-testid="ascension-permanent-growth" className="ae-card p-3">
                        <h2 className="aether-type-meta flex items-center gap-1.5 font-readable font-bold text-ae-ink">
                            <Sparkles size={13} aria-hidden="true" className="shrink-0 text-ae-ether" />
                            {MSG.ASCEND_GROWTH_TITLE}
                        </h2>
                        <p className="aether-type-label mt-1 font-readable leading-relaxed text-ae-ink-3">{MSG.ASCEND_GROWTH_HINT}</p>
                        <AscensionGrowthTable rows={outcome.growth} />
                        {outcome.ladder.rankBefore > outcome.ladder.rankKept && (
                            <p data-testid="ascension-ladder-carry" className="aether-type-label mt-2 font-readable leading-relaxed text-ae-ink-2">
                                {MSG.ASCEND_LADDER_CARRY(outcome.ladder.rankBefore, outcome.ladder.rankKept, outcome.ladder.carryPercent, BALANCE.ESSENCE_LADDER_ASCEND_CARRY_MAX_RANKS)}
                            </p>
                        )}
                        {outcome.ladder.rerollPaid > 0 && (
                            <p data-testid="ascension-ladder-reroll-cost" className="aether-type-label mt-1 font-readable leading-relaxed text-ae-threat">
                                {MSG.ASCEND_LADDER_REROLL_COST(outcome.ladder.rerollPaid)}
                            </p>
                        )}
                        {outcome.mirrorEndless.unlocked ? (
                            <p data-testid="ascension-mirror-endless" className="aether-type-label mt-2 font-readable leading-relaxed text-ae-ether-hi">
                                {outcome.mirrorEndless.maxed
                                    ? MSG.ASCEND_MIRROR_ENDLESS_MAXED(BALANCE.MIRROR_ENDLESS_MAX_LEVEL)
                                    : outcome.mirrorEndless.steps > 0
                                    ? MSG.ASCEND_MIRROR_ENDLESS_STEPS(
                                        outcome.meta.essence || 0,
                                        outcome.mirrorEndless.steps,
                                        outcome.mirrorEndless.nextCost || 0,
                                        BALANCE.MIRROR_ENDLESS_ATK_PER_LEVEL,
                                        BALANCE.MIRROR_ENDLESS_HP_PER_LEVEL,
                                        BALANCE.MIRROR_ENDLESS_MP_PER_LEVEL,
                                    )
                                    : MSG.ASCEND_MIRROR_ENDLESS_SHORT(outcome.meta.essence || 0, outcome.mirrorEndless.shortfall)}
                            </p>
                        ) : (
                            <p className="aether-type-label mt-2 font-readable leading-relaxed text-ae-ink-3">
                                {MSG.MIRROR_CTA_HINT(player.meta?.essence || 0)}
                            </p>
                        )}
                        {onOpenMirror && (
                            <ActionButton
                                variant="ghost"
                                data-testid="ascension-open-mirror"
                                onClick={onOpenMirror}
                                icon={<Sparkles size={14} />}
                                label={MSG.MIRROR_CTA_LABEL}
                                className="mt-2 min-h-[48px] w-full font-readable"
                            />
                        )}
                    </section>

                    <section
                        data-testid="ascension-enemy-scaling"
                        className="ae-card p-3"
                    >
                        <div className="flex items-start gap-2.5">
                            <Swords size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-ae-threat" />
                            <div className="min-w-0 flex-1">
                                <h2 className="aether-type-meta font-readable font-bold text-ae-ink">다음 세계는 더 강하고 보상도 큽니다</h2>
                                <div className="aether-type-label mt-2 grid grid-cols-2 gap-2 font-readable">
                                    <div className="ae-well px-2.5 py-2 text-ae-ink-2">
                                        적 능력치
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1 font-fira font-bold tabular-nums text-ae-ink">
                                            +{outcome.currentEnemyStatPercent}% <ArrowRight aria-hidden="true" size={11} className="text-ae-ink-3" /> +{outcome.nextEnemyStatPercent}%
                                        </div>
                                    </div>
                                    <div className="ae-well px-2.5 py-2 text-ae-ink-2">
                                        처치 보상
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1 font-fira font-bold tabular-nums text-ae-good">
                                            +{outcome.currentEnemyRewardPercent}% <ArrowRight aria-hidden="true" size={11} className="text-ae-ink-3" /> +{outcome.nextEnemyRewardPercent}%
                                        </div>
                                    </div>
                                </div>
                                <p data-testid="ascension-enemy-level" className="aether-type-label mt-2 font-readable font-bold text-ae-ink">
                                    {MSG.ASCENSION_ENEMY_LEVEL_BONUS(outcome.currentEnemyLevelPercent, outcome.nextEnemyLevelPercent)}
                                </p>
                                <p data-testid="ascension-meta-ramp" className="aether-type-label mt-1 font-readable text-ae-ink-2">
                                    {MSG.ASCENSION_META_RAMP(outcome.metaBonusFullLevel)}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-2 sm:grid-cols-2">
                        <div data-testid="ascension-preserved-summary" className="ae-well ae-choice-kept p-3">
                            <h2 className="aether-type-meta flex items-center gap-1.5 font-readable font-bold text-ae-good">
                                <BookOpenCheck size={14} aria-hidden="true" /> {MSG.JOURNEY_KEPT_HEADING}
                            </h2>
                            <p className="aether-type-label mt-1.5 font-readable leading-relaxed text-ae-ink-2">
                                {getJourneySurfaceText('ascension', 'kept')}
                            </p>
                            {signatureProgress.discovered > 0 && (
                                <p
                                    data-testid="ascension-signature-preserve"
                                    className="ae-choice-divided aether-type-label mt-2 flex items-center gap-1.5 pt-2 font-readable text-ae-gold-text"
                                >
                                    <Gem size={12} aria-hidden="true" className="shrink-0" />
                                    <span className="font-fira tabular-nums">전설 각인 도감 {signatureProgress.discovered}/{signatureProgress.total} 보존</span>
                                </p>
                            )}
                        </div>

                        <div data-testid="ascension-reset-summary" className="ae-well ae-choice-reset p-3">
                            <h2 className="aether-type-meta flex items-center gap-1.5 font-readable font-bold text-ae-threat">
                                <ShieldAlert size={14} aria-hidden="true" /> {MSG.JOURNEY_RESET_HEADING}
                            </h2>
                            <p className="aether-type-label mt-1.5 font-readable leading-relaxed text-ae-ink-2">
                                {getJourneySurfaceText('ascension', 'reset')}
                            </p>
                        </div>
                    </section>

                    <EndgameJourney player={player} />
                </main>

                <footer className="ae-choice-sheet-foot shrink-0 px-4 pb-[max(var(--aether-safe-area-bottom),0.75rem)] pt-3 sm:px-5">
                    {hasPendingQuestRewards && <p className="aether-type-meta mb-2 font-readable leading-5 text-ae-gold-text">{MSG.ASCEND_PENDING_QUESTS_BLOCKED}</p>}
                    {selectedRule && (
                        <p data-testid="ascension-selected-rule" className="aether-type-label mb-2 font-readable leading-snug text-ae-gold-text">
                            {MSG.ASCENSION_RULE_NEXT(selectedRule.name)}
                            {ruleDeclinedNow && <span className="text-ae-ink-3"> · {MSG.ASCENSION_RULE_DECLINED}</span>}
                        </p>
                    )}
                    {/* VD-03 소유자 결정: 계승 · 계속은 같은 무게의 한 쌍이다 — 어느 쪽도 금빛 주 행동이 아니다. */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <ActionButton
                            variant="glass"
                            data-testid="ascension-cancel"
                            onClick={() => actions?.cancelAscension?.()}
                            icon={<RotateCcw size={15} />}
                            label={MSG.ASCENSION_CONTINUE}
                            className="ae-choice-pair min-h-[48px] min-w-0 px-3 font-readable"
                        />
                        <ActionButton
                            variant="glass"
                            data-testid="ascension-confirm"
                            onClick={() => actions?.confirmAscension?.(selectedChallenges, ruleDeclined, selectedRule?.id ?? null)}
                            disabled={hasPendingQuestRewards}
                            aria-describedby={hasPendingQuestRewards ? 'ascension-pending-quests-title' : undefined}
                            icon={<Crown size={15} />}
                            label={MSG.ASCENSION_CONFIRM}
                            className="ae-choice-pair min-h-[48px] min-w-0 px-3 font-readable"
                        />
                    </div>
                </footer>
            </section>
        </div>
    );
};

export default AscensionScreen;
