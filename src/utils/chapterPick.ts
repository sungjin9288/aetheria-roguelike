import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import { RELICS, pickWeightedRelics } from '../data/relics.js';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks.js';
import type { Item, ItemPrefixDef, Player, Relic } from '../types/index.js';
import { readChapterProgress } from './chapterRecap.js';
import { getWeaponMagicSkills, isMagicWeapon } from './equipmentUtils.js';
import { applyItemPrefixByName, getItemPrefixCandidateNames } from './itemPrefixUtils.js';
import { readChapterPicks } from './runProgress.js';
import { createDomainRandom } from './seededRandom.js';

/**
 * 2026-11 H3 장 경계 3택 (소유자 결정 Q2 · S2 · S3, 실행 스케치 `docs/EXECUTION_SKETCH_H2_H3_2026-11.md` §3):
 * 이번 여정에서 4 · 5 · 7장(`BALANCE.CHAPTER_PICK_CHAPTERS`)에 처음 들어서면 '장의 선물' 카드 셋 중 하나를 받는다.
 *
 * - **받을 권리는 저장하지 않고 도출한다**: earned = 선물 장 ∩ {장 ≤ `chapters.reached`}, pending = earned − `chapterPicks`.
 *   장을 넘는 이동은 새 쓰기를 하지 않는다(장 결산의 쓰기 유일 · 바이트 동일 그대로). 3장에서 5장으로 건너뛰면 둘 다 받는다.
 * - **패는 여정 안에서 변하지 않는 값으로만 굴린다**: 씨앗은 장 · 여정 시작 시각(`currentRun.startedAt`) · 여정 시작 기준점(탐험 ·
 *   처치 수)이다. 시작 시각이 플레이어를 가른다 — 첫 여정의 기준점은 누구나 탐험 0 · 처치 0이라, 그 둘만 쓰던 동안 모든 플레이어의
 *   첫 여정이 같은 패였다(자연 플레이 120판 모두 4장 '불타는' 무기). 시작 시각은 여정을 만들 때 한 번 찍히고 저장되므로 리로드로
 *   다시 굴릴 수 없다. 장비를 씨앗에 넣지 않는다 — 장비를 벗었다 입어 패를 다시 굴릴 수 있게 된다. 탐험 난수(`actionRng`)를 쓰지 않는다.
 * - 화면(`ChapterPickPanel`)과 리듀서(`AT.CLAIM_CHAPTER_PICK`)가 같은 `getChapterPickOffer`를 읽는다.
 */
export type ChapterPickSlot = 'weapon' | 'armor';

export type ChapterPickCard =
    | { id: string; kind: 'relic'; relic: Relic; atCapacity: boolean }
    | {
        id: string; kind: 'prefix'; slot: ChapterPickSlot; itemName: string; prefixName: string;
        stat: 'atk' | 'def'; val: number; elem: string | null;
        /** 원소 접두어가 마법 무기가 아니던 무기에 새로 여는 무기 마법 기술의 이름(`getWeaponMagicSkills`). 없으면 null. */
        opensSkill: string | null;
    }
    | { id: string; kind: 'enhance'; slot: 'weapon'; itemName: string; from: number; to: number };

export interface ChapterPickOffer {
    chapter: number;
    cards: ChapterPickCard[];
}

export const CHAPTER_PICK_SKIP_ID = 'skip';

type PickSource = Pick<Player, 'stats'> & Partial<Pick<Player, 'equip' | 'relics' | 'meta'>>;

const PICK_CHAPTERS: readonly number[] = BALANCE.CHAPTER_PICK_CHAPTERS;
const RELIC_RARITIES: readonly string[] = BALANCE.CHAPTER_PICK_RELIC_RARITIES;

const toCount = (value: unknown): number => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0);

/** 이번 여정에서 들어선 가장 높은 장. 장 기록이 없으면(이전 세이브의 첫 이동 전) 0. */
const getReachedChapter = (player: PickSource | null | undefined): number => (
    readChapterProgress(player?.stats?.currentRun?.chapters)?.reached ?? 0
);

/** 이번 여정에서 받았거나 넘긴 장. */
export const getClaimedChapterPicks = (player: PickSource | null | undefined): number[] => (
    readChapterPicks(player?.stats?.currentRun?.chapterPicks)
);

