import { BALANCE, CONSTANTS } from '../data/constants.js';
import {
    DAILY_TRIAL_EXCLUDED_RELIC_EFFECTS,
    DAILY_TRIAL_JOB_LEVEL_OFFSET,
    DAILY_TRIAL_REGIONS,
    type DailyTrialRegion,
} from '../data/dailyTrial.js';
import { DB } from '../data/db.js';
import { RELICS } from '../data/relics.js';
import { buildClassVitals } from '../hooks/gameActions/_shared.js';
import type { DailyTrialDay, DailyTrialLedger, DailyTrialRecord, DailyTrialResult, DailyTrialRun } from '../types/dailyTrial.js';
import type { FieldMapState } from '../types/fieldMap.js';
import type { Item, Player, Relic } from '../types/index.js';
import { getAreaBossName } from '../utils/bossGauge.js';
import { createCurrentRunProgress } from '../utils/runProgress.js';
import { isShield, isTwoHandWeapon, isWeapon } from '../utils/equipmentUtils.js';
import { findItemByName, makeItem } from '../utils/gameUtils.js';
import { createDomainRandom, deriveSeed, type RandomSource } from '../utils/seededRandom.js';
import { calculateFullStats } from '../utils/statsCalculator.js';
import { getJobGearPool, getUsableGearTier } from '../utils/wanderingMerchant.js';
import { CombatEngine } from './CombatEngine.js';
import { generateFieldMap } from './fieldMapGen.js';

/**
 * 2026-11 오늘의 시련 — 같은 날 누구나 같은 직업 · 레벨 · 장비 · 유물 · 지역 · 지도로 시작하는 짧은 판(명세 §3).
 *
 * - 조건은 모두 날짜 키(`getProtocolDayKey`)의 해시다 — `deriveSeed(0, 'daily-trial', 날짜 키, …)`. 게임 난수를 쓰지 않으므로
 *   오프라인 · 토스 빌드에서 같은 날은 같은 시련이고, 본편의 난수열을 밀지 않는다. 전투 주사위는 본편과 같은 행동 난수다.
 * - 이 파일은 순수하다 — 본편 상태의 보관 · 복원 · 격리는 `reducers/dailyTrial.ts`가 소유한다.
 */

const SEED_DOMAIN = 'daily-trial';

/** 시련 지도의 출구 — 지역 이름이 아니라 '다음 지도'의 표시다(화면에 그리지 않는다). */
const DAILY_TRIAL_EXIT = 'daily-trial-next';

const trialSeed = (dayKey: string, ...domains: Array<string | number>) => deriveSeed(0, SEED_DOMAIN, dayKey, ...domains);
const trialRandom = (dayKey: string, ...domains: Array<string | number>) => createDomainRandom(0, SEED_DOMAIN, dayKey, ...domains);

/**
 * 해시를 한 번 더 섞은 뒤 자리를 고른다 — FNV의 나머지는 같은 길이의 날짜 키에서 아래 비트가 치우친다.
 */
const pickIndex = (length: number, dayKey: string, ...domains: Array<string | number>): number => (
    length > 0 ? Math.floor(trialRandom(dayKey, ...domains)() * length) : 0
);

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const isDailyTrialDayKey = (value: unknown): value is string => typeof value === 'string' && DAY_KEY_PATTERN.test(value);

/** 첫 전직 뒤에 열린다 — 그 전에는 입구가 보이지 않는다. */
export const isDailyTrialUnlocked = (player: Pick<Player, 'job'> | null | undefined): boolean => (
    Boolean(player?.job) && player!.job !== CONSTANTS.DEFAULT_JOB
);

/** 시련의 직업 후보 — 1 · 2차 직업 가운데 그 레벨에서 더 전직할 곳이 없는 직업(이름 순서). */
export const getDailyTrialJobs = (level: number): string[] => Object.entries(DB.CLASSES)
    .filter(([, job]) => (job.tier === 1 || job.tier === 2) && (job.reqLv || 1) <= level
        && !(job.next || []).some((next) => (DB.CLASSES[next]?.tier ?? 9) <= 2 && (DB.CLASSES[next]?.reqLv || 1) <= level))
    .map(([name]) => name)
    .sort((left, right) => (left < right ? -1 : 1));

