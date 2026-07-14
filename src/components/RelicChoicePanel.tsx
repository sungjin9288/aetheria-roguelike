import { AT } from '../reducers/actionTypes';
import { RARITY_COLORS } from '../data/titles';
import { RELIC_SYNERGIES } from '../data/relics';
import { getRelicChoiceDecisionStrip } from '../utils/relicChoiceDecision';
import { formatRelicText, getRelicDisplayName } from '../utils/relicPresentation';
import SignalBadge from './SignalBadge';
import type { Player, Relic } from '../types/index.js';

interface RelicChoicePanelProps {
    pendingRelics?: Relic[] | null;
    dispatch: (action: any) => void;
    player?: Player | null;
}

/**
 * 유물 시너지 점수 계산 (0~100)
 * 현재 보유 유물과 새 유물의 effect 조합을 분석합니다.
 */
const SYNERGY_MAP: any = {
    // 공격 콤보
    double_strike: ['execute_bonus', 'combo_stack', 'armor_pen', 'ancient_power'],
    execute_bonus: ['double_strike', 'low_hp_atk', 'combo_stack'],
    combo_stack: ['double_strike', 'execute_bonus', 'ancient_power'],
    ancient_power: ['double_strike', 'combo_stack', 'execute_bonus'],
    low_hp_atk: ['execute_bonus', 'death_save', 'void_heart'],
    // 기술과 마법 조합
    skill_lifesteal: ['skill_mult', 'free_skill', 'mp_regen_turn', 'crit_mp_regen'],
    skill_mult: ['skill_lifesteal', 'free_skill', 'mp_regen_turn'],
    free_skill: ['skill_mult', 'skill_lifesteal', 'mp_regen_turn', 'crit_mp_regen'],
    mp_regen_turn: ['skill_mult', 'skill_lifesteal', 'free_skill', 'crit_mp_regen'],
    crit_mp_regen: ['skill_mult', 'free_skill', 'mp_regen_turn', 'ancient_power'],
    // 방어/생존 콤보
    reflect: ['fortress', 'stone_skin', 'crit_block'],
    fortress: ['reflect', 'stone_skin', 'battle_start_heal'],
    death_save: ['void_heart', 'low_hp_atk', 'battle_start_heal'],
    void_heart: ['death_save', 'low_hp_atk'],
    // DoT 콤보
    dot_mult: ['armor_pen', 'execute_bonus'],
    // 탐색/범용
    gold_mult: ['drop_rate', 'boss_hunter'],
    drop_rate: ['gold_mult', 'boss_hunter', 'exp_mult'],
    boss_hunter: ['drop_rate', 'execute_bonus', 'double_strike'],
};

// cycle 533: ownedRelics default [] 제거 — 1 internal callsite (line 153)
//   getRelicSynergyScore(relic, ownedRelics) 명시 전달이라 default 도달 불가.
//   util/component/hook default 청소 메가 시리즈 29번째 (cycle 502-532).
const getRelicSynergyScore = (newRelic: any, ownedRelics: any): any => {
    const ownedEffects = ownedRelics.map((r: any) => r.effect);
    const ownedNames = new Set(ownedRelics.map((r: any) => r.name));

    // 3피스 전설 시너지 확인 — 신규 유물이 마지막 피스인 경우
    const legendarySyn = RELIC_SYNERGIES.find((syn: any) =>
        syn.requires.length === 3 &&
        syn.requires.includes(newRelic.name) &&
        syn.requires.filter((name: any) => ownedNames.has(name)).length === 2
    );
    if (legendarySyn) {
        const synergyNames = legendarySyn.requires.filter((n: any) => ownedNames.has(n));
        return { score: 120, label: '전설 조합 완성', synergies: synergyNames, legendaryHint: legendarySyn.label };
    }

    // 3피스 시너지 1개 남음 힌트 — 신규 유물이 첫 번째 피스인 경우
    const nearLegendarySyn = RELIC_SYNERGIES.find((syn: any) =>
        syn.requires.length === 3 &&
        syn.requires.includes(newRelic.name) &&
        syn.requires.filter((name: any) => ownedNames.has(name)).length === 1
    );

    if (!ownedRelics.length) return nearLegendarySyn
        ? { score: 0, label: null, synergies: [], nearLegendary: nearLegendarySyn.label }
        : { score: 0, label: null, synergies: [] };

    const synergyEffects = SYNERGY_MAP[newRelic.effect] || [];
    const matches = ownedEffects.filter((e: any) => synergyEffects.includes(e));
    ownedEffects.forEach((e: any) => {
        if ((SYNERGY_MAP[e] || []).includes(newRelic.effect) && !matches.includes(e)) matches.push(e);
    });

    if (!matches.length) return nearLegendarySyn
        ? { score: 0, label: null, synergies: [], nearLegendary: nearLegendarySyn.label }
        : { score: 0, label: null, synergies: [] };

    const score = Math.min(100, matches.length * 40);
    const label = score >= 80 ? '강한 조합' : score >= 40 ? '좋은 조합' : '이어지는 조합';
    const synergyNames = ownedRelics.filter((r: any) => matches.includes(r.effect)).map((r: any) => r.name);
    return { score, label, synergies: synergyNames, nearLegendary: nearLegendarySyn?.label || null };
};

