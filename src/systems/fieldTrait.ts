import { BALANCE } from '../data/constants';
import { createDomainRandom, type RandomSource } from '../utils/seededRandom';
import { isTrialPlayer } from '../utils/trialPlayer';
import { fieldDistances, toCoord } from './fieldMapGen';
import type { FieldChestSpot, FieldMapLayout, FieldMapState, FieldMapTrait } from '../types/fieldMap';
import type { GameMap } from '../types/map';
import type { Player } from '../types/player';

/**
 * 2026-11 지도 갈래(docs/PRE_PLAYTEST_FEATURES_2026-11.md §1) — 이번 여정에서 한 번 클리어한 지역에 새 지도를 열 때 성격 카드
 * 2 ~ 3장 중 하나를 고른다. 카드 · 배율은 이 모듈 하나가 소유하고 지도 생성 · 조우 문턱 · 정예 추첨 · 사건 문턱 · 상자 보상 · 화면이
 * 같이 읽는다. 난수를 새로 쓰지 않는다 — 패 · 더한 상자 자리는 지도 씨앗의 도메인 난수이고, 배율은 이미 있는 추첨의 문턱만 바꾼다.
 * 고른 성격은 지도 상태(`fieldMap.trait`)에 남고 지도와 함께 사라진다(런 범위). 고르지 않으면 `plain`이고 지금 지도와 같다.
 */

export interface FieldTraitEffects {
    /** 조우 문턱 배율 — 1보다 크면 조우가 뜸하다 */
    readonly encounterSteps: number;
    /** 상자 수 차이 */
    readonly chests: number;
    /** 일반 조우의 정예 추첨 문턱에 더하는 값 */
    readonly eliteChance: number;
    /** 사건 · 정찰 문턱 배율 */
    readonly events: number;
    /** 보통 상자(미믹 아님) 골드 배율 */
    readonly chestGold: number;
    /** 보통 상자 재료 문턱에 더하는 값 */
    readonly chestMaterial: number;
}

const EFFECTS: Readonly<Record<FieldMapTrait, FieldTraitEffects>> = BALANCE.FIELD_TRAIT_EFFECTS;

/** `plain`을 뺀 성격 — 패의 카드 순서이기도 하다. */
export const FIELD_OTHER_TRAITS: readonly Exclude<FieldMapTrait, 'plain'>[] = ['elite', 'chest', 'event', 'quiet'];
export const FIELD_TRAITS: readonly FieldMapTrait[] = ['plain', ...FIELD_OTHER_TRAITS];

export const isFieldMapTrait = (value: unknown): value is FieldMapTrait => (
    typeof value === 'string' && (FIELD_TRAITS as readonly string[]).includes(value)
);

/** 저장된 값 읽기 — 없거나 모르는 값이면 `plain` */
export const readFieldTrait = (field: Pick<FieldMapState, 'trait'> | null | undefined): FieldMapTrait => (
    isFieldMapTrait(field?.trait) ? field.trait : 'plain'
);

export const getFieldTraitEffects = (trait: FieldMapTrait): FieldTraitEffects => EFFECTS[trait];

/** 지금 걷는 지도의 성격 — 지금 지역의 지도일 때만(떠난 지역의 지도가 다른 지역에 남지 않는다) */
export const getActiveFieldTrait = (player: Partial<Pick<Player, 'fieldMap' | 'loc'>> | null | undefined): FieldMapTrait => {
    const field = player?.fieldMap;
    return field && field.loc === player?.loc ? readFieldTrait(field) : 'plain';
};

export const getActiveFieldTraitEffects = (player: Partial<Pick<Player, 'fieldMap' | 'loc'>> | null | undefined): FieldTraitEffects => (
    EFFECTS[getActiveFieldTrait(player)]
);

