import { useState, type Dispatch, type ReactNode } from 'react';
import { Check, Hammer, Tag } from 'lucide-react';
import { AT } from '../reducers/actionTypes';
import type { GameAction } from '../reducers/gameReducer';
import { RARITY_CLASSES } from '../data/constants';
import { MSG } from '../data/messages';
import { CHAPTER_PICK_SKIP_ID, getChapterPickOffer, getNextChapterPick, type ChapterPickCard } from '../utils/chapterPick';
import { getChapterBand } from '../utils/chapters';
import { formatRelicText, getRelicDisplayName } from '../utils/relicPresentation';
import { getRelicVisual } from '../utils/relicVisuals';
import { useOverlayDialog } from '../hooks/useOverlayDialog';
import RelicIcon from './icons/RelicIcon';
import ActionButton from './ui/ActionButton';
import ChoiceCard, { ChoiceCardLine } from './ui/ChoiceCard';
import Chip from './ui/Chip';
import type { Player } from '../types/index.js';

interface ChapterPickPanelProps {
    player: Player;
    dispatch: Dispatch<GameAction>;
}

/** 등급 칩의 바탕 — 유물 선택 화면과 같은 등급 토큰. */
const RARITY_CHIP_WASH: Readonly<Record<string, string>> = Object.freeze({
    common: 'bg-ae-rarity-common/10',
    uncommon: 'bg-ae-rarity-uncommon/10',
    rare: 'bg-ae-rarity-rare/12',
    epic: 'bg-ae-rarity-epic/12',
    legendary: 'bg-ae-rarity-legendary/14',
});

const GOLD_TONE = 'var(--aether-gold-rgb)';

const CardWell = ({ selected, children }: { selected: boolean; children: ReactNode }) => (
    <span className="ae-choice-card-well">
        {selected ? <Check size={18} strokeWidth={2.4} /> : children}
    </span>
);

const renderCardBody = (card: ChapterPickCard, selected: boolean) => {
    if (card.kind === 'relic') {
        const rarity = card.relic.rarity ?? 'common';
        return {
            icon: <RelicIcon relic={card.relic} size={48} />,
            toneRgb: getRelicVisual(card.relic, false).tone,
            head: (
                <>
                    <Chip tone="ether">{MSG.CHAPTER_PICK_HEAD_RELIC}</Chip>
                    <span className={`ae-chip ${RARITY_CLASSES[rarity] || ''} ${RARITY_CHIP_WASH[rarity] || ''}`}>
                        {MSG.RARITY_LABEL[rarity] || rarity}
                    </span>
                </>
            ),
            title: getRelicDisplayName(card.relic.name),
            titleClassName: RARITY_CLASSES[rarity] || 'text-ae-ink',
            effect: formatRelicText(card.relic.desc),
            lines: card.atCapacity ? (
                <ChoiceCardLine data-testid="chapter-pick-relic-full" className="text-ae-gold-text">
                    {MSG.CHAPTER_PICK_RELIC_FULL}
                </ChoiceCardLine>
            ) : null,
        };
    }
    const slotLabel = MSG.CHAPTER_PICK_SLOT_LABEL[card.slot];
    if (card.kind === 'prefix') {
        return {
            icon: <CardWell selected={selected}><Tag size={18} strokeWidth={2} /></CardWell>,
            toneRgb: GOLD_TONE,
            head: (
                <>
                    <Chip tone="gold">{MSG.CHAPTER_PICK_HEAD_PREFIX}</Chip>
                    <Chip>{slotLabel}</Chip>
                </>
            ),
            title: MSG.CHAPTER_PICK_PREFIX_TITLE(card.prefixName),
            titleClassName: 'text-ae-ink',
            effect: MSG.CHAPTER_PICK_PREFIX_EFFECT(slotLabel, card.itemName, card.prefixName),
            lines: (
                <ChoiceCardLine data-testid="chapter-pick-prefix-stat" className="text-ae-good">
                    {MSG.CHAPTER_PICK_PREFIX_STAT(card.stat, card.val, card.elem)}
                </ChoiceCardLine>
            ),
        };
    }
    return {
        icon: <CardWell selected={selected}><Hammer size={18} strokeWidth={2} /></CardWell>,
        toneRgb: GOLD_TONE,
        head: (
            <>
                <Chip tone="gold">{MSG.CHAPTER_PICK_HEAD_ENHANCE}</Chip>
                <Chip>{slotLabel}</Chip>
            </>
        ),
        title: MSG.CHAPTER_PICK_ENHANCE_TITLE(card.itemName, card.from, card.to),
        titleClassName: 'text-ae-ink',
        effect: MSG.CHAPTER_PICK_ENHANCE_EFFECT,
        lines: null,
    };
};

