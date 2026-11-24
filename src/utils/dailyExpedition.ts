/**
 * 오늘의 원정지(2026-11 E6, 소유자 결정 2026-11-24 "날짜로 자동 선정").
 *
 * 하루마다 레벨 구간 하나에 사냥 지역 하나를 고르고, 그 지역에서 처치한 적의 골드 · 경험에
 * `BALANCE.DAILY_EXPEDITION_REWARD_MULT`를 곱한다(곱하는 곳은 `CombatEngine.handleVictory` 하나).
 *
 * - **날짜 키**는 오늘의 임무와 같은 기기 날짜(`getProtocolDayKey`)다. 서버 · 운영이 없다 — 오프라인 · 토스 빌드에서 같다.
 *   시계를 바꾸면 고른 지역만 바뀐다. 받을 보상(수령)이 아니라 작은 배율이라 받아들인다.
 * - **고르기는 해시다**(`deriveSeed`) — 게임 난수(`actionRng` · `Math.random`)를 쓰지 않는다. 같은 날 · 같은 구간은 언제나 같은 지역이다.
 * - **레벨 구간**(`DAILY_EXPEDITION_BAND_LEVELS`)마다 하나다. 레벨마다 고르면 레벨이 오를 때마다 지역이 바뀐다 —
 *   구간 안에서는 하루 내내 같고, 구간 경계를 넘을 때만 그 구간의 지역으로 옮겨 간다.
 * - **후보는 그 구간의 첫 레벨이 걸어 들어갈 수 있는 사냥 지역**이다(경로 게이트 ≤ 구간 첫 레벨, `utils/mapRouteGate.ts`).
 *   그래서 구간 안의 누구에게도 아직 못 들어가는 지역이 뽑히지 않는다. 그중 경로 게이트가 들어갈 수 있는 가장 높은
 *   경로 게이트에서 `DAILY_EXPEDITION_GATE_WINDOW` 안인 곳(그 레벨에 맞는 곳)이다.
 *   안전지대 · 계절 지역 · 혼돈의 심연(층이 레벨을 정한다) · 걸어서 못 가는 지역(고대 보물고)은 후보가 아니다.
 * - 후보가 `DAILY_EXPEDITION_MIN_CANDIDATES`보다 적은 구간(Lv1 ~ 5 — 고요한 숲뿐)에는 원정지가 없다. 늘 같은 지역이면 첫 구간의
 *   상시 경험 보너스가 되어 첫 1시간 속도(사람 측정 뒤 정하기로 한 것, 소유자 결정 D4)를 바꾼다.
 * - 놓쳐도 잃는 것이 없다 — 연속 기록 · 수령 · 세이브 상태가 없다.
 */
import { isTrialPlayer } from './trialPlayer.js';
import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import type { GameMap, Player } from '../types/index.js';
import { getMapRouteGate } from './mapRouteGate.js';
import { getProtocolDayKey } from './protocolCycle.js';
import { deriveSeed } from './seededRandom.js';

export interface DailyExpeditionCandidate {
    name: string;
    /** 시작의 마을에서 걸어 들어갈 수 있게 되는 최소 레벨(`getMapRouteGate().routeGateLevel`). */
    gate: number;
}

const SEED_DOMAIN = 'daily-expedition';

const codePointCompare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const isHuntingRegion = (map: GameMap | undefined): boolean => Boolean(
    map
    && map.type !== 'safe'
    && !map.seasonOnly
    && map.level !== 'infinite'
    && (map.monsters?.length ?? 0) > 0,
);

/** 오늘의 원정지가 될 수 있는 사냥 지역 전부 — 경로 게이트 · 이름 순서(결정론). */
export const getDailyExpeditionPool = (maps: Record<string, GameMap> = DB.MAPS): DailyExpeditionCandidate[] => (
    Object.keys(maps)
        .filter((name) => isHuntingRegion(maps[name]))
        .map((name) => ({ name, gate: getMapRouteGate(maps, name)?.routeGateLevel ?? null }))
        .filter((entry): entry is DailyExpeditionCandidate => typeof entry.gate === 'number' && Number.isFinite(entry.gate))
        .sort((left, right) => (left.gate - right.gate) || codePointCompare(left.name, right.name))
);