const RARITY_CARD: any = {
    common:    'border-white/10 bg-black/18 hover:border-white/16 hover:bg-white/[0.045]',
    uncommon:  'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 hover:border-[#7dd4d8]/28 hover:bg-[#7dd4d8]/14',
    rare:      'border-[#9a8ac0]/24 bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/32 hover:bg-[#9a8ac0]/14',
    epic:      'border-[#d5b180]/24 bg-[#d5b180]/10 hover:border-[#d5b180]/32 hover:bg-[#d5b180]/15',
    legendary: 'border-rose-300/22 bg-rose-400/10 hover:border-rose-300/30 hover:bg-rose-400/14',
};

const RARITY_LABEL: any = {
    common:    '일반',
    uncommon:  '고급',
    rare:      '희귀',
    epic:      '영웅',
    legendary: '전설',
};

const RARITY_BADGE_TONE: any = {
    common: 'neutral',
    uncommon: 'recommended',
    rare: 'resonance',
    epic: 'upgrade',
    legendary: 'danger',
};

/**
 * RelicChoicePanel — 유물 3지선다 선택 오버레이
 * `pendingRelics` 가 null 이 아닐 때 ControlPanel 위에 표시됨
 */
const RelicChoicePanel = ({ pendingRelics, dispatch, player }: RelicChoicePanelProps) => {
    if (!pendingRelics || pendingRelics.length === 0) return null;

    const ownedRelics = player?.relics || [];
    const relicCards = pendingRelics.map((relic: any, index: any) => ({
        relic,
        index,
        synergy: getRelicSynergyScore(relic, ownedRelics),
    }));
    const relicDecision = getRelicChoiceDecisionStrip(relicCards);

    const handleSelect = (relic: Relic) => {
        dispatch({ type: AT.ADD_RELIC, payload: relic });
    };

    const handleDecline = () => {
        dispatch({ type: AT.DECLINE_RELIC });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-[max(env(safe-area-inset-top),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
            <div className="aether-overlay" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />
            <div
                data-testid="relic-choice-panel"
                className="panel-noise aether-surface-strong relative mx-4 w-full max-w-3xl max-h-[90dvh] overflow-y-auto rounded-[2rem] p-4 shadow-[0_34px_90px_rgba(1,6,14,0.6)]"
            >
                <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 24%), radial-gradient(circle at top right, rgba(154,138,192,0.1), transparent 26%)' }} />

                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-[10px] font-readable text-slate-500">
                            유물 선택
                        </div>
                        <h2 className="mt-1 text-[1.1rem] font-readable font-bold text-[#f6e7c8]">
                            이번 모험에 어울리는 유물을 고르세요
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SignalBadge tone="spotlight" size="sm">하나 선택</SignalBadge>
                        <SignalBadge tone="neutral" size="sm">현재 {ownedRelics.length}개</SignalBadge>
                    </div>
                </div>

                <div
                    data-testid="relic-choice-decision-strip"
                    data-relic-tone={relicDecision.tone}
                    aria-label="유물 선택 추천 요약"
                    className="aether-relic-decision-strip mb-3 grid grid-cols-2 gap-1.5 rounded-[1rem] p-1.5"
                >
                    {relicDecision.cells.map((cell: any, index: number) => (
                        <div
                            key={cell.label}
                            className={`aether-relic-decision-cell rounded-lg px-2.5 py-2 ${index === 0 ? 'col-span-2' : ''}`}
                        >
                            <div className="text-[9px] font-readable text-slate-400/78">
                                {cell.label}
                            </div>
                            <div className="mt-0.5 text-[12px] font-readable font-semibold leading-snug text-[#f8ecd4]">
                                {cell.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2">
                    {relicCards.map(({ relic, index, synergy }: any) => {
                        const hasSynergy = synergy.score > 0;
                        const isLegendaryComplete = synergy.legendaryHint != null;
                        const hasNearLegendary = synergy.nearLegendary != null;
                        const isRecommended = relicDecision.recommendedIndex === index;
                        return (
                        <button
                            key={relic.id}
                            data-testid={`relic-choice-${index}`}
                            data-relic-recommended={isRecommended ? 'true' : 'false'}
                            onClick={() => handleSelect(relic)}
                            className={`
                                group flex flex-col rounded-[1.35rem] border p-3 text-left
                                transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0
                                ${RARITY_CARD[relic.rarity] || RARITY_CARD.common}
                                ${isRecommended ? 'aether-relic-card-recommended' : ''}
                                ${isLegendaryComplete ? 'shadow-[0_18px_40px_rgba(251,113,133,0.15)]' : hasSynergy ? 'shadow-[0_18px_34px_rgba(125,212,216,0.08)]' : 'shadow-[0_14px_26px_rgba(1,6,14,0.28)]'}
                            `}
                        >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                {isRecommended && (
                                    <SignalBadge tone="spotlight" size="sm">
                                        추천
                                    </SignalBadge>
                                )}
                                <SignalBadge tone={RARITY_BADGE_TONE[relic.rarity] || 'neutral'} size="sm">
                                    {RARITY_LABEL[relic.rarity] || relic.rarity}
                                </SignalBadge>
                                {isLegendaryComplete && (
                                    <SignalBadge tone="danger" size="sm">
                                        전설 조합 완성
                                    </SignalBadge>
                                )}
                                {!isLegendaryComplete && hasSynergy && (
                                    <SignalBadge tone={synergy.score >= 80 ? 'success' : 'recommended'} size="sm">
                                        {synergy.label}
                                    </SignalBadge>
                                )}
                                {!isLegendaryComplete && !hasSynergy && hasNearLegendary && (
                                    <SignalBadge tone="upgrade" size="sm">
                                        전설 조합에 가까움
                                    </SignalBadge>
                                )}
                            </div>

                            <div className={`mt-2 text-[1rem] font-readable font-bold leading-tight ${RARITY_COLORS[relic.rarity] || 'text-white'} group-hover:text-white`}>
                                {getRelicDisplayName(relic.name)}
                            </div>

                            <div className="mt-1.5 text-[11px] font-readable leading-relaxed text-slate-200/82">
                                {formatRelicText(relic.desc)}
                            </div>

                            <div className="mt-auto pt-2.5">
                                {isLegendaryComplete ? (
                                    <div className="rounded-[1rem] border border-rose-300/22 bg-rose-400/10 px-2.5 py-2 text-[10px] font-fira">
                                        <div className="tracking-normal text-rose-300/70">전설 조합</div>
                                        <div className="mt-0.5 font-bold text-rose-100">{synergy.legendaryHint}</div>
                                        <div className="mt-0.5 text-slate-300/72">{synergy.synergies.map(getRelicDisplayName).join(' · ')}</div>
                                    </div>
                                ) : hasSynergy ? (
                                    <div className="rounded-[1rem] border border-white/8 bg-black/20 px-2.5 py-2 text-[10px] font-fira text-slate-300/82">
                                        <div className="tracking-normal text-slate-500">잘 맞는 보유 유물</div>
                                        <div className="mt-0.5 leading-relaxed text-[#dff7f5]">
                                            {synergy.synergies.map(getRelicDisplayName).join(' · ')}
                                        </div>
                                        {hasNearLegendary && (
                                            <div className="mt-1 text-[#d5b180]/80">
                                                전설 조합 {synergy.nearLegendary}까지 유물 1개
                                            </div>
                                        )}
                                    </div>
                                ) : hasNearLegendary ? (
                                    <div className="rounded-[1rem] border border-[#d5b180]/22 bg-[#d5b180]/8 px-2.5 py-2 text-[10px] font-fira">
                                        <div className="tracking-normal text-[#d5b180]/60">전설 조합에 가까움</div>
                                        <div className="mt-0.5 text-[#f6e7c8]">
                                            {synergy.nearLegendary}까지 유물 1개 남음
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </button>
                    );})}
                </div>

                <div className="flex flex-col gap-2 border-t border-white/8 pt-3 text-center">
                    <button
                        data-testid="relic-choice-skip"
                        onClick={handleDecline}
                        className="min-h-[44px] rounded-full border border-white/8 bg-black/18 px-4 text-[10px] font-fira uppercase tracking-[0.18em] text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        이번에는 고르지 않기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RelicChoicePanel;
