import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
    applyBattleStartRelics,
    checkDiscoveryChains,
    resetDailyProtocolIfNeeded,
    resetWeeklyProtocolIfNeeded,
    rollExplorationEvent,
    runQuietRollAndCombat,
} from '../src/hooks/gameActions/exploreFlow.ts';
import { DB } from '../src/data/db.ts';
import { getProtocolDayKey, getProtocolWeekKey } from '../src/utils/protocolCycle.ts';

/**
 * Wave 4 N1 — 계층 정상화 동치 테스트.
 *
 * `src/utils/exploreUtils.ts`에 섞여 있던 dispatch 소비 함수 6개를
 * `src/hooks/gameActions/exploreFlow.ts`로 옮겼다. 아래 기대값은 **이동 전** 코드
 * (exploreUtils)를 같은 픽스처/같은 시드로 돌려 뽑은 실측 트레이스를 그대로 붙인 것이다.
 * 이동이 순수 재배치였다면 이 파일은 한 글자도 바뀌지 않은 채 통과해야 한다.
 *
 * 트레이스 정규화 규칙:
 *  - dispatch 함수형 payload는 픽스처 플레이어에 적용한 뒤 경로별 diff로 기록한다.
 *  - 날짜/주차/`disc_<ms>` 같은 시계 의존 값만 자리표시자로 치환한다.
 */

const TODAY = getProtocolDayKey(new Date());
const THIS_WEEK = getProtocolWeekKey(new Date());

const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    if (typeof value === 'function') return '<fn>';
    if (typeof value === 'string') {
        if (value === TODAY) return '<today>';
        if (value === THIS_WEEK) return '<thisWeek>';
        if (/^disc_\d+$/.test(value)) return 'disc_<now>';
        return value;
    }
    return value;
};

const json = (value) => JSON.stringify(stable(value));

const diffPaths = (before, after, prefix = '') => {
    const out = [];
    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
    for (const key of keys) {
        const a = before ? before[key] : undefined;
        const b = after ? after[key] : undefined;
        if (json(a) === json(b)) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        const nested = a && b && typeof a === 'object' && typeof b === 'object'
            && !Array.isArray(a) && !Array.isArray(b);
        if (nested) out.push(...diffPaths(a, b, path));
        else out.push(`${path}=${json(b)}`);
    }
    return out;
};

const mulberry32 = (seed) => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** 앞부분은 대본대로 분기를 고정하고, 이후는 시드 고정 스트림을 쓴다. */
const scriptedRng = (values, seed) => {
    const tail = mulberry32(seed);
    let index = 0;
    return () => (index < values.length ? values[index++] : tail());
};

const makeRecorder = (basePlayer) => {
    const trace = [];
    const dispatch = (action) => {
        const payload = action.payload;
        if (typeof payload === 'function') {
            trace.push(`dispatch ${action.type} :: ${diffPaths(basePlayer, payload(basePlayer)).join(' | ')}`);
            return;
        }
        trace.push(`dispatch ${action.type} :: ${json(payload)}`);
    };
    const addLog = (type, text) => trace.push(`log ${type} :: ${text}`);
    const addStoryLog = (type, data) => trace.push(`story ${type} :: ${json(data)}`);
    const commitExploreOutcome = (outcome, transformPlayer, mapData) => {
        trace.push(
            `commit ${outcome} :: transform=${typeof transformPlayer === 'function' ? 'fn' : json(transformPlayer)}`
            + ` :: map=${mapData ? '<map>' : 'null'}`,
        );
    };
    return { trace, dispatch, addLog, addStoryLog, commitExploreOutcome };
};

const FULL_STATS = { maxHp: 200, maxMp: 80, atk: 40, def: 20, crit: 0.1 };
const getFullStats = () => FULL_STATS;

const basePlayer = (overrides = {}) => ({
    name: '탐험가',
    job: '전사',
    level: 10,
    hp: 120,
    maxHp: 200,
    mp: 10,
    maxMp: 80,
    atk: 40,
    def: 20,
    exp: 0,
    nextExp: 1000,
    gold: 500,
    loc: '고요한 숲',
    inv: [],
    equip: { weapon: null, armor: null, offhand: null },
    quests: [],
    relics: [],
    status: [],
    titles: [],
    challengeModifiers: [],
    combatFlags: { comboCount: 3, deathSaveUsed: true, voidHeartUsed: false, voidHeartArmed: true },
    meta: { prestigeRank: 0, mirror: {} },
    stats: { exploreState: { sinceRelic: 0, quietStreak: 0 }, visitedMaps: [], discoveryChains: [] },
    ...overrides,
});