let defaultPool: DailyExpeditionCandidate[] | null = null;
const getDefaultPool = () => {
    if (!defaultPool) defaultPool = getDailyExpeditionPool(DB.MAPS);
    return defaultPool;
};

/** 레벨이 속한 구간(0부터). */
export const getDailyExpeditionBand = (level: number | undefined): number => {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    return Math.floor((safeLevel - 1) / BALANCE.DAILY_EXPEDITION_BAND_LEVELS);
};

/** 구간의 첫 레벨 — 후보는 이 레벨이 걸어 들어갈 수 있는 지역이다. */
export const getDailyExpeditionBandFloor = (band: number): number => (
    Math.max(0, Math.floor(band)) * BALANCE.DAILY_EXPEDITION_BAND_LEVELS + 1
);

/** 구간의 후보 지역. 풀이 비어 있지 않으면 언제나 하나 이상이다. */
export const getDailyExpeditionCandidates = (
    band: number,
    pool: DailyExpeditionCandidate[] = getDefaultPool(),
): DailyExpeditionCandidate[] => {
    if (pool.length === 0) return [];
    const floor = getDailyExpeditionBandFloor(band);
    const enterable = pool.filter((entry) => entry.gate <= floor);
    if (enterable.length === 0) return [];
    // 창의 위쪽 끝은 구간 첫 레벨이 아니라 들어갈 수 있는 가장 높은 경로 게이트다 — 구간 첫 레벨 바로 아래에 지역이 없는
    //   구간(Lv31 · 61 · 76 이후)에서도 창이 비지 않고, 가장 높은 지역 하나만 남지 않는다.
    const topGate = Math.max(...enterable.map((entry) => entry.gate));
    return enterable.filter((entry) => entry.gate >= topGate - BALANCE.DAILY_EXPEDITION_GATE_WINDOW);
};

/** 오늘(날짜 키) 이 레벨 구간의 원정지 이름 — 후보가 모자라면 null. */
export const getDailyExpeditionRegion = (
    level: number | undefined,
    date: Date | number,
    pool: DailyExpeditionCandidate[] = getDefaultPool(),
): string | null => {
    const at = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(at.getTime())) return null;
    const band = getDailyExpeditionBand(level);
    const candidates = getDailyExpeditionCandidates(band, pool);
    // 후보가 하나뿐인 구간(Lv1 ~ 5의 고요한 숲)은 고르지 않는다 — 날마다 같은 지역이면 '오늘의'가 아니라 상시 보너스다.
    if (candidates.length < BALANCE.DAILY_EXPEDITION_MIN_CANDIDATES) return null;
    const index = deriveSeed(0, SEED_DOMAIN, getProtocolDayKey(at), band) % candidates.length;
    return candidates[index].name;
};

/** 이 플레이어가 지금 위치에서 처치하면 받는 배율 — 오늘의 원정지면 `DAILY_EXPEDITION_REWARD_MULT`, 아니면 1. */
export const getDailyExpeditionRewardMult = (player: Pick<Player, 'loc' | 'level' | 'trialRun'> | null | undefined, now: number): number => {
    if (!player?.loc || isTrialPlayer(player)) return 1;
    return getDailyExpeditionRegion(player.level, now) === player.loc ? BALANCE.DAILY_EXPEDITION_REWARD_MULT : 1;
};

/** 화면에 쓰는 백분율(+20%). */
export const getDailyExpeditionBonusPct = (): number => Math.round((BALANCE.DAILY_EXPEDITION_REWARD_MULT - 1) * 100);