/** 받을 차례가 남은 선물 장(오름차순). */
export const getPendingChapterPicks = (player: PickSource | null | undefined): number[] => {
    const reached = getReachedChapter(player);
    const claimed = new Set(getClaimedChapterPicks(player));
    return PICK_CHAPTERS.filter((chapter) => chapter <= reached && !claimed.has(chapter));
};

/** 지금 보일 장(가장 낮은 받을 장). 없으면 null. */
export const getNextChapterPick = (player: PickSource | null | undefined): number | null => (
    getPendingChapterPicks(player)[0] ?? null
);

/** 여정 안에서 변하지 않는 씨앗 재료 — 여정 시작 시각(없으면 0, 이전 세이브) · 여정 시작 때의 누적 탐험 · 처치 수. */
const getRunSeedParts = (player: PickSource): [number, number, number] => {
    const currentRun = player.stats?.currentRun;
    return [toCount(currentRun?.startedAt), toCount(currentRun?.countersAtStart?.explores), toCount(currentRun?.killsAtStart)];
};

const pickRng = (player: PickSource, chapter: number, ...kind: Array<string | number>) => (
    createDomainRandom(0, 'chapter-pick', chapter, ...getRunSeedParts(player), ...kind)
);

const drawRelics = (player: PickSource, chapter: number): { relics: Relic[]; atCapacity: boolean } => {
    const owned = player.relics || [];
    const atCapacity = owned.length >= getPrestigeUnlocks(player.meta?.prestigeRank).maxRelics;
    const pool = RELICS.filter((relic) => (
        RELIC_RARITIES.includes(relic.rarity ?? 'common') && !owned.some((ownedRelic) => ownedRelic.id === relic.id)
    ));
    const relics = pickWeightedRelics(pool, BALANCE.CHAPTER_PICK_RELIC_DRAWS, {
        owned,
        rng: pickRng(player, chapter, 'relic'),
        replacing: atCapacity ? owned : undefined,
    });
    return { relics, atCapacity };
};

const findPrefixDef = (name: string): ItemPrefixDef | null => (
    (Array.isArray(DB.ITEMS?.prefixes) ? DB.ITEMS.prefixes : []).find((prefix: ItemPrefixDef) => prefix.name === name) ?? null
);

/** 접두어를 붙인 뒤 새로 열리는 무기 마법 기술 — 무기 칸이고, 붙이기 전에는 마법 무기가 아니었고, 붙인 뒤에는 마법 무기일 때만. */
const getOpenedWeaponSkill = (slot: ChapterPickSlot, item: Item, prefixName: string): string | null => {
    if (slot !== 'weapon' || isMagicWeapon(item)) return null;
    const prefixed = applyItemPrefixByName(item, prefixName);
    if (!prefixed || !isMagicWeapon(prefixed)) return null;
    return getWeaponMagicSkills({ weapon: prefixed })[0]?.name ?? null;
};

const buildPrefixCard = (player: PickSource, chapter: number): ChapterPickCard | null => {
    const slots: ChapterPickSlot[] = ['weapon', 'armor'];
    for (const slot of slots) {
        const item = player.equip?.[slot] as Item | null | undefined;
        const names = getItemPrefixCandidateNames(item);
        if (!item || names.length === 0) continue;
        const prefixName = names[Math.floor(pickRng(player, chapter, 'prefix', slot)() * names.length)];
        const prefix = findPrefixDef(prefixName);
        if (!prefix) continue;
        return {
            id: 'prefix',
            kind: 'prefix',
            slot,
            itemName: item.name || '',
            prefixName,
            stat: slot === 'weapon' ? 'atk' : 'def',
            val: toCount(prefix.val),
            elem: prefix.elem && !item.elem ? prefix.elem : null,
            opensSkill: getOpenedWeaponSkill(slot, item, prefixName),
        };
    }
    return null;
};

const buildEnhanceCard = (player: PickSource): ChapterPickCard | null => {
    const weapon = player.equip?.weapon as Item | null | undefined;
    if (!weapon) return null;
    const from = toCount(weapon.enhance);
    const to = Math.min(BALANCE.ENHANCE_MAX, from + BALANCE.CHAPTER_PICK_ENHANCE_STEPS);
    if (to <= from) return null;
    return { id: 'enhance', kind: 'enhance', slot: 'weapon', itemName: weapon.name || '', from, to };
};