export interface DailyTrialPlan {
    dayKey: string;
    region: string;
    bossName: string;
    job: string;
    level: number;
    start: DailyTrialRegion;
    relicIds: string[];
    mapSeeds: number[];
}

const pickRelics = (dayKey: string): Relic[] => {
    const pool = RELICS.filter((relic) => relic.rarity !== 'legendary' && !DAILY_TRIAL_EXCLUDED_RELIC_EFFECTS.has(relic.effect));
    const rng = trialRandom(dayKey, 'relics');
    const picked: Relic[] = [];
    const bag = [...pool];
    while (picked.length < BALANCE.DAILY_TRIAL_RELICS && bag.length > 0) {
        picked.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
    }
    return picked;
};

/** 그날의 조건 — 같은 날짜 키는 언제나 같은 조건이다. */
export const getDailyTrialPlan = (dayKey: string): DailyTrialPlan => {
    const start = DAILY_TRIAL_REGIONS[pickIndex(DAILY_TRIAL_REGIONS.length, dayKey, 'region')];
    const jobs = getDailyTrialJobs(start.level);
    const job = jobs[pickIndex(jobs.length, dayKey, 'job')];
    return {
        dayKey,
        region: start.region,
        bossName: getAreaBossName(DB.MAPS[start.region]) ?? '',
        job,
        level: start.level + (DAILY_TRIAL_JOB_LEVEL_OFFSET[job] ?? 0),
        start,
        relicIds: pickRelics(dayKey).flatMap((relic) => (relic.id ? [relic.id] : [])),
        mapSeeds: Array.from({ length: BALANCE.DAILY_TRIAL_MAPS }, (_, index) => trialSeed(dayKey, 'map', index + 1)),
    };
};

/** 시련의 n번째 지도(1부터) — 마지막 지도에는 출구가 없다(보스 문이 끝이다). 지도마다 순번 · 씨앗이 다르다. */
export const createDailyTrialField = (dayKey: string, mapNumber: number): FieldMapState => {
    const plan = getDailyTrialPlan(dayKey);
    const isLast = mapNumber >= BALANCE.DAILY_TRIAL_MAPS;
    const mapPlan = { exits: isLast ? [] : [DAILY_TRIAL_EXIT], level: BALANCE.DAILY_TRIAL_MAP_LEVEL };
    const seed = plan.mapSeeds[mapNumber - 1];
    const layout = generateFieldMap(plan.region, seed, mapPlan.level, mapPlan.exits);
    return {
        loc: plan.region,
        seq: mapNumber,
        seed,
        pos: layout.entrance,
        visited: [layout.entrance],
        openedChests: [],
        danger: 0,
        pending: null,
        autoRun: false,
        plan: mapPlan,
    };
};

/** 출구를 밟으면 다음 지도 — 리듀서(`fieldStep`)가 부른다. */
export const advanceDailyTrialMap = (player: Player): Player => {
    const run = player.trialRun;
    if (!run || run.map >= BALANCE.DAILY_TRIAL_MAPS) return player;
    const map = run.map + 1;
    return { ...player, trialRun: { ...run, map }, fieldMap: createDailyTrialField(run.dayKey, map) };
};

const byScore = (left: Item, right: Item) => (Number(right.val) || 0) - (Number(left.val) || 0)
    || (String(left.name) < String(right.name) ? -1 : 1);

/** 그 등급에 쓸 장비가 없는 직업은 한 등급씩 내려 찾는다(성직자 · 무당은 4등급 상점 장비가 없다). */
const pickGear = (job: string, tier: number, accepts: (item: Item) => boolean, rng: RandomSource): Item | null => {
    for (let current = tier; current >= 1; current -= 1) {
        const pool = getJobGearPool(job, current).filter(accepts).sort(byScore);
        if (pool.length > 0) return makeItem(pool[Math.floor(rng() * pool.length)], rng, () => 0);
    }
    return null;
};