/**
 * ChapterPickPanel — 2026-11 H3 장 경계 3택(소유자 결정 Q2 · S2 · S3).
 *
 * 4 · 5 · 7장에 처음 들어선 뒤 대기 상태가 되면 GameRoot가 띄운다(새 `GS` 멤버 없음). 패 · 받을 권리 · 효과는
 * `utils/chapterPick.ts`가 판정하고 리듀서(`AT.CLAIM_CHAPTER_PICK`)가 검증한다 — 이 화면은 그리기와 고른 카드 전달만 한다.
 * 카드를 누르면 고르고(다시 누르면 다른 카드로 바꾼다), 금빛 단추 하나가 확정한다. 넘기기는 고스트이고 보상이 없다.
 * 고르거나 넘겨야 닫힌다(Escape로 닫지 않는다 — 유물 선택 화면과 같다).
 */
const ChapterPickPanel = ({ player, dispatch }: ChapterPickPanelProps) => {
    const chapter = getNextChapterPick(player);
    const offer = chapter != null ? getChapterPickOffer(player, chapter) : null;
    // 고른 카드는 장과 함께 기억한다 — 다음 장의 패가 이어서 뜨면 이전 선택이 남지 않는다.
    const [selection, setSelection] = useState<{ chapter: number; cardId: string } | null>(null);
    const dialog = useOverlayDialog({ label: MSG.CHAPTER_PICK_ARIA(chapter ?? 0) });
    if (chapter == null || !offer) return null;

    const selectedId = selection?.chapter === chapter
        && offer.cards.some((card) => card.id === selection.cardId)
        ? selection.cardId
        : null;
    const bandName = getChapterBand(chapter)?.name ?? '';

    const claim = (cardId: string) => {
        dispatch({ type: AT.CLAIM_CHAPTER_PICK, payload: { chapter, cardId } });
        setSelection(null);
    };

    return (
        <div {...dialog} className="fixed inset-0 z-50 flex items-end justify-center px-2 pt-[max(var(--aether-safe-area-top),0.5rem)] pb-[max(var(--aether-safe-area-bottom),0.5rem)] sm:items-center sm:px-4">
            <div className="ae-scrim" aria-hidden="true" />
            <div
                data-testid="chapter-pick-panel"
                data-chapter={chapter}
                className="ae-sheet relative mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden px-3.5 pb-3.5 pt-4 sm:px-5 sm:pb-5 lg:max-w-3xl"
            >
                <div className="mb-3 shrink-0">
                    <div className="ae-eyebrow">{MSG.CHAPTER_PICK_EYEBROW(chapter, bandName)}</div>
                    <h2 className="mt-1 aether-type-heading text-ae-ink">{MSG.CHAPTER_PICK_TITLE}</h2>
                    <p className="mt-1 aether-type-body font-readable text-ae-ink-2">{MSG.CHAPTER_PICK_BODY}</p>
                </div>

                <div data-testid="chapter-pick-options" className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {offer.cards.length === 0 ? (
                        <div data-testid="chapter-pick-empty" className="ae-well px-3 py-2.5 aether-type-body font-readable text-ae-ink-2">
                            {MSG.CHAPTER_PICK_EMPTY}
                        </div>
                    ) : (
                        <div className="grid gap-2 lg:grid-cols-3">
                            {offer.cards.map((card) => {
                                const selected = selectedId === card.id;
                                const body = renderCardBody(card, selected);
                                return (
                                    <ChoiceCard
                                        key={card.id}
                                        data-testid={`chapter-pick-card-${card.id}`}
                                        data-card-kind={card.kind}
                                        aria-pressed={selected}
                                        onClick={() => setSelection({ chapter, cardId: card.id })}
                                        stackOnDesktop
                                        emphasis={selected ? 'selected' : null}
                                        dimmed={selectedId !== null && !selected}
                                        icon={body.icon}
                                        toneRgb={body.toneRgb}
                                        head={body.head}
                                        title={body.title}
                                        titleClassName={body.titleClassName}
                                        effect={body.effect}
                                        lines={body.lines}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mt-3 grid shrink-0 gap-2">
                    {offer.cards.length > 0 && (
                        <ActionButton
                            variant="primary"
                            data-testid="chapter-pick-confirm"
                            disabled={selectedId === null}
                            onClick={() => { if (selectedId) claim(selectedId); }}
                            label={MSG.CHAPTER_PICK_CONFIRM}
                            className="w-full"
                        />
                    )}
                    <ActionButton
                        variant="ghost"
                        data-testid="chapter-pick-skip"
                        onClick={() => claim(CHAPTER_PICK_SKIP_ID)}
                        label={MSG.CHAPTER_PICK_SKIP}
                        className="w-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default ChapterPickPanel;