/**
 * 그 장의 패 — 유물 · 접두어 · 무료 강화. 접두어 · 강화 카드가 설 수 없으면(장비 없음 · 이미 접두어 · 이미 최대 강화)
 * 그 자리를 대체 유물로 채운다. 받을 권리가 없는 장이면 null.
 */
export const getChapterPickOffer = (player: PickSource | null | undefined, chapter: number): ChapterPickOffer | null => {
    if (!player || !getPendingChapterPicks(player).includes(chapter)) return null;
    const { relics, atCapacity } = drawRelics(player, chapter);
    const spare = relics.slice(1);
    const relicCard = (relic: Relic | undefined, id: string): ChapterPickCard | null => (
        relic ? { id, kind: 'relic', relic, atCapacity } : null
    );
    const cards = [
        relicCard(relics[0], 'relic'),
        buildPrefixCard(player, chapter) ?? relicCard(spare.shift(), 'relic-2'),
        buildEnhanceCard(player) ?? relicCard(spare.shift(), 'relic-3'),
    ].filter((card): card is ChapterPickCard => card !== null);
    return { chapter, cards };
};

const withChapterPick = (player: Player, chapter: number): Player => {
    const currentRun = player.stats?.currentRun;
    if (!currentRun) return player;
    return {
        ...player,
        stats: {
            ...player.stats,
            currentRun: { ...currentRun, chapterPicks: readChapterPicks([...getClaimedChapterPicks(player), chapter]) },
        },
    };
};

const withEquipSlot = (player: Player, slot: ChapterPickSlot, item: Item): Player => {
    const previous = player.equip?.[slot];
    return {
        ...player,
        equip: { ...(player.equip || {}), [slot]: item },
        // 강화 리듀서와 같이 같은 id의 가방 사본도 맞춘다(장착 사본만 바뀌면 둘이 갈라진다).
        inv: (player.inv || []).map((entry) => (previous?.id && entry.id === previous.id ? { ...entry, ...item } : entry)),
    };
};

export type ChapterPickResolution =
    | { kind: 'skip'; player: Player }
    | { kind: 'relic'; player: Player; relic: Relic; atCapacity: boolean }
    | { kind: 'prefix'; player: Player; itemName: string }
    | { kind: 'enhance'; player: Player; itemName: string; level: number };

/**
 * 카드 하나를 받는다(순수). 받을 권리가 없는 장 · 패 밖 카드면 null — 리듀서는 동일 참조를 돌려준다.
 * 유물 카드는 칸이 남으면 여기서 지급하고, 칸이 찼으면 기록만 하고 교체 화면(`pendingRelics`)은 리듀서가 연다.
 */
export const resolveChapterPick = (player: Player, chapter: number, cardId: string): ChapterPickResolution | null => {
    const offer = getChapterPickOffer(player, chapter);
    if (!offer) return null;
    const recorded = withChapterPick(player, chapter);
    if (cardId === CHAPTER_PICK_SKIP_ID) return { kind: 'skip', player: recorded };
    const card = offer.cards.find((entry) => entry.id === cardId);
    if (!card) return null;

    if (card.kind === 'relic') {
        if (card.atCapacity) return { kind: 'relic', player: recorded, relic: card.relic, atCapacity: true };
        return {
            kind: 'relic',
            relic: card.relic,
            atCapacity: false,
            player: {
                ...recorded,
                relics: [...(recorded.relics || []), card.relic],
                stats: { ...recorded.stats, relicCount: toCount(recorded.stats?.relicCount) + 1 },
            },
        };
    }
    const item = recorded.equip?.[card.slot] as Item | null | undefined;
    if (!item) return null;
    if (card.kind === 'prefix') {
        const prefixed = applyItemPrefixByName(item, card.prefixName);
        if (!prefixed) return null;
        return { kind: 'prefix', player: withEquipSlot(recorded, card.slot, prefixed), itemName: prefixed.name || '' };
    }
    return {
        kind: 'enhance',
        player: withEquipSlot(recorded, card.slot, { ...item, enhance: card.to }),
        itemName: item.name || '',
        level: card.to,
    };
};