const buildGear = (plan: DailyTrialPlan): NonNullable<Player['equip']> => {
    const rng = trialRandom(plan.dayKey, 'gear');
    const tier = getUsableGearTier(plan.level);
    const enhanced = (item: Item | null): Item | null => (item && plan.start.enhance > 0 ? { ...item, enhance: plan.start.enhance } : item);
    const weapon = pickGear(plan.job, Math.max(1, tier - plan.start.weaponTierDown), isWeapon, rng);
    const armor = pickGear(plan.job, tier, (item) => item.type === 'armor', rng);
    const offhand = weapon && isTwoHandWeapon(weapon) ? null : pickGear(plan.job, tier, isShield, rng);
    return { weapon: enhanced(weapon), armor: enhanced(armor), offhand: enhanced(offhand) };
};

/** 지금 생명 · 기력을 실제로 채우는 물약 — 회복량이 최대치의 절반을 넘지 않는 가장 큰 것, 없으면 가장 작은 것. */
const pickPotion = (type: 'hp' | 'mp', max: number): Item | null => {
    const potions = DB.ITEMS.consumables
        .filter((item) => item.type === type && (Number(item.val) || 0) < 1000)
        .sort((left, right) => (Number(left.val) || 0) - (Number(right.val) || 0));
    const fitting = potions.filter((item) => (Number(item.val) || 0) <= max * 0.5);
    return findItemByName((fitting.at(-1) ?? potions[0])?.name) ?? null;
};

const buildBag = (plan: DailyTrialPlan, maxHp: number, maxMp: number): Item[] => {
    const rng = trialRandom(plan.dayKey, 'bag');
    const fill = (item: Item | null, count: number) => (item ? Array.from({ length: count }, () => makeItem(item, rng, () => 0)) : []);
    return [
        ...fill(pickPotion('hp', maxHp), plan.start.hpPotions),
        ...fill(pickPotion('mp', maxMp), plan.start.mpPotions),
    ];
};

/** 레벨 1부터 실제 레벨업 규칙으로 올린다 — 공격력 · 방어력 · 경험 요구량이 본편 성장과 같다. */
const raiseToLevel = (player: Player, level: number): Player => {
    let current = player;
    while ((current.level || 1) < level) {
        const needed = Math.max(1, (current.nextExp || 1) - (current.exp || 0));
        const next = CombatEngine.applyExpGain(current, needed).updatedPlayer;
        if ((next.level || 1) <= (current.level || 1)) break;
        current = next;
    }
    return current;
};

const clone = <T>(value: T): T => structuredClone(value);

/**
 * 시련의 시작 플레이어. 본편에서 가져오는 것은 이름 · 성별 · 설정뿐이고 나머지는 날짜 키가 정한다 — 같은 날 누구나 같은 조건이다.
 */
export const buildDailyTrialPlayer = (
    initialPlayer: Player,
    owner: Pick<Player, 'name' | 'gender' | 'settings'>,
    dayKey: string,
): Player => {
    const plan = getDailyTrialPlan(dayKey);
    const base = clone(initialPlayer);
    const visitedMaps = [CONSTANTS.START_LOCATION, plan.region];
    const grown = raiseToLevel({ ...base, inv: [], relics: [] }, plan.level);
    const vitals = buildClassVitals(plan.level, plan.job, base.meta || {});
    const ready: Player = {
        ...grown,
        name: owner.name,
        gender: owner.gender,
        settings: clone(owner.settings ?? base.settings),
        job: plan.job,
        exp: 0,
        gold: 0,
        loc: plan.region,
        maxHp: vitals.maxHp,
        maxMp: vitals.maxMp,
        metaVitalsSnapshot: vitals.metaVitalsSnapshot,
        relics: plan.relicIds.flatMap((id) => RELICS.filter((relic) => relic.id === id).map((relic) => ({ ...relic }))),
        inv: [],
        equip: buildGear(plan),
        quests: [],
        expeditionFocusQuestIds: [],
        firstVisitRewardMaps: [plan.region],
        fieldMap: createDailyTrialField(dayKey, 1),
        fieldClearedRegions: [],
        trialRun: { dayKey, map: 1 },
        stats: {
            ...base.stats,
            visitedMaps,
            currentRun: createCurrentRunProgress({ visitedMaps }, { startedAt: null, essenceLifetime: 0 }),
        },
    };
    const full = calculateFullStats(ready)!;
    return { ...ready, hp: full.maxHp, mp: full.maxMp, inv: buildBag(plan, full.maxHp, full.maxMp) };
};

