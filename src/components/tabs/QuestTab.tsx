import type { ReactNode } from 'react';
import { Check, Scroll } from 'lucide-react';
import { formatRewardParts, getActiveQuestEntries } from '../../utils/gameUtils';
import { getGoldIncome } from '../../utils/challengeRules';
import { getTraitProfile, getTraitQuestResonance } from '../../utils/runProfileUtils';
import { buildChainJournal } from '../../utils/chainJournal';
import { getQuestObjectiveGateNotice } from '../../utils/questObjectiveGate';
import { isLifetimeCounterQuest } from '../../utils/cumulativeQuestProgress';
import StoryJournal from '../StoryJournal';
import EndgameJourney from '../EndgameJourney';
import HuntContractCard from './HuntContractCard';
import ActionButton from '../ui/ActionButton';
import Chip from '../ui/Chip';
import Gauge from '../ui/Gauge';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { GS } from '../../reducers/gameStates';
import {
    getCurrentDailyProtocol,
    getCurrentWeeklyProtocol,
    getWeeklyMissionRows,
} from '../../utils/protocolCycle';
import { scaleEssenceReward } from '../../systems/essenceRewardMult';
import type { GameActions } from '../../hooks/actionDeps';
import type { DailyProtocolMissionReward, Player, Quest, QuestReward } from '../../types/index.js';

// ── 유틸 ──────────────────────────────────────────────
// 2026-10 통합: 게시판(QuestBoardPanel)과 같은 순서 — `objective` → `desc` → 레벨 · 횟수. `desc`를 건너뛰면
//   카운터 임무(첫 임무 포함)가 내부 키를 그대로 그렸다("목표: explores 1회 달성").
const getQuestObjectiveText = (quest: Quest) => {
    if (quest?.objective) return quest.objective;
    if (quest?.desc) return quest.desc;
    return quest?.target === 'level'
        ? MSG.QUEST_TAB_OBJECTIVE_LEVEL(quest.goal)
        : MSG.QUEST_TAB_OBJECTIVE_COUNT(quest.target, quest.goal);
};

// cycle 541: progress / goal defaults 제거 — QuestTab/QuestBoardPanel 양쪽
//   helper duplication. 호출자가 모두 명시 전달이라 default 도달 불가.
//   default 청소 메가 시리즈 36번째 cross-file 4-default batch.
const getQuestProgressText = (quest: Quest, progress: number) => (
    quest?.target === 'level'
        ? MSG.QUEST_TAB_PROGRESS_LEVEL(progress, quest.goal)
        : `${progress}/${quest.goal}`
);

const getQuestProgressPercent = (progress: number, goal: number) =>
    Math.min(100, (Math.max(0, progress) / Math.max(1, goal)) * 100);

/** `QuestRewardChips`가 표시하는 보상 강조색 — 완료/현상수배/일반 진행 3종. */
type QuestRewardAccent = 'green' | 'amber' | 'blue';

interface QuestRewardChipsProps {
    reward: QuestReward;
    accent: QuestRewardAccent;
    /** 받을 플레이어 — 골드 칩은 실제로 받는 금액('빈손의 시작'이면 절반)이다(2026-10 Wave 62). */
    player: Player;
}

// cycle 313: export 제거 — QuestTab 내부 1회 사용만, 외부 import 0건.
// cycle 429: default accent 값 제거 — 호출자가 ternary로 명시 전달이라 default
//   도달 불가 (cycle 428 QuestBoardPanel RewardChips paired completion).
const QuestRewardChips = ({ reward, accent, player }: QuestRewardChipsProps) => {
    const rewards = formatRewardParts(reward, player);
    if (!rewards.length) return null;
    const accentClass = accent === 'green'
        ? 'border-ae-good/30 bg-ae-good/10 text-ae-good'
        : accent === 'amber'
            ? 'border-ae-gold/30 bg-ae-gold/10 text-ae-gold-text'
            : 'border-ae-ether/20 bg-ae-ether/10 text-ae-ether-hi';
    return (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
            {rewards.map((entry) => (
                <span key={`${accent}_${entry}`} className={`ae-chip border font-fira tabular-nums ${accentClass}`}>{entry}</span>
            ))}
        </div>
    );
};

