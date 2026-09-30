import { useState, type Dispatch } from 'react';
import { ChevronRight } from 'lucide-react';
import { AT } from '../reducers/actionTypes';
import type { GameAction } from '../reducers/gameReducer';
import { RARITY_CLASSES } from '../data/constants';
import { MSG } from '../data/messages';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { getRelicChoiceDecisionStrip } from '../utils/relicChoiceDecision';
import { getRelicSynergyScore } from '../utils/relicSynergyHint';
import { getRunBuildProfile } from '../utils/runProfile';
import { formatRelicText, getRelicDisplayName } from '../utils/relicPresentation';
import RelicIcon from './icons/RelicIcon';
import SignalBadge from './SignalBadge';
import type { FullStats, Player, Relic } from '../types/index.js';

interface RelicChoicePanelProps {
    pendingRelics?: Relic[] | null;
    dispatch: Dispatch<GameAction>;
    player?: Player | null;
    stats?: FullStats | null;
}

const RARITY_CARD: Record<string, string> = {
    common:    'border-white/10 bg-black/18 hover:border-white/16 hover:bg-white/[0.045]',
    uncommon:  'border-[#7dd4d8]/22 bg-[#7dd4d8]/10 hover:border-[#7dd4d8]/28 hover:bg-[#7dd4d8]/14',
    rare:      'border-[#9a8ac0]/24 bg-[#9a8ac0]/10 hover:border-[#9a8ac0]/32 hover:bg-[#9a8ac0]/14',
    epic:      'border-[#d5b180]/24 bg-[#d5b180]/10 hover:border-[#d5b180]/32 hover:bg-[#d5b180]/15',
    legendary: 'border-rose-300/22 bg-rose-400/10 hover:border-rose-300/30 hover:bg-rose-400/14',
};

