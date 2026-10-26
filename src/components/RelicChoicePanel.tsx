import { useEffect, useState, type CSSProperties, type Dispatch } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link2, Sparkles } from 'lucide-react';
import { AT } from '../reducers/actionTypes';
import type { GameAction } from '../reducers/gameReducer';
import { RARITY_CLASSES } from '../data/constants';
import { MSG } from '../data/messages';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { getRelicChoiceDecisionStrip } from '../utils/relicChoiceDecision';
import { getRelicSynergyScore } from '../utils/relicSynergyHint';
import { getRunBuildProfile } from '../utils/runProfile';
import { formatRelicText, getRelicDisplayName } from '../utils/relicPresentation';
import { getRelicVisual } from '../utils/relicVisuals';
import RelicIcon from './icons/RelicIcon';
import ActionButton from './ui/ActionButton';
import Chip from './ui/Chip';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import type { FullStats, Player, Relic } from '../types/index.js';

interface RelicChoicePanelProps {
    pendingRelics?: Relic[] | null;
    dispatch: Dispatch<GameAction>;
    player?: Player | null;
    stats?: FullStats | null;
}

/**
 * 등급 칩의 바탕 — 등급 토큰만 고른다(글자색은 RARITY_CLASSES). 2026-10 에테르 유리(감사 VD-07): 전설은 산호색이고
 *   위험 · 장미색 표현을 쓰지 않는다.
 */
const RARITY_CHIP_WASH: Readonly<Record<string, string>> = Object.freeze({
    common: 'bg-ae-rarity-common/10',
    uncommon: 'bg-ae-rarity-uncommon/10',
    rare: 'bg-ae-rarity-rare/12',
    epic: 'bg-ae-rarity-epic/12',
    legendary: 'bg-ae-rarity-legendary/14',
});

/** 칸 표시 상한 — 표시만 줄인다(보유 수 · 상한 숫자는 그대로 보인다). */
const MAX_SLOT_PIPS = 8;

/**
 * 고른 카드가 확정되기 전 빛나는 시간 — 표시 연출 값(밸런스가 아니다). 2026-10 (감사 GF-08): 카드를 누르면 패널이 그대로
 *   사라져 무엇을 받았는지 보이는 순간이 없었다. 모션 감소 설정에서는 기다리지 않고 바로 받는다.
 */
const RELIC_CONFIRM_BEAT_MS = 200;

/**
 * RelicChoicePanel — 유물 3지선다 선택 오버레이
 * `pendingRelics` 가 null 이 아닐 때 ControlPanel 위에 표시됨
 *
 * 2026-10 에테르 유리: 막(`.ae-scrim`) 위의 시트(`.ae-sheet`) — 휴대폰에서는 아래에 붙고 넓은 화면에서는 가운데다.
 *   카드는 유리 표면(`.ae-card`), 추천 카드는 에테르 림, 유물 그림은 육각 메달이다. 카드를 누르면 받는다(확정 단추 없음 — UX-11).
 */