/** 섹션 머리 — 제목 + 오른쪽 진행 수 알약. */
const SectionHead = ({ title, count, done }: { title: string; count: ReactNode; done: boolean }) => (
    <header className="flex items-center justify-between gap-3">
        <h3 className="font-readable aether-type-strong text-ae-ink">{title}</h3>
        <span className={`ab-count ${done ? 'is-good' : ''}`}>{count}</span>
    </header>
);

// ── 컴포넌트 ──────────────────────────────────────────
/**
 * QuestTab — Dashboard의 quest 탭 콘텐츠 (#4 분리)
 * props: player, actions, isInSafeZone
 */
// 2026-10 Wave 58: 정수 보상은 지급량(계승 단계 × 거울 배율)으로 보여 준다 — 원액을 보여 주던 동안 실제 지급보다 적게 보였다.
const getDailyRewardLabel = (reward: DailyProtocolMissionReward, meta: Player['meta']) => {
    if (reward?.essence) return MSG.ESSENCE_REWARD(scaleEssenceReward(reward.essence, meta));
    if (reward?.item) return reward.item;
    if (reward?.relicShard) return MSG.QUEST_TAB_RELIC_SHARD_REWARD;
    return '';
};

/** QuestTab이 실제로 호출하는 액션만 좁힌 부분집합. */
type QuestTabActions = Pick<GameActions, 'setGameState' | 'completeQuest' | 'claimWeeklyMission'>;

type ActiveQuestEntry = ReturnType<typeof getActiveQuestEntries>[number] & {
    resonance: ReturnType<typeof getTraitQuestResonance>;
    progressPercent: number;
};

interface QuestCardProps {
    entry: ActiveQuestEntry;
    player: Player;
    onClaim: (id: ActiveQuestEntry['id']) => void;
}

/** 진행 중인 임무 한 장 — 호박빛 임무 카드(완료하면 초록 림). 보상 칩이 진행도보다 먼저 온다. */
const QuestCard = ({ entry, player, onClaim }: QuestCardProps) => {
    const gate = entry.isComplete ? null : getQuestObjectiveGateNotice(entry.quest, player.level);
    return (
        <article data-testid={`quest-tab-entry-${entry.id}`} className={`ab-mission p-3.5 font-readable ${entry.isComplete ? 'is-ready' : ''}`}>
            <div className="flex flex-wrap items-center gap-1.5">
                {entry.isBounty && <Chip tone="gold">{MSG.QUEST_TAB_BOUNTY}</Chip>}
                {/* 진행도를 평생 누적 기록에서 읽는 임무 — 판정은 진행도와 같은 표가 소유한다. */}
                {isLifetimeCounterQuest(entry.quest) && (
                    <Chip title={MSG.QUEST_LIFETIME_COUNTER_HINT} data-testid="quest-lifetime-counter-chip">
                        {MSG.QUEST_LIFETIME_COUNTER_CHIP}
                    </Chip>
                )}
                {entry.quest.buildTag && <Chip>{entry.quest.buildLabel || entry.quest.buildTag}</Chip>}
                {entry.resonance.label ? (
                    <Chip tone={entry.resonance.score >= 6 ? 'ether' : 'neutral'}>{entry.resonance.label}</Chip>
                ) : null}
                {!entry.isComplete && <Chip className="ml-auto">{MSG.QUEST_TAB_IN_PROGRESS}</Chip>}
            </div>
            <h4 className={`mt-2 aether-type-strong ${entry.isComplete ? 'text-ae-good' : 'text-ae-ink'}`}>
                {entry.quest.title}
            </h4>
            <p className="mt-1 aether-type-meta leading-snug text-ae-ink-3">{entry.quest.desc}</p>
            <p className="mt-2 aether-type-body text-ae-ink-2">{MSG.QUEST_TAB_OBJECTIVE(getQuestObjectiveText(entry.quest))}</p>
            {/* Wave 28: 목표 지역에 아직 걸어 들어갈 수 없으면 실제 진입 레벨을 말한다. */}
            {gate && (
                <p data-testid="quest-objective-gate" className="mt-1 aether-type-meta text-ae-gold-text">
                    {MSG.QUEST_OBJECTIVE_GATE_NOTICE(gate.map, gate.routeGateLevel)}
                </p>
            )}
            {entry.resonance.summary && (
                <p className="mt-2 aether-type-meta text-ae-ink-2">{entry.resonance.summary}</p>
            )}
            <QuestRewardChips reward={entry.quest.reward ?? {}} accent={entry.isComplete ? 'green' : entry.isBounty ? 'amber' : 'blue'} player={player} />
            <div className="mt-3 flex items-center gap-3">
                <Gauge
                    kind="ether"
                    value={entry.progressPercent}
                    max={100}
                    label={entry.quest.title || MSG.QUEST_TAB_ACTIVE_TITLE}
                    className={`ab-gauge-thin flex-1 ${entry.isComplete ? 'ab-gauge-good' : entry.isBounty ? 'ab-gauge-gold' : ''}`}
                />
                <span className={`ab-count ${entry.isComplete ? 'is-good' : entry.isBounty ? 'is-gold' : ''}`}>
                    {getQuestProgressText(entry.quest, entry.progress)}
                </span>
            </div>
            {entry.isComplete && (
                <ActionButton
                    variant="glass"
                    icon={<Check size={16} />}
                    label={MSG.QUEST_TAB_CLAIM}
                    onClick={() => onClaim(entry.id)}
                    className="mt-3 w-full"
                />
            )}
        </article>
    );
};