const mapLevel = (mapData: GameMap): number => {
    const numeric = Number(Array.isArray(mapData.level) ? mapData.level[0] : mapData.level);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

/**
 * 그 지역의 패에 나올 수 있는 성격인가 — `elite`는 초반 구간(`EARLY_ELITE_LEVEL_CAP` 이하, Wave 28 · 115)에 나오지 않고,
 * 모든 적이 이미 정예인 도전(`eliteOnly`)에서도 나오지 않는다(치르는 것이 없는 카드가 된다).
 */
const isTraitAvailable = (
    trait: FieldMapTrait,
    player: Pick<Player, 'challengeModifiers'>,
    mapData: GameMap,
): boolean => trait !== 'elite'
    || (mapLevel(mapData) > BALANCE.EARLY_ELITE_LEVEL_CAP && !player.challengeModifiers?.includes('eliteOnly'));

/** 이 지도의 패 — 보통 지도 1장 + 다른 성격 1 ~ 2장. 지도 씨앗에서 나오므로 다시 불러와도 같은 패다. */
export const getFieldTraitOffer = (
    player: Pick<Player, 'challengeModifiers'>,
    field: Pick<FieldMapState, 'loc' | 'seed'>,
    mapData: GameMap,
): FieldMapTrait[] => {
    const rng = createDomainRandom(field.seed, field.loc, 'map-trait');
    const span = BALANCE.FIELD_TRAIT_OTHERS_MAX - BALANCE.FIELD_TRAIT_OTHERS_MIN + 1;
    const count = BALANCE.FIELD_TRAIT_OTHERS_MIN + Math.floor(rng() * span);
    const pool: FieldMapTrait[] = FIELD_OTHER_TRAITS.filter((trait) => isTraitAvailable(trait, player, mapData));
    const picked = new Set<FieldMapTrait>();
    while (picked.size < count && pool.length > 0) picked.add(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    return FIELD_TRAITS.filter((trait) => trait === 'plain' || picked.has(trait));
};

/**
 * 지금 성격을 고를 수 있는가 — 이번 여정에서 클리어한 지역의 새 지도 입구에 서 있고 아직 고르지 않았을 때. 한 걸음이라도 걸었거나
 * 자동 탐험의 지도면 이미 보통 지도다. 오늘의 시련의 지도는 날짜가 정하므로 고르지 않는다.
 */
export const isFieldTraitChoiceOpen = (player: Pick<Player, 'loc' | 'fieldMap' | 'fieldClearedRegions' | 'trialRun'> | null | undefined): boolean => {
    const field = player?.fieldMap;
    return Boolean(
        field
        && !isTrialPlayer(player)
        && field.loc === player?.loc
        && (player?.fieldClearedRegions || []).includes(field.loc)
        && field.trait === undefined
        && !field.autoRun
        && !field.pending
        && field.visited.length === 1
        && field.visited[0] === field.pos
        && field.openedChests.length === 0,
    );
};

const traitLayouts = new WeakMap<FieldMapLayout, Map<FieldMapTrait, FieldMapLayout>>();

/** 성격이 더하는 상자 자리 — 입구에서 닿는 방 칸(풀숲 · 깊은 곳). 상자 사이 거리는 못 지키는 만큼만 줄인다(약속한 수를 지킨다). */
const placeExtraChests = (layout: FieldMapLayout, count: number, rng: RandomSource): FieldChestSpot[] => {
    const { tiles, width, entrance } = layout;
    const distance = fieldDistances(tiles, width, entrance);
    const taken = new Set([entrance, ...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
    const bag = [...tiles].flatMap((tile, index) => (
        (tile === ',' || tile === ';') && distance[index] > 0 && !taken.has(index) ? [index] : []
    ));
    for (let last = bag.length - 1; last > 0; last -= 1) {
        const swap = Math.floor(rng() * (last + 1));
        [bag[last], bag[swap]] = [bag[swap], bag[last]];
    }
    const placed = [...layout.chests];
    const isSpaced = (index: number, spacing: number) => placed.every((other) => {
        const a = toCoord(width, index);
        const b = toCoord(width, other.index);
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= spacing;
    });
    for (let spacing: number = BALANCE.FIELD_CHEST_MIN_SPACING; spacing >= 1; spacing -= 1) {
        for (const index of bag) {
            if (placed.length >= layout.chests.length + count) return placed;
            if (isSpaced(index, spacing)) placed.push({ id: placed.length, index });
        }
    }
    return placed;
};

/** 성격의 지도 — 벽 · 입구 · 출구는 보통 지도 그대로이고 상자 수만 다르다. 같은 지도 · 성격이면 같은 객체다. */
export const applyFieldTraitToLayout = (layout: FieldMapLayout, trait: FieldMapTrait): FieldMapLayout => {
    const delta = EFFECTS[trait].chests;
    if (delta === 0) return layout;
    const byTrait = traitLayouts.get(layout) ?? new Map<FieldMapTrait, FieldMapLayout>();
    const cached = byTrait.get(trait);
    if (cached) return cached;
    const chests = delta < 0
        ? layout.chests.slice(0, Math.max(1, layout.chests.length + delta))
        : placeExtraChests(layout, delta, createDomainRandom(layout.seed, layout.loc, 'trait-chest'));
    const result = { ...layout, chests };
    byTrait.set(trait, result);
    traitLayouts.set(layout, byTrait);
    return result;
};