/** 시련의 보스를 쓰러뜨렸는가 */
export const isDailyTrialBossDown = (player: Player): boolean => {
    const run = player.trialRun;
    if (!run) return false;
    const { bossName } = getDailyTrialPlan(run.dayKey);
    return Boolean(bossName) && player.stats?.areaBossDefeated?.[bossName] === true;
};

/** 깬 지도 수 — 완주면 전부, 아니면 지금 지도 앞까지 */
export const getDailyTrialClearedMaps = (run: DailyTrialRun, cleared: boolean): number => (
    cleared ? BALANCE.DAILY_TRIAL_MAPS : Math.max(0, run.map - 1)
);

// ── 기록 장부 ─────────────────────────────────────────────────────────────

const toCount = (value: unknown): number => {
    const numeric = Math.trunc(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const readRecord = (value: unknown): DailyTrialRecord | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Partial<DailyTrialRecord>;
    return {
        cleared: raw.cleared === true,
        maps: Math.min(BALANCE.DAILY_TRIAL_MAPS, toCount(raw.maps)),
        actions: toCount(raw.actions),
    };
};

/** 저장된 장부 읽기 — 알아볼 수 없는 줄은 버리고 날짜 순서로 둔다. */
export const readDailyTrialLedger = (stats: Player['stats'] | null | undefined): DailyTrialLedger => {
    const raw = stats?.dailyTrial?.days;
    if (!Array.isArray(raw)) return { days: [] };
    const byDay = new Map<string, DailyTrialDay>();
    for (const entry of raw) {
        if (!entry || !isDailyTrialDayKey(entry.day)) continue;
        byDay.set(entry.day, { day: entry.day, tries: toCount(entry.tries), best: readRecord(entry.best) });
    }
    const days = [...byDay.values()].sort((left, right) => (left.day < right.day ? -1 : 1));
    return { days: days.slice(-BALANCE.DAILY_TRIAL_LEDGER_DAYS) };
};

/** 완주 여부 → 깬 지도 수 → 행동 수(적을수록 위). 위면 음수다. */
export const compareDailyTrialRecords = (left: DailyTrialRecord, right: DailyTrialRecord): number => (
    Number(right.cleared) - Number(left.cleared) || right.maps - left.maps || left.actions - right.actions
);

/** 끝난 한 판을 장부에 적는다 — 하루 여러 번 할 수 있고 최고만 남는다. 포기한 판은 도전 수에만 든다. */
export const recordDailyTrial = (ledger: DailyTrialLedger, dayKey: string, result: DailyTrialResult): DailyTrialLedger => {
    const previous = ledger.days.find((entry) => entry.day === dayKey);
    const record: DailyTrialRecord | null = result.outcome === 'left'
        ? null
        : { cleared: result.cleared, maps: result.maps, actions: result.actions };
    const best = !record ? previous?.best ?? null
        : previous?.best && compareDailyTrialRecords(previous.best, record) <= 0 ? previous.best
            : record;
    const entry: DailyTrialDay = { day: dayKey, tries: (previous?.tries ?? 0) + 1, best };
    const days = [...ledger.days.filter((other) => other.day !== dayKey), entry]
        .sort((left, right) => (left.day < right.day ? -1 : 1))
        .slice(-BALANCE.DAILY_TRIAL_LEDGER_DAYS);
    return { days };
};

export const isNewDailyTrialBest = (ledger: DailyTrialLedger, dayKey: string, result: DailyTrialResult): boolean => {
    if (result.outcome === 'left') return false;
    const best = ledger.days.find((entry) => entry.day === dayKey)?.best;
    return !best || compareDailyTrialRecords(result, best) < 0;
};