const KEY_ITEM = { id: 'key_1', name: '잊혀진 열쇠', type: 'mat' };

const CASES = [
    // ── resetWeeklyProtocolIfNeeded ────────────────────────────────────────
    {
        name: 'resetWeeklyProtocolIfNeeded / 지난 주 기록은 이번 주로 리셋된다',
        expected: [
            'dispatch SET_PLAYER :: weeklyProtocol.bossKills=0 | weeklyProtocol.claimed=[] | weeklyProtocol.explores=0 | weeklyProtocol.kills=0 | weeklyProtocol.lastResetWeek="<thisWeek>"',
        ],
        run: () => {
            const player = basePlayer({
                weeklyProtocol: { kills: 5, explores: 2, bossKills: 1, lastResetWeek: '1999-W01', claimed: ['weeklyKills'] },
            });
            const rec = makeRecorder(player);
            resetWeeklyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },
    {
        name: 'resetWeeklyProtocolIfNeeded / 이번 주 기록이면 dispatch 0건',
        expected: [],
        run: () => {
            const player = basePlayer({
                weeklyProtocol: { kills: 3, explores: 1, bossKills: 0, lastResetWeek: THIS_WEEK, claimed: [] },
            });
            const rec = makeRecorder(player);
            resetWeeklyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },
    {
        name: 'resetWeeklyProtocolIfNeeded / 기록 자체가 없으면 새로 만든다',
        expected: [
            'dispatch SET_PLAYER :: weeklyProtocol={"bossKills":0,"claimed":[],"explores":0,"kills":0,"lastResetWeek":"<thisWeek>"}',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            resetWeeklyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },

    // ── resetDailyProtocolIfNeeded ─────────────────────────────────────────
    {
        name: 'resetDailyProtocolIfNeeded / 어제 날짜면 오늘 임무로 교체한다',
        expected: [
            'dispatch SET_DAILY_PROTOCOL :: {"date":"<today>","missions":[{"done":false,"goal":14,"id":"kill_n","progress":0,"reward":{"essence":35},"type":"kills"},{"done":false,"goal":10,"id":"explore_n","progress":0,"reward":{"item":"중급 체력 물약"},"type":"explores"},{"done":false,"goal":300,"id":"gold_n","progress":0,"reward":{"relicShard":1},"type":"goldSpend"}],"relicShards":2}',
        ],
        run: () => {
            const player = basePlayer({
                level: 7,
                stats: { dailyProtocol: { date: '1999-01-01', relicShards: 2, missions: [] } },
            });
            const rec = makeRecorder(player);
            resetDailyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },
    {
        name: 'resetDailyProtocolIfNeeded / 오늘 날짜면 dispatch 0건',
        expected: [],
        run: () => {
            const player = basePlayer({ level: 7, stats: { dailyProtocol: { date: TODAY, relicShards: 0, missions: [] } } });
            const rec = makeRecorder(player);
            resetDailyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },
    {
        name: 'resetDailyProtocolIfNeeded / 임무가 없으면 레벨에 맞춰 생성한다',
        expected: [
            'dispatch SET_DAILY_PROTOCOL :: {"date":"<today>","missions":[{"done":false,"goal":60,"id":"kill_n","progress":0,"reward":{"essence":150},"type":"kills"},{"done":false,"goal":10,"id":"explore_n","progress":0,"reward":{"item":"중급 체력 물약"},"type":"explores"},{"done":false,"goal":600,"id":"gold_n","progress":0,"reward":{"relicShard":1},"type":"goldSpend"}],"relicShards":0}',
        ],
        run: () => {
            const player = basePlayer({ level: 30, stats: {} });
            const rec = makeRecorder(player);
            resetDailyProtocolIfNeeded(player, rec.dispatch);
            return rec.trace;
        },
    },

    // ── rollExplorationEvent ───────────────────────────────────────────────
    {
        name: 'rollExplorationEvent / 열쇠 이벤트는 열쇠를 소모하고 보물고로 이동시킨다',
        expected: [
            'dispatch SET_PLAYER :: inv=[] | loc="고대 보물고"',
            'log event :: 💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!',
            'return :: key_event',
        ],
        run: () => {
            const player = basePlayer({ loc: '수정 동굴', inv: [KEY_ITEM] });
            const rec = makeRecorder(player);
            const result = rollExplorationEvent(player, DB.MAPS['수정 동굴'], [], {
                dispatch: rec.dispatch, addLog: rec.addLog, getFullStats, rng: scriptedRng([0], 11),
            });
            return [...rec.trace, `return :: ${result}`];
        },
    },
    {
        name: 'rollExplorationEvent / 이상 현상(마나 회복) 분기',
        expected: [
            'log warning :: [기상 이변] 강력한 마력의 폭풍이 붑니다. (MP 30% 회복)',
            'dispatch SET_PLAYER :: mp=34',
            'return :: anomaly',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            const result = rollExplorationEvent(player, DB.MAPS['고요한 숲'], [], {
                dispatch: rec.dispatch, addLog: rec.addLog, getFullStats, rng: scriptedRng([0, 0.4], 22),
            });
            return [...rec.trace, `return :: ${result}`];
        },
    },
    {
        name: 'rollExplorationEvent / 유물 발견 분기는 후보 3장을 제시한다',
        expected: [
            'dispatch SET_PENDING_RELICS :: [{"desc":"보스 발견 확률이 3배가 되고 보스 전리품 획득률 100% 증가","effect":"boss_hunter","id":"void_eye","name":"허공의 눈","rarity":"epic","val":{"drop":1,"spawn":3}},{"desc":"생명이 25% 이하이면 모든 피해 40% 증가","effect":"low_hp_dmg","id":"blood_moon","name":"피의 달","rarity":"rare","threshold":0.25,"val":1.4},{"desc":"아이템 획득 확률 100% 증가 (행운의 동전 강화형)","effect":"drop_rate","id":"fortune_relic","name":"운명의 결정","rarity":"rare","val":1}]',
            'log event :: ✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.',
            'return :: relic_found',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            const result = rollExplorationEvent(player, DB.MAPS['고요한 숲'], [], {
                dispatch: rec.dispatch, addLog: rec.addLog, getFullStats, rng: scriptedRng([0.999, 0], 33),
            });
            return [...rec.trace, `return :: ${result}`];
        },
    },

    // ── applyBattleStartRelics ─────────────────────────────────────────────
    {
        name: 'applyBattleStartRelics / 유물이 없으면 전투 플래그만 초기화한다',
        expected: [
            'return :: combatFlags.comboCount=0 | combatFlags.deathSaveUsed=false | combatFlags.firstSkillUsed=false | combatFlags.phoenixUsed=false | combatFlags.turnCount=0',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            const next = applyBattleStartRelics(player, [], FULL_STATS, {
                addLog: rec.addLog, rng: scriptedRng([], 44),
            });
            return [...rec.trace, `return :: ${diffPaths(player, next).join(' | ')}`];
        },
    },
    {
        name: 'applyBattleStartRelics / 전투 시작 버프·회복·대가 유물이 함께 적용된다',
        expected: [
            'log event :: [전쟁의 북] 전투 시작 ATK +20% (2턴)',
            'log heal :: [재생 코어] 전투 시작 회복 +20 HP',
            'log warning :: [저주받은 반지] 전투 시작 대가 -10 HP',
            'return :: combatFlags.comboCount=0 | combatFlags.deathSaveUsed=false | combatFlags.firstSkillUsed=false | combatFlags.phoenixUsed=false | combatFlags.turnCount=0 | hp=130 | tempBuff={"atk":0.2,"def":0,"name":"battle_start_buff","turn":2}',
        ],
        run: () => {
            const player = basePlayer();
            const relics = [
                { id: 'war_drum', effect: 'battle_start_buff', val: { atk: 0.2, turns: 2 } },
                { id: 'regen_core', effect: 'battle_start_heal', val: 0.1 },
                { id: 'cursed_ring', effect: 'cursed_power', val: { hp_cost: 0.05 } },
            ];
            const rec = makeRecorder(player);
            const next = applyBattleStartRelics(player, relics, FULL_STATS, {
                addLog: rec.addLog, rng: scriptedRng([], 55),
            });
            return [...rec.trace, `return :: ${diffPaths(player, next).join(' | ')}`];
        },
    },
    {
        name: 'applyBattleStartRelics / 혼돈 계열은 rng 분기를 그대로 탄다',
        expected: [
            'log event :: [혼돈의 심장] 혼돈의 기운 — DEF +25% (3턴)!',
            'log event :: [혼돈의 보석] ATK +30% 버프',
            'return :: combatFlags.comboCount=0 | combatFlags.deathSaveUsed=false | combatFlags.firstSkillUsed=false | combatFlags.phoenixUsed=false | combatFlags.turnCount=0 | tempBuff={"atk":0.3,"def":0.25,"name":"혼돈의 보석","turn":3}',
        ],
        run: () => {
            const player = basePlayer();
            const relics = [
                { id: 'chaos_heart', effect: 'chaos_relic', val: 1 },
                { id: 'chaos_gem', effect: 'chaos_buff', val: 0.3 },
            ];
            const rec = makeRecorder(player);
            const next = applyBattleStartRelics(player, relics, FULL_STATS, {
                addLog: rec.addLog, rng: scriptedRng([0.7, 0.2], 66),
            });
            return [...rec.trace, `return :: ${diffPaths(player, next).join(' | ')}`];
        },
    },

    // ── runQuietRollAndCombat ──────────────────────────────────────────────
    {
        name: 'runQuietRollAndCombat / 조용한 탐험은 nothing으로 정산된다',
        expected: [
            'commit nothing :: transform=null :: map=<map>',
            'log info :: 주변이 조용합니다.',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            runQuietRollAndCombat(player, DB.MAPS['고요한 숲'], {
                dispatch: rec.dispatch,
                addLog: rec.addLog,
                addStoryLog: rec.addStoryLog,
                getFullStats,
                commitExploreOutcome: rec.commitExploreOutcome,
                rng: scriptedRng([0, 0.999, 0.999], 77),
            });
            return rec.trace;
        },
    },
    {
        name: 'runQuietRollAndCombat / 전투 직전 유물 발견은 전투를 대체한다',
        expected: [
            'commit relic_found :: transform=null :: map=<map>',
            'dispatch SET_PENDING_RELICS :: [{"desc":"공격 시 15% 확률로 적 1턴 빙결","effect":"on_hit_freeze","id":"frost_anchor","name":"동결의 닻","rarity":"rare","val":0.15},{"desc":"공격할 때 적 방어력의 30% 무시","effect":"armor_pen","id":"phantom_blade","name":"유령 검","rarity":"rare","val":0.3},{"desc":"전투에서 매 턴 기력 5 회복","effect":"mp_regen_turn","id":"arcane_surge","name":"비전 서지","rarity":"rare","val":5}]',
            'log event :: ✨ [유물 발견] 전투 직전, 고대의 유물이 눈에 들어옵니다!',
        ],
        run: () => {
            const player = basePlayer();
            const rec = makeRecorder(player);
            runQuietRollAndCombat(player, DB.MAPS['고요한 숲'], {
                dispatch: rec.dispatch,
                addLog: rec.addLog,
                addStoryLog: rec.addStoryLog,
                getFullStats,
                commitExploreOutcome: rec.commitExploreOutcome,
                rng: scriptedRng([0.999, 0], 88),
            });
            return rec.trace;
        },
    },
    {
        name: 'runQuietRollAndCombat / 전투 스폰(게이지 중복 누적 차단 경로)',
        expected: [
            'commit combat :: transform=fn :: map=null',
            'dispatch SET_ENEMY :: {"atk":29,"baseName":"고블린","def":8,"exp":60,"gold":26,"hp":220,"isBoss":false,"level":5,"maxHp":220,"name":"고블린","pattern":{"guardChance":0,"heavyChance":0.2},"resistance":"자연","weakness":"화염"}',
            'dispatch SET_GAME_STATE :: "combat"',
            'log combat :: 고블린 등장!',
            'story encounter :: {"loc":"잊혀진 폐허","name":"고블린"}',
        ],
        run: () => {
            const player = basePlayer({ loc: '잊혀진 폐허' });
            const rec = makeRecorder(player);
            runQuietRollAndCombat(player, DB.MAPS['잊혀진 폐허'], {
                dispatch: rec.dispatch,
                addLog: rec.addLog,
                addStoryLog: rec.addStoryLog,
                getFullStats,
                commitExploreOutcome: rec.commitExploreOutcome,
                skipBossGaugeAdvance: true,
                rng: scriptedRng([0.999, 0.999], 99),
            });
            return rec.trace;
        },
    },

    // ── checkDiscoveryChains ───────────────────────────────────────────────
    {
        name: 'checkDiscoveryChains / 마지막 지역을 밟으면 체인 보상이 지급된다',
        expected: [
            'log event :: 🔍 세 곳의 화염 지역을 탐험하니 고대 용의 기운이 하나로 수렴합니다.',
            'log success :: 🏆 [발견 체인 완료] 화염의 수렴! 보상: 3000G, 2000 EXP, 용의 화염',
            'dispatch SET_PLAYER :: atk=43 | def=21 | exp=1000 | gold=3500 | hp=140 | inv=[{"baseItemName":"용의 화염","desc":"용의 화염을 담은 검.","desc_stat":"ATK+155(화) / 2H","elem":"화염","hands":2,"id":"disc_<now>","jobs":["전사","버서커"],"name":"용의 화염","price":25500,"tier":5,"type":"weapon","val":155}] | level=11 | maxHp=220 | maxMp=90 | mp=20 | nextExp=1150 | stats.discoveryChains=["fire_convergence"]',
        ],
        run: () => {
            const player = basePlayer({
                gold: 500,
                maxInv: 20,
                stats: { visitedMaps: ['화염의 협곡', '화염의 사원'], discoveryChains: [] },
            });
            const rec = makeRecorder(player);
            checkDiscoveryChains(player, '용의 둥지', { dispatch: rec.dispatch, addLog: rec.addLog });
            return rec.trace;
        },
    },
    {
        name: 'checkDiscoveryChains / 이미 완료한 체인은 다시 지급하지 않는다',
        expected: [],
        run: () => {
            const player = basePlayer({
                stats: { visitedMaps: ['화염의 협곡', '화염의 사원'], discoveryChains: ['fire_convergence'] },
            });
            const rec = makeRecorder(player);
            checkDiscoveryChains(player, '용의 둥지', { dispatch: rec.dispatch, addLog: rec.addLog });
            return rec.trace;
        },
    },
    {
        name: 'checkDiscoveryChains / 아직 방문하지 않은 지역이 남으면 아무 일도 없다',
        expected: [],
        run: () => {
            const player = basePlayer({
                stats: { visitedMaps: ['화염의 협곡'], discoveryChains: [] },
            });
            const rec = makeRecorder(player);
            checkDiscoveryChains(player, '용의 둥지', { dispatch: rec.dispatch, addLog: rec.addLog });
            return rec.trace;
        },
    },
];

for (const testCase of CASES) {
    test(`이동 동치: ${testCase.name}`, () => {
        assert.deepEqual(testCase.run(), testCase.expected);
    });
}

// ── 계층 가드 ─────────────────────────────────────────────────────────────
test('exploreUtils.ts는 reducer 계층(actionTypes/gameStates/handlers)을 import하지 않는다', async () => {
    const source = await readFile(new URL('../src/utils/exploreUtils.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^\s*import[\s\S]*?from\s+'([^']+)';/gm)].map((match) => match[1]);
    const reducerImports = imports.filter((spec) => /reducers\//.test(spec));
    assert.deepEqual(reducerImports, [], 'exploreUtils는 순수 계층 — reducer import 0건이어야 한다');
    // 주석은 이동 이력을 설명하므로 코드 본문만 본다.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bAT\./.test(code), 'AT(actionTypes) 참조가 남아 있으면 안 된다');
    assert.ok(!/\bGS\./.test(code), 'GS(gameStates) 참조가 남아 있으면 안 된다');
    assert.ok(!/\bdispatch\b/.test(code), 'dispatch를 받는 함수는 exploreFlow.ts 소유다');
});

test('exploreFlow.ts가 이동한 6개 함수의 단일 소유자다 (재수출 shim 없음)', async () => {
    const flowSource = await readFile(new URL('../src/hooks/gameActions/exploreFlow.ts', import.meta.url), 'utf8');
    const utilsSource = await readFile(new URL('../src/utils/exploreUtils.ts', import.meta.url), 'utf8');
    const moved = [
        'resetWeeklyProtocolIfNeeded',
        'resetDailyProtocolIfNeeded',
        'rollExplorationEvent',
        'applyBattleStartRelics',
        'runQuietRollAndCombat',
        'checkDiscoveryChains',
    ];
    for (const name of moved) {
        assert.ok(flowSource.includes(`export const ${name} =`), `${name}은 exploreFlow.ts가 소유한다`);
        assert.ok(!utilsSource.includes(name), `${name} 잔재가 exploreUtils.ts에 남으면 안 된다`);
    }
    const pure = ['selectEncounterMonster', 'spawnEnemy', 'getFirstVisitReward'];
    for (const name of pure) {
        assert.ok(utilsSource.includes(`export const ${name} =`), `${name}은 exploreUtils.ts에 남는다`);
    }
});