const RelicChoicePanel = ({ pendingRelics, dispatch, player, stats }: RelicChoicePanelProps) => {
    // 2026-10 (감사 GF-08): 확정 중인 카드 — 고른 그 제안 객체가 그대로일 때만 유효하다. 제안이 바뀌거나 패널이 내려가면
    //   타이머가 함께 지워져 지난 제안의 유물을 받지 않는다. 받는 유물은 지금 제안에서 다시 찾는다.
    const [confirming, setConfirming] = useState<{ id: string; offer: readonly Relic[] } | null>(null);
    const prefersReducedMotion = useReducedMotion() === true;
    useEffect(() => {
        if (!confirming || confirming.offer !== pendingRelics) return undefined;
        const relic = pendingRelics.find((candidate) => candidate.id === confirming.id);
        if (!relic) return undefined;
        const timer = window.setTimeout(() => {
            // 리듀서가 거부해 패널이 남아도 다시 고를 수 있게 확정 표시를 먼저 내린다.
            setConfirming(null);
            dispatch({ type: AT.ADD_RELIC, payload: relic });
        }, RELIC_CONFIRM_BEAT_MS);
        return () => window.clearTimeout(timer);
    }, [confirming, pendingRelics, dispatch]);
    // 2026-09 Wave 27 N2 (D3): 보유 상한에서 제안이 여러 개면 먼저 하나를 고른 뒤 교체 대상을 고른다.
    const [selectedReplacementId, setSelectedReplacementId] = useState<string | null>(null);
    // 감사 A11Y-01: 고르거나 넘겨야 닫히는 선택이라 Escape로 닫지 않는다.
    const dialog = useOverlayDialog({ label: MSG.RELIC_CHOICE_TITLE });
    if (!pendingRelics || pendingRelics.length === 0) return null;
    const confirmingId = confirming && confirming.offer === pendingRelics ? confirming.id : null;

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
    const slotPips = Array.from(
        { length: Math.min(Math.max(relicCapacity, ownedRelics.length), MAX_SLOT_PIPS) },
        (_, slot) => slot < ownedRelics.length,
    );

    const handleSelect = (relic: Relic) => {
        if (confirmingId) return;
        if (isAtCapacity) {
            setSelectedReplacementId(relic.id ?? null);
            return;
        }
        // 고른 카드가 짧게 빛난 뒤 받는다(확정 중 다른 카드 · 넘기기는 받지 않는다). 받는 판정은 그대로 리듀서(ADD_RELIC)다.
        if (prefersReducedMotion || !relic.id) {
            dispatch({ type: AT.ADD_RELIC, payload: relic });
            return;
        }
        setConfirming({ id: relic.id, offer: pendingRelics });
    };

    const handleReplace = (released: Relic) => {
        if (!replacementRelic?.id || !released.id) return;
        dispatch({
            type: AT.REPLACE_RELIC,
            payload: { relicId: replacementRelic.id, replaceRelicId: released.id },
        });
    };

    const handleDecline = () => {
        if (confirmingId) return;
        dispatch({ type: AT.DECLINE_RELIC });
    };

    return (
        <div {...dialog} className="fixed inset-0 z-50 flex items-end justify-center px-2 pt-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)] sm:items-center sm:px-4">
            <div className="ae-scrim" aria-hidden="true" />
            <div
                data-testid="relic-choice-panel"
                className="ae-sheet relative mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden px-3.5 pb-3.5 pt-4 sm:px-5 sm:pb-5 lg:max-w-3xl"
            >
                <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="ae-eyebrow">{MSG.RELIC_CHOICE_EYEBROW}</div>
                        <h2 className="mt-1 aether-type-heading text-ae-ink">
                            {MSG.RELIC_CHOICE_TITLE}
                        </h2>
                    </div>
                    <div data-testid="relic-choice-slots" className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            {slotPips.map((filled, slot) => (
                                <span key={slot} className={`ae-relic-slot-pip${filled ? ' is-filled' : ''}`} />
                            ))}
                        </div>
                        <div className="aether-type-meta font-fira font-semibold tabular-nums text-ae-ink-2">
                            <span className="sr-only">{MSG.RELIC_CHOICE_SLOTS_SR} </span>
                            {ownedRelics.length}/{relicCapacity}
                        </div>
                    </div>
                </div>

                <div
                    data-testid="relic-choice-decision-strip"
                    data-relic-tone={relicDecision.tone}
                    role="group"
                    aria-label="유물 선택 추천 요약"
                    className="ae-well ae-relic-decision mb-3 grid shrink-0 grid-cols-3"
                >
                    {relicDecision.cells.map((cell) => (
                        <div key={cell.label} className="ae-relic-decision-cell min-w-0 px-3 py-2.5">
                            <div className="ae-relic-decision-label aether-type-label font-bold">
                                {cell.label}
                            </div>
                            <div className="mt-0.5 aether-type-body font-bold text-ae-ink">
                                {cell.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div data-testid="relic-choice-options" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {isAtCapacity && (
                        <div
                            data-testid="relic-choice-capacity-notice"
                            className="ae-well mb-2 px-3 py-2.5 aether-type-meta font-semibold text-ae-gold-text"
                        >
                            {MSG.RELIC_CHOICE_CAPACITY_FULL(ownedRelics.length, relicCapacity)}
                        </div>
                    )}
                    <div className="grid gap-2 lg:grid-cols-3">
                        {relicCards.map(({ relic, index, synergy }) => {
                            const hasSynergy = synergy.score > 0;
                            const isLegendaryComplete = synergy.legendaryHint != null;
                            const completesPair = synergy.completesPair ?? null;
                            const hasNearLegendary = synergy.nearLegendary != null;
                            const startsCombo = synergy.startsCombo ?? null;
                            const isRecommended = relicDecision.recommendedIndex === index;
                            const isConfirming = confirmingId !== null && confirmingId === relic.id;
                            const isReplaceTarget = replacementRelic != null && replacementRelic.id === relic.id;
                            const rarity = relic.rarity ?? 'common';
                            const toneStyle = { '--ae-relic-tone': getRelicVisual(relic, isLegendaryComplete).tone } as CSSProperties;
                            return (
                                <button
                                    key={relic.id}
                                    type="button"
                                    data-testid={`relic-choice-${index}`}
                                    data-relic-recommended={isRecommended ? 'true' : 'false'}
                                    data-relic-confirming={isConfirming ? 'true' : undefined}
                                    data-relic-replace-target={isReplaceTarget ? 'true' : undefined}
                                    onClick={() => handleSelect(relic)}
                                    aria-label={MSG.RELIC_CHOICE_CARD_LABEL(getRelicDisplayName(relic.name))}
                                    aria-pressed={isAtCapacity && pendingRelics.length > 1 ? isReplaceTarget : undefined}
                                    style={toneStyle}
                                    className={`ae-card ae-relic-card grid min-h-[82px] w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-3 overflow-hidden p-3 text-left lg:grid-cols-1 lg:content-start lg:items-start lg:gap-2.5 lg:p-3.5${confirmingId && !isConfirming ? ' opacity-55' : ''}`}
                                >
                                    <RelicIcon relic={relic} size={56} completesLegendary={isLegendaryComplete} />

                                    <span className="block min-w-0">
                                        <span className="flex flex-wrap items-center gap-1">
                                            {isRecommended && (
                                                <Chip tone="ether" icon={<Sparkles size={12} strokeWidth={2.2} />}>
                                                    {MSG.RELIC_CHOICE_RECOMMENDED}
                                                </Chip>
                                            )}
                                            <span className={`ae-chip ${RARITY_CLASSES[rarity] || ''} ${RARITY_CHIP_WASH[rarity] || ''}`}>
                                                {MSG.RARITY_LABEL[rarity] || rarity}
                                            </span>
                                            {isLegendaryComplete && (
                                                <span className="ae-chip bg-ae-rarity-legendary/14 text-ae-rarity-legendary">
                                                    {MSG.RELIC_LEGENDARY_COMBO_BADGE}
                                                </span>
                                            )}
                                            {!isLegendaryComplete && completesPair && <Chip tone="good">{MSG.RELIC_PAIR_COMPLETE_BADGE}</Chip>}
                                            {!isLegendaryComplete && !completesPair && hasSynergy && <Chip>{synergy.label}</Chip>}
                                        </span>
                                        <span className={`mt-1.5 block aether-type-heading ${RARITY_CLASSES[rarity] || 'text-ae-ink'}`}>
                                            {getRelicDisplayName(relic.name)}
                                        </span>
                                        <span className="mt-0.5 block aether-type-body text-ae-ink-2">
                                            {formatRelicText(relic.desc)}
                                        </span>
                                        {isLegendaryComplete ? (
                                            <span className="ae-relic-card-line text-ae-rarity-legendary">
                                                <Sparkles size={13} aria-hidden="true" className="ae-relic-card-line-icon" />
                                                {MSG.RELIC_SYNERGY_COMPLETE_LINE(synergy.legendaryHint!)}
                                            </span>
                                        ) : completesPair ? (
                                            <span data-testid={`relic-choice-${index}-pair`} className="ae-relic-card-line text-ae-good">
                                                <Link2 size={13} aria-hidden="true" className="ae-relic-card-line-icon" />
                                                {MSG.RELIC_SYNERGY_COMPLETE_LINE(completesPair)}
                                            </span>
                                        ) : hasNearLegendary ? (
                                            <span className="ae-relic-card-line text-ae-gold-text">
                                                <Link2 size={13} aria-hidden="true" className="ae-relic-card-line-icon" />
                                                {MSG.RELIC_NEAR_LEGENDARY_LINE(synergy.nearLegendary!)}
                                            </span>
                                        ) : startsCombo ? (
                                            <span data-testid={`relic-choice-${index}-start`} className="ae-relic-card-line text-ae-ether-hi">
                                                <Link2 size={13} aria-hidden="true" className="ae-relic-card-line-icon" />
                                                {MSG.RELIC_COMBO_START_LINE(startsCombo)}
                                            </span>
                                        ) : hasSynergy ? (
                                            <span className="ae-relic-card-line text-ae-ink-2">
                                                <Link2 size={13} aria-hidden="true" className="ae-relic-card-line-icon text-ae-ether" />
                                                {MSG.RELIC_EFFECT_PAIR_LINE(synergy.synergies.map(getRelicDisplayName).join(' · '))}
                                            </span>
                                        ) : null}
                                        {(synergy.drawbacks?.length ?? 0) > 0 && (
                                            <span data-testid={`relic-choice-${index}-drawback`} className="ae-relic-card-line text-ae-threat">
                                                {MSG.RELIC_SYNERGY_DRAWBACK_LINE(synergy.drawbacks!.join(' · '))}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    {replacementRelic && (
                        <div data-testid="relic-replace-options" className="mt-3 space-y-2">
                            <div className="px-1 aether-type-meta font-bold text-ae-gold-text">
                                {MSG.RELIC_REPLACE_PROMPT(getRelicDisplayName(replacementRelic.name))}
                            </div>
                            {ownedRelics.map((owned, index) => (
                                <button
                                    key={owned.id ?? index}
                                    type="button"
                                    data-testid={`relic-replace-${index}`}
                                    onClick={() => handleReplace(owned)}
                                    aria-label={MSG.RELIC_REPLACE_OPTION_LABEL(
                                        getRelicDisplayName(owned.name),
                                        getRelicDisplayName(replacementRelic.name),
                                    )}
                                    className="ae-well ae-relic-replace grid min-h-[56px] w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 px-2.5 py-2 text-left"
                                >
                                    <RelicIcon relic={owned} size={40} />
                                    <span className="block min-w-0">
                                        <span className="block aether-type-body font-bold text-ae-ink">
                                            {getRelicDisplayName(owned.name)}
                                        </span>
                                        <span className="mt-0.5 block aether-type-meta text-ae-ink-2">
                                            {formatRelicText(owned.desc)}
                                        </span>
                                    </span>
                                </button>
                            ))}
                            {pendingRelics.length > 1 && (
                                <ActionButton
                                    variant="ghost"
                                    data-testid="relic-replace-back"
                                    onClick={() => setSelectedReplacementId(null)}
                                    label={MSG.RELIC_REPLACE_BACK}
                                    className="w-full"
                                />
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-3 shrink-0">
                    <ActionButton
                        variant="ghost"
                        data-testid="relic-choice-skip"
                        onClick={handleDecline}
                        label={MSG.RELIC_CHOICE_SKIP}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default RelicChoicePanel;
