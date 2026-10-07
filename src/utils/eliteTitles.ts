import { BALANCE } from '../data/constants';
import { MAPS } from '../data/maps';
import { MSG } from '../data/messages';
import { getMetaBonusRamp } from '../systems/metaBonusRamp';
import { formatPermanentStatBonus } from './permanentStatSources';
import type { Monster } from '../types/monster';
import type { Player } from '../types/player';

/**
 * 정예 목격 칭호 (2026-10 Wave 72, 소유자 결정 "정예를 조우했다는 칭호 — 지역별 47개 · 모은 만큼 합산").
 *
 * 사냥 지역(조우 몬스터가 있는 지역)마다 칭호 하나다. 그 지역에서 정예(`isElite` — 재앙의 · 고대 · 초반 정예 · 다른 차원의 망령)를
 * 처음 **만나면** 얻는다 — 이기든 도망치든 쓰러지든 같다. 칭호는 `player.titles`에 들어가 사망 · 계승을 넘어 남고(영구 상태 선별),
 * 효과는 장착과 상관없이 모은 만큼 더해진다(`sumEliteTitleBonus` → `calculateFullStats`). 장착한 칭호의 패시브(`getTitlePassive`)는
 * 이 칭호에 없다 — 장착해도 두 번 더해지지 않는다. 다른 영구 능력치처럼 `META_BONUS_FULL_LEVEL`까지 레벨에 비례한다
 * (Wave 40 — 계승 런이 Lv1부터 전부 받던 동안 초반 사망이 사라졌다).
 */

export const ELITE_TITLE_PREFIX = 'elite:';

export interface EliteTitleBonus {
    atk: number;
    def: number;
    hp: number;
    mp: number;
}

/** 칭호가 있는 사냥 지역 — 데이터 순서 그대로. */
export const ELITE_TITLE_MAPS: readonly string[] = Object.freeze(
    Object.entries(MAPS)
        .filter(([, map]) => (map.monsters || []).length > 0)
        .map(([name]) => name),
);

const ELITE_TITLE_MAP_SET = new Set(ELITE_TITLE_MAPS);

export const getEliteTitleId = (mapName: string): string => `${ELITE_TITLE_PREFIX}${mapName}`;

/** 칭호 id가 가리키는 지역 — 정예 목격 칭호가 아니면 null. */
export const getEliteTitleMap = (titleId: unknown): string | null => {
    if (typeof titleId !== 'string' || !titleId.startsWith(ELITE_TITLE_PREFIX)) return null;
    const mapName = titleId.slice(ELITE_TITLE_PREFIX.length);
    return ELITE_TITLE_MAP_SET.has(mapName) ? mapName : null;
};

export const isEliteTitleId = (titleId: unknown): boolean => getEliteTitleMap(titleId) !== null;

/** 단계를 고를 지역 레벨 — 숫자 그대로, "5,15"(계절)는 앞 숫자, 심연(`infinite`) · 읽을 수 없는 값은 가장 높은 단계. */
const getBandLevel = (mapName: string): number => {
    const level = MAPS[mapName]?.level;
    if (typeof level === 'number' && Number.isFinite(level)) return level;
    const parsed = Number.parseInt(String(level ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

export const getEliteTitleBonus = (mapName: string): EliteTitleBonus => {
    const level = getBandLevel(mapName);
    const band = [...BALANCE.ELITE_TITLE_BONUS_BANDS]
        .filter((entry) => level >= entry.minLevel)
        .pop() ?? BALANCE.ELITE_TITLE_BONUS_BANDS[0];
    return { atk: band.atk, def: band.def, hp: band.hp, mp: band.mp };
};

const ownedEliteTitleMaps = (titles: readonly string[] | null | undefined): string[] => (
    [...new Set((titles || []).map(getEliteTitleMap).filter((mapName): mapName is string => mapName !== null))]
);

/** 모은 정예 목격 칭호의 효과 합(레벨 비례 전) — 같은 칭호가 두 번 있어도 한 번이다. */
export const sumEliteTitleBonus = (titles: readonly string[] | null | undefined): EliteTitleBonus & { count: number } => {
    const maps = ownedEliteTitleMaps(titles);
    const total = maps.reduce<EliteTitleBonus>((sum, mapName) => {
        const bonus = getEliteTitleBonus(mapName);
        return { atk: sum.atk + bonus.atk, def: sum.def + bonus.def, hp: sum.hp + bonus.hp, mp: sum.mp + bonus.mp };
    }, { atk: 0, def: 0, hp: 0, mp: 0 });
    return { ...total, count: maps.length };
};

/** 전투 능력치에 더할 정예 목격 칭호 효과 — 레벨 비례(`getMetaBonusRamp`)를 거친 값. */
export const getRampedEliteTitleBonus = (player: Pick<Player, 'titles' | 'level'>): EliteTitleBonus => {
    const total = sumEliteTitleBonus(player.titles);
    const ramp = getMetaBonusRamp(player.level);
    return {
        atk: Math.floor(total.atk * ramp),
        def: Math.floor(total.def * ramp),
        hp: Math.floor(total.hp * ramp),
        mp: Math.floor(total.mp * ramp),
    };
};

export const getEliteTitleName = (titleId: unknown): string | null => {
    const mapName = getEliteTitleMap(titleId);
    return mapName ? MSG.ELITE_TITLE_NAME(mapName) : null;
};

export const getEliteTitlePassiveLabel = (titleId: unknown): string | null => {
    const mapName = getEliteTitleMap(titleId);
    return mapName ? MSG.ELITE_TITLE_PASSIVE(formatPermanentStatBonus(getEliteTitleBonus(mapName))) : null;
};

/**
 * 적이 나타난 순간의 기록 — 정예이고 지금 지역에 칭호가 있고 아직 없으면 칭호를 더한다. 장착 칭호는 바꾸지 않는다
 * (이 칭호에는 장착 패시브가 없어, 자동 장착하면 다음에 얻는 일반 칭호의 패시브를 가린다). 같은 지역은 한 번뿐이다.
 */
export const recordEliteEncounter = (
    player: Player,
    enemy: Pick<Monster, 'isElite'> | null | undefined,
): { player: Player; unlockedMap: string | null } => {
    if (!enemy?.isElite) return { player, unlockedMap: null };
    const mapName = player.loc;
    if (!mapName || !ELITE_TITLE_MAP_SET.has(mapName)) return { player, unlockedMap: null };
    const titleId = getEliteTitleId(mapName);
    const titles = player.titles || [];
    if (titles.includes(titleId)) return { player, unlockedMap: null };
    return { player: { ...player, titles: [...titles, titleId] }, unlockedMap: mapName };
};

/** 칭호 목록을 일반 칭호와 정예 목격 칭호로 나눈다 — 칭호 바꾸기 목록이 47개로 길어지지 않게 정예 칭호는 묶어서 보인다. */
export const splitEliteTitles = (titles: readonly string[] | null | undefined): { regular: string[]; elite: string[] } => {
    const regular: string[] = [];
    const elite: string[] = [];
    for (const id of titles || []) (isEliteTitleId(id) ? elite : regular).push(id);
    return { regular, elite };
};