// cycle 481: 컴팩트 prop 인터페이스 제거 — cycle 471이 Dashboard callsite 전달
//   제거 후 caller 0건. cascade로 토글 상태 + 33 ternary + summary 분기 일괄 정리
//   (cycle 472-479 paired 9사이클 cascade의 마지막 panel).
interface QuestTabProps {
    player: Player;
    actions?: QuestTabActions;
    isInSafeZone?: boolean;
}

const QuestTab = ({ player, actions, isInSafeZone }: QuestTabProps) => {
    const traitProfile = getTraitProfile(player, { maxHp: player.maxHp, maxMp: player.maxMp });
    const activeQuestEntries = getActiveQuestEntries(player).map((entry) => ({
        ...entry,
        resonance: getTraitQuestResonance(entry.quest, traitProfile),
        progressPercent: getQuestProgressPercent(entry.progress, entry.quest.goal!),
    }));
    const claimableQuestCount = activeQuestEntries.filter((e) => e.isComplete).length;
    const chainJournalEntries = buildChainJournal(player.eventChainProgress);
    const dp = getCurrentDailyProtocol(player, new Date());
    const dpMissions = dp.missions;
    const dpDoneCount = dpMissions.filter((m) => m.done).length;

    // 주간 임무 진행도
    const weeklyProtocol = getCurrentWeeklyProtocol(player.weeklyProtocol, new Date());
    const weeklyMissions = getWeeklyMissionRows(weeklyProtocol);
    const weeklyClaimed = weeklyMissions.filter((m) => m.claimed).length;

    const discoveryChains = BALANCE.DISCOVERY_CHAINS || [];
    const visitedMaps = new Set(player.stats?.visitedMaps || []);
    const completedChains = player.stats?.discoveryChains || [];

    return (
        <div className="ab-stack pb-2">
            {/* 머리 — 진행 · 보상 대기 · 게시판 */}
            <section className="ae-card is-quiet ab-card-pad font-readable">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="ether">{MSG.QUEST_TAB_ACTIVE_COUNT(activeQuestEntries.length)}</Chip>
                    <Chip tone={claimableQuestCount > 0 ? 'good' : 'neutral'}>{MSG.QUEST_TAB_CLAIMABLE_COUNT(claimableQuestCount)}</Chip>
                    <Chip tone={isInSafeZone ? 'ether' : 'neutral'}>
                        {isInSafeZone ? MSG.QUEST_TAB_BOARD_OPEN : MSG.QUEST_TAB_BOARD_TOWN_ONLY}
                    </Chip>
                </div>
                <p className="mt-2 aether-type-meta leading-relaxed text-ae-ink-3">{MSG.QUEST_TAB_INTRO}</p>
                {isInSafeZone && (
                    <ActionButton
                        variant="glass"
                        data-testid="quest-tab-open-board"
                        icon={<Scroll size={16} />}
                        label={MSG.QUEST_TAB_OPEN_BOARD}
                        onClick={() => actions?.setGameState?.(GS.QUEST_BOARD)}
                        className="mt-3 w-full"
                    />
                )}
            </section>

            <StoryJournal claimedQuestIds={player.stats?.claimedQuestIds} />

            {/* 진행 중인 임무 — 이 탭의 본문이라 이야기 바로 뒤에 둔다. */}
            {activeQuestEntries.length > 0 ? (
                <section aria-label={MSG.QUEST_TAB_ACTIVE_TITLE} className="space-y-2.5">
                    {activeQuestEntries.map((entry) => (
                        <QuestCard key={entry.id} entry={entry} player={player} onClaim={(id) => actions?.completeQuest(id)} />
                    ))}
                </section>
            ) : (
                <section className="ae-card is-quiet flex flex-col items-center gap-2 px-4 py-8 text-center font-readable">
                    <Scroll size={24} className="text-ae-ink-3" aria-hidden="true" />
                    <p className="aether-type-body font-bold text-ae-ink-2">{MSG.QUEST_TAB_EMPTY}</p>
                    <p className="aether-type-meta text-ae-ink-3">{isInSafeZone ? MSG.QUEST_EMPTY_TOWN_HINT : MSG.QUEST_EMPTY_FIELD_HINT}</p>
                </section>
            )}

            <EndgameJourney player={player} />
            <HuntContractCard player={player} />

            {/* 오늘의 임무 */}
            {dpMissions.length > 0 && (
                <section className="ae-card ab-card-pad font-readable">
                    <SectionHead title={MSG.QUEST_TAB_DAILY_TITLE} count={`${dpDoneCount}/${dpMissions.length}`} done={dpDoneCount === dpMissions.length} />
                    {dp.relicShards > 0 && (
                        <Chip tone="gold" className="mt-2">{MSG.QUEST_TAB_RELIC_SHARDS(dp.relicShards)}</Chip>
                    )}
                    <div className="ab-rows mt-1">
                        {dpMissions.map((mission) => {
                            const typeLabel = MSG.QUEST_TAB_DAILY_TYPE[mission.type as keyof typeof MSG.QUEST_TAB_DAILY_TYPE] || mission.type;
                            return (
                                <div key={mission.id} className="py-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <span className={`flex items-center gap-1.5 aether-type-body ${mission.done ? 'text-ae-good' : 'text-ae-ink'}`}>
                                            {mission.done && <Check size={14} aria-hidden="true" />}
                                            {typeLabel} <span className="font-fira tabular-nums">{mission.progress}/{mission.goal}</span>
                                        </span>
                                        <span className={`aether-type-meta ${mission.done ? 'font-bold text-ae-good' : 'text-ae-gold-text'}`}>
                                            {getDailyRewardLabel(mission.reward, player.meta)}
                                        </span>
                                    </div>
                                    <Gauge
                                        kind="exp"
                                        value={mission.progress}
                                        max={Math.max(1, mission.goal)}
                                        label={typeLabel}
                                        className={`ab-gauge-thin mt-2 ${mission.done ? 'ab-gauge-good' : ''}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 주간 임무 */}
            {weeklyMissions.length > 0 && (
                <section className="ae-card ab-card-pad font-readable">
                    <SectionHead title={MSG.QUEST_TAB_WEEKLY_TITLE} count={`${weeklyClaimed}/${weeklyMissions.length}`} done={weeklyClaimed === weeklyMissions.length} />
                    <div className="ab-rows mt-1">
                        {weeklyMissions.map((mission) => (
                            <div key={mission.id} className="py-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                    <span className={`aether-type-body ${mission.claimed ? 'text-ae-good' : mission.done ? 'text-ae-gold-text' : 'text-ae-ink'}`}>
                                        {mission.label} ({mission.current}/{mission.target})
                                    </span>
                                    {mission.done && !mission.claimed ? (
                                        <ActionButton
                                            variant="glass"
                                            icon={<Check size={16} />}
                                            label={MSG.QUEST_TAB_CLAIM}
                                            onClick={() => actions?.claimWeeklyMission?.(mission.id)}
                                            className="shrink-0"
                                        />
                                    ) : mission.claimed ? (
                                        <Chip tone="good" icon={<Check size={12} />}>{MSG.QUEST_TAB_CLAIMED}</Chip>
                                    ) : (
                                        <span className="font-fira tabular-nums aether-type-meta text-ae-gold-text">
                                            {MSG.QUEST_TAB_WEEKLY_REWARD(getGoldIncome(player, mission.reward.gold), mission.reward.premiumCurrency)}
                                        </span>
                                    )}
                                </div>
                                <Gauge
                                    kind="ether"
                                    value={mission.current}
                                    max={Math.max(1, mission.target)}
                                    label={mission.label}
                                    className={`ab-gauge-thin mt-2 ${mission.claimed ? 'ab-gauge-good' : 'ab-gauge-gold'}`}
                                />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 체인 저널 섹션 — 진행 중인 내러티브 이벤트 체인 표시 */}
            {chainJournalEntries.length > 0 && (
                <section className="ae-card is-quiet ab-card-pad font-readable">
                    <SectionHead title={MSG.CHAIN_JOURNAL_TITLE} count={chainJournalEntries.length} done={false} />
                    <div className="ab-rows mt-1">
                        {chainJournalEntries.map((entry) => (
                            <div key={entry.chainId} className="py-2.5">
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                    <span className="aether-type-body text-ae-ink">{entry.label}</span>
                                    <span className="font-fira tabular-nums aether-type-meta text-ae-exp">{MSG.CHAIN_JOURNAL_STEP(entry.currentStep, entry.totalSteps)}</span>
                                </div>
                                {entry.nextLoc && (
                                    <p className="mt-0.5 aether-type-meta text-ae-ink-3">{entry.nextMinAbyssFloor !== null
                                        ? MSG.CHAIN_JOURNAL_NEXT_LOC_FLOOR(entry.nextLoc, entry.nextMinAbyssFloor)
                                        : MSG.CHAIN_JOURNAL_NEXT_LOC(entry.nextLoc)}</p>
                                )}
                                <Gauge kind="exp" value={entry.currentStep} max={Math.max(1, entry.totalSteps)} label={entry.label} className="ab-gauge-thin mt-2" />
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 발견 체인 섹션 */}
            {discoveryChains.length > 0 && (
                <section className="ae-card is-quiet ab-card-pad font-readable">
                    <SectionHead
                        title={MSG.QUEST_TAB_DISCOVERY_TITLE}
                        count={`${completedChains.length}/${discoveryChains.length}`}
                        done={completedChains.length === discoveryChains.length}
                    />
                    <div className="ab-rows mt-1">
                        {discoveryChains.map((chain) => {
                            const done = completedChains.includes(chain.id);
                            const visitedCount = chain.locations.filter((l) => visitedMaps.has(l)).length;
                            return (
                                <div key={chain.id} className="py-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                        <span className={`aether-type-body ${done ? 'text-ae-good' : 'text-ae-ink'}`}>{chain.label}</span>
                                        {done ? (
                                            <Chip tone="good" icon={<Check size={12} />}>{MSG.QUEST_TAB_DISCOVERY_DONE}</Chip>
                                        ) : (
                                            <span className="font-fira tabular-nums aether-type-meta text-ae-ink-3">{MSG.QUEST_TAB_DISCOVERY_VISITS(visitedCount, chain.locations.length)}</span>
                                        )}
                                    </div>
                                    <Gauge
                                        kind="ether"
                                        value={visitedCount}
                                        max={Math.max(1, chain.locations.length)}
                                        label={chain.label}
                                        className={`ab-gauge-thin mt-2 ${done ? 'ab-gauge-good' : ''}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};

export default QuestTab;