const RARITY_BADGE_TONE: Record<string, string> = {
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
const RelicChoicePanel = ({ pendingRelics, dispatch, player, stats }: RelicChoicePanelProps) => {
    // 2026-09 Wave 27 N2 (D3): 보유 상한에서 제안이 여러 개면 먼저 하나를 고른 뒤 교체 대상을 고른다.
    const [selectedReplacementId, setSelectedReplacementId] = useState<string | null>(null);
    if (!pendingRelics || pendingRelics.length === 0) return null;

    const ownedRelics = player?.relics || [];
    const relicCards = pendingRelics.map((relic, index) => ({
        relic,
        index,
        synergy: getRelicSynergyScore(relic, ownedRelics),
    }));
    const buildId = (stats?.buildProfile || getRunBuildProfile(player || {}, stats || {})).primary.id;
    const relicDecision = getRelicChoiceDecisionStrip(relicCards, buildId);
    const relicCapacity = getPrestigeUnlocks(player?.meta?.prestigeRank).maxRelics;
    // 2026-09 Wave 27 N2 (D3): 상한에서는 추가(ADD_RELIC)가 거부되므로 "보유 유물 하나와 교체"를
    //   준다 — 체인 완주 보상 · 심연 마일스톤 선택지가 상한에서 열려도 보상이 사라지지 않는다.
    //   상한 미만의 화면과 동작은 그대로다.
    const isAtCapacity = ownedRelics.length >= relicCapacity;
    const replacementRelic = !isAtCapacity
        ? null
        : pendingRelics.length === 1
            ? pendingRelics[0]
            : pendingRelics.find((relic) => relic.id === selectedReplacementId) || null;

    const handleSelect = (relic: Relic) => {
        if (isAtCapacity) {
            setSelectedReplacementId(relic.id ?? null);
            return;
        }
        dispatch({ type: AT.ADD_RELIC, payload: relic });
    };

    const handleReplace = (released: Relic) => {
        if (!replacementRelic?.id || !released.id) return;
        dispatch({
            type: AT.REPLACE_RELIC,
            payload: { relicId: replacementRelic.id, replaceRelicId: released.id },
        });
    };

    const handleDecline = () => {
        dispatch({ type: AT.DECLINE_RELIC });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)]">
            <div className="aether-overlay" />
            <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(213,177,128,0.12), transparent 30%), radial-gradient(circle at bottom right, rgba(125,212,216,0.08), transparent 24%)' }}
            />
            <div
                data-testid="relic-choice-panel"
                className="panel-noise aether-surface-strong relative mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] p-3 shadow-[0_34px_90px_rgba(1,6,14,0.6)]"
            >
                <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 24%), radial-gradient(circle at top right, rgba(154,138,192,0.1), transparent 26%)' }} />

                <div className="relative mb-2 flex shrink-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-[10px] font-readable text-slate-500">
                            유물 선택
                        </div>
                        <h2 className="mt-0.5 text-[1rem] font-readable font-bold text-[#f6e7c8]">
                            이번 모험의 힘을 고르세요
                        </h2>
                    </div>
                    <SignalBadge tone="neutral" size="sm">{ownedRelics.length}/{relicCapacity}</SignalBadge>
                </div>

                <div
                    data-testid="relic-choice-decision-strip"
                    data-relic-tone={relicDecision.tone}
                    aria-label="유물 선택 추천 요약"
                    className="aether-relic-decision-strip relative mb-2 grid shrink-0 grid-cols-3 gap-1 rounded-[1rem] p-1"
                >
                    {relicDecision.cells.map((cell) => (
                        <div
                            key={cell.label}
                            className="aether-relic-decision-cell min-h-[54px] rounded-lg px-2 py-1.5"
                        >
                            <div className="text-[9px] font-readable text-slate-400/78">
                                {cell.label}
                            </div>
                            <div className="mt-0.5 text-[11px] font-readable font-semibold leading-snug text-[#f8ecd4]">
                                {cell.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div data-testid="relic-choice-options" className="relative min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                    {isAtCapacity && (
                        <div
                            data-testid="relic-choice-capacity-notice"
                            className="rounded-[1rem] border border-[#d5b180]/24 bg-[#d5b180]/10 px-3 py-2 text-[11px] font-readable leading-snug text-[#f6e7c8]"
                        >
                            {MSG.RELIC_CHOICE_CAPACITY_FULL(ownedRelics.length, relicCapacity)}
                        </div>
                    )}
                    {relicCards.map(({ relic, index, synergy }) => {
                        const hasSynergy = synergy.score > 0;
                        const isLegendaryComplete = synergy.legendaryHint != null;
                        const completesPair = synergy.completesPair ?? null;
                        const hasNearLegendary = synergy.nearLegendary != null;
                        const isRecommended = relicDecision.recommendedIndex === index;
                        const rarity = relic.rarity ?? 'common';
                        return (
                        <button
                            key={relic.id}
                            data-testid={`relic-choice-${index}`}
                            data-relic-recommended={isRecommended ? 'true' : 'false'}
                            onClick={() => handleSelect(relic)}
                            aria-label={`${getRelicDisplayName(relic.name)} 선택`}
                            className={`
                                group grid min-h-[82px] w-full grid-cols-[50px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-[1rem] border p-2.5 text-left
                                transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0
                                ${RARITY_CARD[rarity] || RARITY_CARD.common}
                                ${isRecommended ? 'aether-relic-card-recommended' : ''}
                                ${isLegendaryComplete ? 'shadow-[0_18px_40px_rgba(251,113,133,0.15)]' : hasSynergy ? 'shadow-[0_18px_34px_rgba(125,212,216,0.08)]' : 'shadow-[0_14px_26px_rgba(1,6,14,0.28)]'}
                            `}
                        >
                            <RelicIcon relic={relic} size={50} completesLegendary={isLegendaryComplete} />

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1">
                                    {isRecommended && <SignalBadge tone="spotlight" size="sm">추천</SignalBadge>}
                                    <SignalBadge tone={RARITY_BADGE_TONE[rarity] || 'neutral'} size="sm">
                                        {MSG.RARITY_LABEL[rarity] || rarity}
                                    </SignalBadge>
                                    {isLegendaryComplete && <SignalBadge tone="danger" size="sm">전설 조합</SignalBadge>}
                                    {!isLegendaryComplete && completesPair && <SignalBadge tone="success" size="sm">{MSG.RELIC_PAIR_COMPLETE_BADGE}</SignalBadge>}
                                    {!isLegendaryComplete && !completesPair && hasSynergy && (
                                        <SignalBadge tone={synergy.score >= 80 ? 'success' : 'recommended'} size="sm">{synergy.label}</SignalBadge>
                                    )}
                                </div>
                                <div className={`mt-1 text-[13px] font-readable font-bold leading-tight ${RARITY_CLASSES[rarity] || 'text-white'} group-hover:text-white`}>
                                    {getRelicDisplayName(relic.name)}
                                </div>
                                <div className="mt-0.5 text-[11px] font-readable leading-snug text-slate-200/82">
                                    {formatRelicText(relic.desc)}
                                </div>
                                {isLegendaryComplete ? (
                                    <div className="mt-1 text-[10px] font-readable text-rose-100">{synergy.legendaryHint} 완성</div>
                                ) : completesPair ? (
                                    <div data-testid={`relic-choice-${index}-pair`} className="mt-1 text-[10px] font-readable text-[#dff7f5]">
                                        {MSG.RELIC_SYNERGY_COMPLETE_LINE(completesPair)}
                                    </div>
                                ) : hasSynergy ? (
                                    <div className="mt-1 truncate text-[10px] font-readable text-[#dff7f5]">
                                        함께 쓰기 · {synergy.synergies.map(getRelicDisplayName).join(' · ')}
                                    </div>
                                ) : hasNearLegendary ? (
                                    <div className="mt-1 text-[10px] font-readable text-[#f6e7c8]">{synergy.nearLegendary}까지 1개 남음</div>
                                ) : null}
                            </div>

                            <ChevronRight size={17} aria-hidden="true" className="text-slate-500 transition-colors group-hover:text-white" />
                        </button>
                    );})}
                    {replacementRelic && (
                        <div data-testid="relic-replace-options" className="space-y-1.5">
                            <div className="px-1 pt-1 text-[11px] font-readable font-semibold text-[#f6e7c8]">
                                {MSG.RELIC_REPLACE_PROMPT(getRelicDisplayName(replacementRelic.name))}
                            </div>
                            {ownedRelics.map((owned, index) => (
                                <button
                                    key={owned.id ?? index}
                                    data-testid={`relic-replace-${index}`}
                                    onClick={() => handleReplace(owned)}
                                    aria-label={MSG.RELIC_REPLACE_OPTION_LABEL(
                                        getRelicDisplayName(owned.name),
                                        getRelicDisplayName(replacementRelic.name),
                                    )}
                                    className="grid min-h-[56px] w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-2 rounded-[1rem] border border-white/10 bg-black/18 p-2 text-left transition-colors hover:border-rose-300/30 hover:bg-rose-400/10"
                                >
                                    <RelicIcon relic={owned} size={36} />
                                    <div className="min-w-0">
                                        <div className="text-[12px] font-readable font-bold leading-tight text-slate-100">
                                            {getRelicDisplayName(owned.name)}
                                        </div>
                                        <div className="mt-0.5 truncate text-[10px] font-readable text-slate-300/80">
                                            {formatRelicText(owned.desc)}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {pendingRelics.length > 1 && (
                                <button
                                    data-testid="relic-replace-back"
                                    onClick={() => setSelectedReplacementId(null)}
                                    className="min-h-[44px] w-full rounded-full border border-white/8 bg-black/18 px-4 text-[11px] font-readable text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                                >
                                    {MSG.RELIC_REPLACE_BACK}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="relative mt-2 shrink-0 border-t border-white/8 pt-2 text-center">
                    <button
                        data-testid="relic-choice-skip"
                        onClick={handleDecline}
                        className="min-h-[44px] w-full rounded-full border border-white/8 bg-black/18 px-4 text-[11px] font-readable text-slate-300/76 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                        이번에는 고르지 않기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RelicChoicePanel;
