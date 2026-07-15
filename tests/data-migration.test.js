import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { migrateData } from '../src/utils/gameUtils.js';

/**
 * 저장 데이터 마이그레이션 (migrateData / dataMigration.ts) 테스트 — 통합본.
 * 기존 19개 cycle-*.test.js (cycle 120/131/189/306/373~388) 통합 (audit #1: cycle 테스트 도메인 통합).
 * 각 블록의 cycle 주석/테스트는 원본 그대로 보존 — 행동/커버리지 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('migrateData initializes missing location exploration counts and preserves existing values', () => {
    const missingCounts = migrateData({
        version: 5.0,
        player: { name: '구플레이어', stats: {}, equip: {} },
    });
    assert.deepEqual(missingCounts.player.stats.exploresByLocation, {});

    const existingCounts = migrateData({
        version: 5.0,
        player: {
            name: '탐험가',
            stats: { exploresByLocation: { '고요한 숲': 4, '잊혀진 폐허': 2 } },
            equip: {},
        },
    });
    assert.deepEqual(existingCounts.player.stats.exploresByLocation, {
        '고요한 숲': 4,
        '잊혀진 폐허': 2,
    });
});

// ─── 원본: tests/cycle-120-migrate-counter-defaults.test.js ───
/**
 * cycle 120: migrateData stats counter 기본값 정리.
 *
 * 발견:
 * - cycle 84에서 discoveries 필드를 INITIAL_STATE에서 제거했으나, migrateData
 *   line 403에 `target.stats.discoveries = target.stats.discoveries || 0`이
 *   잔존 (dead code).
 * - cycle 74(escapes), 82(syntheses), 95(maxKillStreak), 102(discoveryChains)에서
 *   추가된 영구 카운터들은 migrateData에 default 처리 누락. 구버전 save에서
 *   이 필드가 undefined로 로드되면 reads는 `|| 0` 또는 `|| []`로 안전하지만,
 *   migrate 단계에서 정합성 보장이 약함 (cycle 119에서 ASCEND preserve 추가
 *   후엔 더 명확히 필요).
 *
 * 수정:
 * 1. dead `discoveries` migrate 라인 제거 (cycle 84 후속 cleanup).
 * 2. 신규 카운터 default 추가:
 *    - escapes (number) → 0
 *    - syntheses (number) → 0
 *    - maxKillStreak (number) → 0
 *    - discoveryChains (array) → []
 *
 * Firebase save에 잔존하는 stats.discoveries 필드는 무시됨 (forward-compatible).
 */

test('migrateData: 구버전 save (escapes/syntheses/maxKillStreak/discoveryChains 누락) → 0/[] 기본값', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '구플레이어',
            stats: {
                kills: 100, deaths: 1, total_gold: 5000,
                bossKills: 2, rests: 5,
                // 명시적으로 escapes/syntheses/maxKillStreak/discoveryChains 누락
            },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    const stats = migrated.player.stats;
    assert.equal(stats.escapes, 0, 'escapes default 0');
    assert.equal(stats.syntheses, 0, 'syntheses default 0');
    assert.equal(stats.maxKillStreak, 0, 'maxKillStreak default 0');
    assert.deepEqual(stats.discoveryChains, [], 'discoveryChains default []');
});

test('migrateData: 기존 카운터 값 보존 (회귀 가드)', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '플레이어',
            stats: {
                kills: 250, escapes: 12, syntheses: 30, maxKillStreak: 18,
                discoveryChains: ['fire_convergence'],
            },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    const stats = migrated.player.stats;
    assert.equal(stats.escapes, 12);
    assert.equal(stats.syntheses, 30);
    assert.equal(stats.maxKillStreak, 18);
    assert.deepEqual(stats.discoveryChains, ['fire_convergence']);
});

test('migrateData: dead "discoveries" migrate 라인 제거됨', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const source = await readFile(path.join(ROOT, 'src/utils/gameUtils.ts'), 'utf8');
    // cycle 84에서 INITIAL_STATE.discoveries를 제거한 후속 cleanup.
    assert.doesNotMatch(
        source,
        /target\.stats\.discoveries\s*=\s*target\.stats\.discoveries\s*\|\|\s*0/,
        'dead discoveries migrate line should be removed'
    );
});

test('migrateData: discoveryChains이 배열이 아닌 경우 → 빈 배열 fallback', () => {
    const oldSave = {
        version: 5.0,
        player: {
            name: '손상',
            stats: { kills: 10, discoveryChains: 'not-an-array' },
            equip: {},
        },
    };
    const migrated = migrateData(oldSave);
    assert.deepEqual(migrated.player.stats.discoveryChains, []);
});

// ─── 원본: tests/cycle-131-save-migrate-ascend-flow.test.js ───
/**
 * cycle 131: save → migrate → ASCEND 통합 흐름 회귀 가드.
 *
 * cycle 119(ASCEND preserve) + 120(migrate default) + 121(INITIAL_STATE 선언)을
 * 한 번에 검증하는 end-to-end 시나리오. 각 사이클의 unit test는 각자의 layer만
 * 검증했으나, 실제 사용 흐름은 save 로드 → 게임 진행 → 환생까지 연결된다.
 *
 * 시나리오 1 (Legacy save + 진행 + 환생):
 *   1. cycle 74 이전의 구버전 save (escapes/syntheses/maxKillStreak/discoveryChains
 *      누락) 로드
 *   2. migrateData가 기본값(0/[]) 부여
 *   3. 게임 진행 중 카운터 누적 (시뮬레이션: stats 업데이트)
 *   4. ASCEND
 *   5. 환생 후에도 누적된 카운터 보존
 *
 * 시나리오 2 (신규 플레이어):
 *   1. INITIAL_STATE에 모든 카운터 declared
 *   2. 진행 → ASCEND
 *   3. 카운터 보존
 */

test('legacy save → migrate → 진행 → ASCEND 후 카운터 보존', () => {
    // 1. cycle 74 이전 save (영구 카운터 모두 누락)
    const legacySave = {
        version: 5.0,
        player: {
            name: '레거시 플레이어',
            gender: 'male',
            level: 50,
            meta: { prestigeRank: 0 },
            titles: [],
            stats: {
                kills: 500, bossKills: 8, deaths: 2, total_gold: 80000,
                relicCount: 12, abyssFloor: 25, demonKingSlain: 0,
                bountiesCompleted: 15, crafts: 30,
                // 누락: escapes, syntheses, maxKillStreak, discoveryChains
            },
            equip: {},
        },
    };

    // 2. migrate (cycle 120 default)
    const migrated = migrateData(legacySave);
    assert.equal(migrated.player.stats.escapes, 0, 'cycle 120 migrate default');
    assert.equal(migrated.player.stats.syntheses, 0);
    assert.equal(migrated.player.stats.maxKillStreak, 0);
    assert.deepEqual(migrated.player.stats.discoveryChains, []);

    // 3. 게임 진행 시뮬레이션 — 카운터 누적
    const inProgressState = {
        ...INITIAL_STATE,
        player: {
            ...migrated.player,
            stats: {
                ...migrated.player.stats,
                escapes: 5,
                syntheses: 3,
                maxKillStreak: 18,
                discoveryChains: ['fire_convergence'],
            },
        },
    };

    // 4. ASCEND (cycle 119 preserve)
    const afterAscend = gameReducer(inProgressState, {
        type: AT.ASCEND,
        payload: {
            meta: { ...inProgressState.player.meta, prestigeRank: 1 },
            newTitle: 'reborn',
        },
    });

    // 5. 환생 후 누적된 카운터 보존
    assert.equal(afterAscend.player.stats.escapes, 5, '환생 후 escapes 보존');
    assert.equal(afterAscend.player.stats.syntheses, 3);
    assert.equal(afterAscend.player.stats.maxKillStreak, 18);
    assert.deepEqual(afterAscend.player.stats.discoveryChains, ['fire_convergence']);
    // 기존 보존 카운터도 정상
    assert.equal(afterAscend.player.stats.kills, 500);
    assert.equal(afterAscend.player.stats.demonKingSlain, 1, 'demonKingSlain 증분');
});

test('신규 플레이어: INITIAL_STATE → 진행 → ASCEND', () => {
    // INITIAL_STATE는 cycle 121에서 discoveryChains: [] 추가됨.
    const stats = INITIAL_STATE.player.stats || {};
    assert.equal(stats.escapes, 0, 'cycle 74 INITIAL_STATE');
    assert.equal(stats.syntheses, 0, 'cycle 82 INITIAL_STATE');
    assert.equal(stats.maxKillStreak, 0, 'cycle 95 INITIAL_STATE');
    assert.deepEqual(stats.discoveryChains, [], 'cycle 121 INITIAL_STATE');

    // 진행 후 ASCEND
    const inProgressState = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            level: 50,
            stats: {
                ...stats,
                kills: 100,
                escapes: 7,
                maxKillStreak: 22,
                discoveryChains: ['fire_convergence', 'frozen_truth'],
            },
        },
    };

    const afterAscend = gameReducer(inProgressState, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 1 }, newTitle: 'reborn' },
    });

    assert.equal(afterAscend.player.stats.escapes, 7);
    assert.equal(afterAscend.player.stats.maxKillStreak, 22);
    assert.deepEqual(afterAscend.player.stats.discoveryChains, ['fire_convergence', 'frozen_truth']);
});

test('연속 ASCEND: 두 번 환생해도 카운터 보존 (regression — preserve 자체 회귀 방지)', () => {
    let state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            level: 50,
            stats: {
                ...INITIAL_STATE.player.stats,
                escapes: 10,
                maxKillStreak: 30,
                discoveryChains: ['fire_convergence'],
            },
        },
    };

    // 첫 번째 ASCEND
    state = gameReducer(state, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 1 }, newTitle: 'reborn' },
    });
    assert.equal(state.player.stats.escapes, 10);
    assert.equal(state.player.stats.maxKillStreak, 30);

    // 두 번째 ASCEND (변화 없이 바로 환생)
    state = gameReducer(state, {
        type: AT.ASCEND,
        payload: { meta: { prestigeRank: 2 }, newTitle: 'transcendent' },
    });
    assert.equal(state.player.stats.escapes, 10, '연속 환생 후에도 보존');
    assert.equal(state.player.stats.maxKillStreak, 30);
    assert.equal(state.player.stats.demonKingSlain, 2, '연속 환생마다 +1');
});

// ─── 원본: tests/cycle-189-migrate-premium-asset-default.test.js ───
/**
 * cycle 189: migrateData가 PremiumShop 구매 자산 4종 default 처리 (cycle 188 follow-up).
 *
 * 발견:
 * - cycle 188이 ASCEND에서 4 premium 자산을 보존하도록 fix.
 * - 그러나 migrateData는 옛 save에 4 필드 미정의 시 default 처리 누락 → undefined.
 * - 코드 fallback(`x || 0`)으로 안전하지만 데이터 형태 inconsistent — cycle 119 영구
 *   카운터 default 처리와 통일 안 됨.
 *
 * 수정 (src/utils/gameUtils.ts migrateData):
 * - target.reviveTokens, stats.synthProtects, stats.cosmeticTitles, maxInv 명시 default.
 * - 모두 0 / [] / undefined fallback (maxInv는 PremiumShop INV_EXPAND 미구매 시 player.maxInv
 *   undefined 그대로 — fallback 코드가 BALANCE.INV_MAX_SIZE로 처리).
 */

test('cycle 189: 옛 save에 premium 자산 누락 → migrate 후 0 / [] 명시 초기화', () => {
    const oldSave = {
        version: 4.0,
        player: {
            name: 'old',
            gender: 'male',
            level: 30,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 50, def: 30,
            // premium 자산 미정의
            stats: { kills: 100, total_gold: 5000, deaths: 0, killRegistry: {}, bossKills: 0 },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(oldSave);
    const player = migrated.player;

    // reviveTokens default 0
    assert.equal(player.reviveTokens, 0);
    // synthProtects default 0
    assert.equal(player.stats.synthProtects, 0);
    // cosmeticTitles default []
    assert.deepEqual(player.stats.cosmeticTitles, []);
    // maxInv 미정의 — PremiumShop 미사용자는 undefined (BALANCE.INV_MAX_SIZE fallback).
    assert.equal(player.maxInv, undefined);
});

test('cycle 189: 기존 보유값 보존 (회귀 가드)', () => {
    const save = {
        version: 5.0,
        player: {
            name: 'rich',
            gender: 'male',
            level: 50,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 50, def: 30,
            reviveTokens: 3,
            maxInv: 30,
            stats: {
                kills: 200, total_gold: 10000, deaths: 0, killRegistry: {}, bossKills: 0,
                synthProtects: 5,
                cosmeticTitles: ['title_stargazer'],
            },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(save);
    const player = migrated.player;

    assert.equal(player.reviveTokens, 3);
    assert.equal(player.maxInv, 30);
    assert.equal(player.stats.synthProtects, 5);
    assert.deepEqual(player.stats.cosmeticTitles, ['title_stargazer']);
});

test('cycle 189: 음수/falsy reviveTokens은 0으로 정규화 (회귀 가드)', () => {
    const save = {
        version: 5.0,
        player: {
            name: 'edge',
            gender: 'male',
            level: 1,
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            atk: 10, def: 5,
            reviveTokens: -5, // 음수 (이상치)
            stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, synthProtects: -2 },
            inv: [], equip: {}, history: [],
        },
    };
    const migrated = migrateData(save);
    assert.equal(migrated.player.reviveTokens, 0, '음수 reviveTokens은 0으로 정규화');
    assert.equal(migrated.player.stats.synthProtects, 0, '음수 synthProtects도 0으로 정규화');
});

// ─── 원본: tests/cycle-306-state-version-dead.test.js ───
/**
 * cycle 306: state.version dead state 제거 (gameReducer)
 *   (cycle 222-305 silent dead config 시리즈 76번째 — cleanup lens 연속).
 *
 * 발견 (dead state field):
 * - src/reducers/gameReducer.ts:
 *   - GameState interface에 version: number 선언.
 *   - INITIAL_STATE에 version: CONSTANTS.DATA_VERSION 초기화.
 *
 * 그러나 state.version에 대한 SET/UPDATE 핸들러 없음. UI/hook이 state.version
 * read 0건. useFirebaseSync는 매 save마다 `version: CONSTANTS.DATA_VERSION`을
 * 직접 기록 (state.version에 의존하지 않음).
 *
 * 패턴 (cycle 222-305 silent dead config 시리즈 76번째):
 * - cycle 305: publicGraves dead state 제거.
 * - cycle 306: state.version dead state 제거 — GameState 표면 1개 축소.
 *
 * 수정:
 * - gameReducer.ts: GameState interface version 필드 제거 + INITIAL_STATE 초기화 제거.
 *
 * 회귀 가드:
 * - useFirebaseSync.ts에서 save 시 직접 CONSTANTS.DATA_VERSION 기록 (영향 없음).
 * - gameUtils.migrateData()는 saved data의 .version 만 검사 (state와 무관).
 * - GameState 다른 필드 영향 없음.
 */


test('cycle 306: GameState interface version 필드 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/^\s*version:\s*number;/m.test(source),
        'GameState.version 타입 필드 제거됨');
});

test('cycle 306: INITIAL_STATE version 초기화 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/version:\s*CONSTANTS\.DATA_VERSION/.test(source),
        'INITIAL_STATE.version 초기화 제거됨');
});

test('cycle 306: useFirebaseSync save 시 CONSTANTS.DATA_VERSION 직접 기록 유지', async () => {
    const source = await readSrc('src/hooks/useFirebaseSync.ts');
    assert.ok(/version:\s*CONSTANTS\.DATA_VERSION/.test(source),
        'Firebase save version 기록 유지');
});

test('cycle 306: gameUtils.migrateData savedData.version 검사 유지', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/savedData\.version/.test(source),
        'migrateData savedData.version 검사 유지');
});

test('cycle 305 회귀 가드: publicGraves 제거 유지', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/publicGraves:\s*any\[\];/.test(source),
        'cycle 305 publicGraves 제거 유지');
});

// ─── 원본: tests/cycle-373-migrate-data-meta-fallback-redundant.test.js ───
/**
 * cycle 373: migrateData target.meta.X || 0 fallback 5회 redundant 정리
 *   (cycle 222-372 silent dead config 시리즈 138번째 — cleanup lens 연속).
 *
 * 발견 (5 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 5 lines:
 *   `target.meta.essence = target.meta.essence || 0;`
 *   `target.meta.rank = target.meta.rank || 0;`
 *   `target.meta.bonusAtk = target.meta.bonusAtk || 0;`
 *   `target.meta.bonusHp = target.meta.bonusHp || 0;`
 *   `target.meta.bonusMp = target.meta.bonusMp || 0;`
 * - 직전 라인 385: `target.meta = target.meta || { essence: 0, rank: 0, ... }`
 *   가 없으면 객체 자체를 default로 초기화. 5 fallback은 부분 객체 보호용.
 * - 모든 consumer가 이미 fallback 처리:
 *   · StatsPanel: `player.meta.essence || 0` 등 (4곳).
 *   · CombatEngine.ts:1468: `const meta = { ...this.DEFAULT_META, ...(p.meta || {}) }`
 *     로컬 reconstruction에 DEFAULT_META 병합 — undefined → 0.
 * - migrateData의 5 fallback은 production read 안전망 중복.
 *
 * 패턴 (cycle 222-372 silent dead config 시리즈 138번째):
 * - cycle 372: maps safe-zone monsters: [] 5 redundant.
 * - cycle 373: migrateData meta fallback 5 redundant defensive.
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 5 redundant `target.meta.X = target.meta.X || 0` lines 제거.
 *
 * 회귀 가드:
 * - 라인 385의 `target.meta = target.meta || { ... }` 보존 (객체 초기화 핵심).
 * - StatsPanel `|| 0` fallback consumer 동작 그대로.
 * - CombatEngine DEFAULT_META 병합 패턴 유지.
 */


test('cycle 373: migrateData target.meta.X || 0 fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.meta\.(essence|rank|bonusAtk|bonusHp|bonusMp) = target\.meta\./g) || [];
    assert.equal(matches.length, 0,
        `target.meta.X = target.meta.X || 0 fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 373: migrateData meta 객체 초기화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.meta = target\.meta \|\| \{ essence: 0, rank: 0/.test(source),
        'target.meta = target.meta || {...defaults} 보존');
});

test('cycle 373: migrateData 동작 보존 (meta 누락 시 default)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // meta 자체 누락 → 객체 초기화로 default 채워짐.
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player.meta, 'meta 객체 보존');
    assert.equal(result.player.meta.essence, 0, 'meta.essence default');
    assert.equal(result.player.meta.rank, 0, 'meta.rank default');
});

test('cycle 372 회귀 가드: maps safe-zone monsters: [] 0건 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/monsters: \[\]/g) || [];
    assert.equal(matches.length, 0, 'cycle 372 monsters: [] 0건 보존');
});

// ─── 원본: tests/cycle-374-migrate-data-tempbuff-fallback-redundant.test.js ───
/**
 * cycle 374: migrateData target.tempBuff.X || 0 fallback 3회 redundant 정리
 *   (cycle 222-373 silent dead config 시리즈 139번째 — cleanup lens 연속).
 *
 * 발견 (3 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 3 sub-field fallback lines:
 *   `target.tempBuff.atk = target.tempBuff.atk || 0;`
 *   `target.tempBuff.def = target.tempBuff.def || 0;`
 *   `target.tempBuff.turn = target.tempBuff.turn || 0;`
 * - 직전 라인 377: `target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null }`
 *   가 객체 자체를 default로 초기화 (legacy save에 tempBuff 누락 시 기본 보장).
 * - 모든 consumer가 이미 fallback 처리 또는 reconstruction:
 *   · statsCalculator.ts:332: `(1 + (buff.atk || 0) + ...)` — `|| 0` fallback.
 *   · statsCalculator.ts:341: `(1 + (buff.def || 0) + ...)` — `|| 0` fallback.
 *   · playerStateUtils.ts:40: `{ ...EMPTY_TEMP_BUFF, ...(player?.tempBuff || {}) }` —
 *     EMPTY_TEMP_BUFF 병합으로 sub-field 보장.
 *   · CombatEngine.ts:1017: tempBuff.turn 읽기는 스킬 활성 직후 발생, 이미 실제 값 set됨.
 *
 * 패턴 (cycle 222-373 silent dead config 시리즈 139번째):
 * - cycle 373: migrateData meta sub-field fallback 5 redundant.
 * - cycle 374: migrateData tempBuff sub-field fallback 3 redundant (동일 lens).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 3 redundant `target.tempBuff.X = target.tempBuff.X || 0` lines 제거.
 *
 * 회귀 가드:
 * - 라인 377의 `target.tempBuff = target.tempBuff || { ... }` 보존 (객체 초기화 핵심).
 * - statsCalculator `|| 0` fallback consumer 동작 그대로.
 * - playerStateUtils EMPTY_TEMP_BUFF 병합 패턴 유지.
 */


test('cycle 374: migrateData target.tempBuff.X || 0 fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.tempBuff\.(atk|def|turn) = target\.tempBuff\./g) || [];
    assert.equal(matches.length, 0,
        `target.tempBuff.X = target.tempBuff.X || 0 fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 374: migrateData tempBuff 객체 초기화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.tempBuff = target\.tempBuff \|\| \{ atk: 0, def: 0, turn: 0/.test(source),
        'target.tempBuff = target.tempBuff || {...defaults} 보존');
});

test('cycle 374: migrateData 동작 보존 (tempBuff 누락 시 default)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player.tempBuff, 'tempBuff 객체 보존');
    assert.equal(result.player.tempBuff.atk, 0, 'tempBuff.atk default');
    assert.equal(result.player.tempBuff.def, 0, 'tempBuff.def default');
    assert.equal(result.player.tempBuff.turn, 0, 'tempBuff.turn default');
});

test('cycle 373 회귀 가드: meta sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const matches = source.match(/target\.meta\.(essence|rank|bonusAtk|bonusHp|bonusMp) = target\.meta\./g) || [];
    assert.equal(matches.length, 0, 'cycle 373 meta sub-field fallback 0건 보존');
});

// ─── 원본: tests/cycle-375-migrate-data-activetitle-fallback-redundant.test.js ───
/**
 * cycle 375: migrateData target.activeTitle || null fallback redundant 정리
 *   (cycle 222-374 silent dead config 시리즈 140번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive fallback):
 * - src/utils/gameUtils.ts migrateData에 `target.activeTitle = target.activeTitle || null` 1라인.
 * - 모든 7곳의 activeTitle consumer가 이미 fallback / truthy 체크 처리:
 *   · statsCalculator.ts:304: `getTitlePassive(player.activeTitle) || {}` — 함수 내부 null/undefined 처리.
 *   · gameUtils.ts:670 (buildRunSummary): `player.activeTitle || null` — fallback.
 *   · useGameEngine.ts:102: `player.activeTitle || null` — fallback.
 *   · useFirebaseSync.ts:234: `player.activeTitle || null` — fallback.
 *   · SystemTab.tsx:89/268/318/320/326: 모두 truthy 체크 (`?` ternary, `&&`, `=== id`).
 * - undefined와 null 모두 falsy 처리되므로 migrate normalization redundant.
 * - cycle 373/374 동일 lens — defensive fallback 중 consumer level fallback로 보호되는 영역.
 *
 * 패턴 (cycle 222-374 silent dead config 시리즈 140번째):
 * - cycle 374: migrateData tempBuff sub-field fallback 3 redundant.
 * - cycle 375: migrateData activeTitle fallback 1 redundant (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - `target.activeTitle = target.activeTitle || null` 라인 제거.
 *
 * 회귀 가드:
 * - statsCalculator getTitlePassive null/undefined 처리 동일.
 * - 모든 SystemTab truthy 체크 동작 그대로.
 * - buildRunSummary `player.activeTitle || null` fallback 유지.
 */


test('cycle 375: migrateData target.activeTitle || null fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // 명시 코드 라인 (comment 라인 제외, comment는 `//`로 시작).
    const matches = block.match(/^\s+target\.activeTitle = target\.activeTitle/gm) || [];
    assert.equal(matches.length, 0,
        `target.activeTitle || null fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 375: migrateData 동작 보존 (activeTitle 누락 시 undefined로 통과)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // activeTitle 명시 없는 save → undefined (consumer가 fallback 처리).
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    assert.ok(result.player, 'player 객체 보존');
    // activeTitle은 undefined or null 모두 가능 (consumer fallback에 의존).
});

test('cycle 374 회귀 가드: tempBuff sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/target\.tempBuff\.(atk|def|turn) = target\.tempBuff\./g) || [];
    assert.equal(matches.length, 0, 'cycle 374 tempBuff sub-field fallback 0건 보존');
});

// ─── 원본: tests/cycle-376-migrate-data-bounty-fallback-redundant.test.js ───
/**
 * cycle 376: migrateData target.stats bounty fallback 2회 redundant 정리
 *   (cycle 222-375 silent dead config 시리즈 141번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 bounty 정규화 lines:
 *   · target.stats.bountyDate = target.stats.bountyDate || null;
 *   · target.stats.bountyIssued = Boolean(target.stats.bountyIssued);
 * - 모든 consumer가 이미 truthy 체크 또는 strict equality 처리:
 *   · QuestBoardPanel.tsx:67: `player?.stats?.bountyDate === today &&
 *     player?.stats?.bountyIssued` — strict equality + truthy.
 *   · questActions.ts:40: 동일 패턴.
 *   · progressionHandlers.ts:86: `Boolean(prevStats.bountyIssued)` — Boolean coercion.
 * - undefined === today (false), undefined && X (undefined falsy), Boolean(undefined) (false).
 *   모두 null / undefined / false 동일 처리.
 * - cycle 213 회귀 가드 테스트도 `|| null` / `Boolean(...)` 패턴으로 통과.
 *
 * 패턴 (cycle 222-375 silent dead config 시리즈 141번째):
 * - cycle 375: migrateData activeTitle fallback 1 redundant.
 * - cycle 376: migrateData bounty 2 redundant normalizations (동일 lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 bounty fallback lines 제거.
 *
 * 회귀 가드:
 * - QuestBoardPanel / questActions truthy 체크 동작 그대로.
 * - progressionHandlers Boolean coercion 동작 유지.
 * - cycle 213 bounty preserve test 통과.
 * - cycle 119/120/131 stats counter fallback (escapes 등) 보존.
 */


test('cycle 376: migrateData target.stats.bountyDate fallback 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountyDate = target\.stats\.bountyDate/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountyDate fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 376: migrateData Boolean(target.stats.bountyIssued) 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountyIssued = Boolean/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountyIssued = Boolean(...) 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 376: migrateData 동작 보존 (bounty 누락 → undefined, consumer truthy 체크)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({ player: { name: 'test', job: '모험가' } });
    // bountyDate / bountyIssued는 undefined여도 consumer truthy 체크에서 falsy 처리.
    assert.ok(result.player.stats, 'stats 객체 보존');
});

test('cycle 375 회귀 가드: activeTitle fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.activeTitle = target\.activeTitle/gm) || [];
    assert.equal(matches.length, 0, 'cycle 375 activeTitle fallback 0건 보존');
});

// ─── 원본: tests/cycle-377-migrate-data-rests-bounties-fallback-redundant.test.js ───
/**
 * cycle 377: migrateData stats.rests / stats.bountiesCompleted fallback 2회 redundant 정리
 *   (cycle 222-376 silent dead config 시리즈 142번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 2 stats sub-field fallback lines:
 *   · target.stats.rests = target.stats.rests || 0;
 *   · target.stats.bountiesCompleted = target.stats.bountiesCompleted || 0;
 * - 모든 consumer가 이미 `|| 0` fallback 처리:
 *   · stats.rests: 4곳 모두 fallback (runProfile / gameUtils:561 / StatsPanel /
 *     characterActions / progressionHandlers).
 *   · stats.bountiesCompleted: 5곳 모두 fallback (questProgress / questOperations /
 *     gameUtils:597 / StatsPanel / progressionHandlers ASCEND fallback).
 *   · ascensionActions:45 reads `player.stats.bountiesCompleted` 직접 — 그러나 결과는
 *     projectedPlayer로 checkTitles에 전달, 거기서 `|| 0` fallback 처리.
 * - cycle 119/120/131 회귀 가드 테스트는 inject 값 기반 assertion이라 미영향.
 *
 * 패턴 (cycle 222-376 silent dead config 시리즈 142번째):
 * - cycle 376: migrateData bounty 2 redundant normalizations.
 * - cycle 377: migrateData stats.rests / bountiesCompleted 2 redundant (동일 lens).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer `|| 0` fallback 동작 그대로.
 * - cycle 119/120/131 inject-based assertion 통과 (`bountiesCompleted: 8` 등 보존).
 * - 다른 stats counter (escapes/syntheses/maxKillStreak) fallback 보존 (cycle 120
 *   regression 가드).
 */


test('cycle 377: migrateData target.stats.rests fallback (unconditional 블록) 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // v3.1 conditional 블록 (line 347)의 rests fallback은 보존, unconditional 블록 (line 390)만 제거.
    const matches = block.match(/^\s+target\.stats\.rests = target\.stats\.rests \|\| 0/gm) || [];
    assert.equal(matches.length, 1,
        `unconditional rests fallback 0건 (legacy v3.1 conditional만 1건 유지), 발견: ${matches.length}`);
});

test('cycle 377: migrateData target.stats.bountiesCompleted fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.bountiesCompleted = target\.stats\.bountiesCompleted/gm) || [];
    assert.equal(matches.length, 0,
        `target.stats.bountiesCompleted fallback 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 377: migrateData 동작 보존 (정의된 stats 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 10, total_gold: 500, deaths: 0, rests: 5, bountiesCompleted: 8 }
        }
    });
    assert.equal(result.player.stats.rests, 5, 'rests inject 값 보존');
    assert.equal(result.player.stats.bountiesCompleted, 8, 'bountiesCompleted inject 값 보존');
});

test('cycle 376 회귀 가드: bountyDate / Boolean(bountyIssued) fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const dateMatches = block.match(/^\s+target\.stats\.bountyDate = target\.stats\.bountyDate/gm) || [];
    const issuedMatches = block.match(/^\s+target\.stats\.bountyIssued = Boolean/gm) || [];
    assert.equal(dateMatches.length, 0, 'cycle 376 bountyDate 0건 보존');
    assert.equal(issuedMatches.length, 0, 'cycle 376 bountyIssued Boolean 0건 보존');
});

// ─── 원본: tests/cycle-378-migrate-data-fallback-batch-redundant.test.js ───
/**
 * cycle 378: migrateData stats/meta sub-field fallback 8회 redundant 일괄 정리
 *   (cycle 222-377 silent dead config 시리즈 143번째 — cleanup lens 연속).
 *
 * 발견 (8 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 8 sub-field fallback lines:
 *   · target.meta.prestigeRank = target.meta.prestigeRank || 0;
 *   · target.stats.relicCount = target.stats.relicCount || 0;
 *   · target.stats.crafts = target.stats.crafts || 0;
 *   · target.stats.buildWins = ... ? : {};
 *   · target.stats.abyssFloor = target.stats.abyssFloor || 0;
 *   · target.stats.abyssRecord = target.stats.abyssRecord || 0;
 *   · target.stats.demonKingSlain = target.stats.demonKingSlain || 0;
 *   · target.stats.dailyProtocol = target.stats.dailyProtocol || null;
 * - 모든 8 필드 consumer가 이미 fallback / optional chain 처리:
 *   · prestigeRank: 5곳 모두 `|| 0` / `?? 0` fallback.
 *   · relicCount/crafts/abyssFloor: 5곳 fallback + ascensionActions 직접 read는
 *     checkTitles `|| 0` fallback으로 안전.
 *   · abyssRecord/demonKingSlain: 5곳 모두 fallback.
 *   · buildWins: optional chain 안전 (`?.buildWins?.[target] || 0`).
 *   · dailyProtocol: `?.missions` optional chain 안전.
 * - cycle 120/131 회귀 가드 테스트는 escapes/syntheses/maxKillStreak/discoveryChains
 *   4 필드만 migrate output 검증, 본 batch 8 필드는 inject-based 또는 미assert.
 *
 * 패턴 (cycle 222-377 silent dead config 시리즈 143번째):
 * - cycle 377: migrateData stats.rests / bountiesCompleted 2 redundant.
 * - cycle 378: migrateData 8 sub-field fallback 일괄 정리 (가장 큰 batch).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 8 redundant fallback lines 일괄 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback 동작 그대로.
 * - cycle 120/131 (escapes/syntheses/maxKillStreak/discoveryChains) fallback 보존.
 * - cycle 119 inject-based ASCEND preserve test 통과.
 * - 기타 stats.kills/total_gold/deaths/bossKills/killRegistry 객체 자체 init 보존.
 */


test('cycle 378: 8 redundant fallback lines 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const fields = ['prestigeRank', 'relicCount', 'crafts', 'buildWins',
                    'abyssFloor', 'abyssRecord', 'demonKingSlain', 'dailyProtocol'];
    for (const field of fields) {
        const re = new RegExp(`^\\s+target\\.(meta|stats)\\.${field}\\s*=`, 'm');
        assert.ok(!re.test(block), `${field} fallback 0건`);
    }
});

test('cycle 378: 보존 fallback 검증 (escapes/syntheses/maxKillStreak/discoveryChains)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    // cycle 120/131 회귀 가드 — 이 4 필드는 migrate fallback 보존 필수.
    const guardedFields = ['escapes', 'syntheses', 'maxKillStreak', 'discoveryChains'];
    for (const field of guardedFields) {
        const re = new RegExp(`target\\.stats\\.${field}\\s*=`, 'm');
        assert.ok(re.test(block), `${field} fallback 보존 (cycle 120/131 가드)`);
    }
});

test('cycle 378: migrateData 동작 보존 (inject 값 → 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            meta: { prestigeRank: 3 },
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                relicCount: 5, crafts: 8, abyssFloor: 30, abyssRecord: 50,
                demonKingSlain: 2,
            }
        }
    });
    assert.equal(result.player.meta.prestigeRank, 3, 'prestigeRank inject 값 보존');
    assert.equal(result.player.stats.relicCount, 5, 'relicCount inject 값 보존');
    assert.equal(result.player.stats.crafts, 8, 'crafts inject 값 보존');
    assert.equal(result.player.stats.abyssFloor, 30, 'abyssFloor inject 값 보존');
    assert.equal(result.player.stats.abyssRecord, 50, 'abyssRecord inject 값 보존');
    assert.equal(result.player.stats.demonKingSlain, 2, 'demonKingSlain inject 값 보존');
});

test('cycle 377 회귀 가드: rests / bountiesCompleted unconditional fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const restsMatches = block.match(/^\s+target\.stats\.rests = target\.stats\.rests \|\| 0/gm) || [];
    assert.equal(restsMatches.length, 1, 'cycle 377 unconditional rests 0건 (legacy v3.1만 1)');
    const bountiesMatches = block.match(/^\s+target\.stats\.bountiesCompleted = target\.stats\.bountiesCompleted/gm) || [];
    assert.equal(bountiesMatches.length, 0, 'cycle 377 bountiesCompleted 0건 보존');
});

// ─── 원본: tests/cycle-379-migrate-data-claimed-arrays-redundant.test.js ───
/**
 * cycle 379: migrateData claimedAchievements normalization 1회 redundant 정리
 *   (cycle 222-378 silent dead config 시리즈 144번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/dataMigration.ts migrateData에 1 array normalization:
 *   · target.stats.claimedAchievements = Array.isArray(...) ? ... : [];
 * - 모든 consumer가 이미 fallback / Array.isArray 체크 처리:
 *   · AchievementPanel: `player?.stats?.claimedAchievements || []` ✓
 *   · useInventoryActions:366: `player.stats?.claimedAchievements || []` ✓
 *   · progressionHandlers:70: `Array.isArray(prevStats.claimedAchievements) ? : []` ✓
 * - cycle 212/216 회귀 가드 테스트는 inject 값 기반 assertion (post-ASCEND 보존),
 *   migrate output 검증 안 함.
 * - claimedQuestIds는 cycle 260 회귀 가드 테스트가 migrateData output 명시 검증으로
 *   fallback 보존 필수 (시도 후 발견된 가드).
 *
 * 패턴 (cycle 222-378 silent dead config 시리즈 144번째):
 * - cycle 378: migrateData 8 sub-field fallback 일괄 redundant.
 * - cycle 379: claimedAchievements normalization 1 redundant (동일 lens).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - claimedAchievements normalization 1 라인 제거.
 *
 * 회귀 가드:
 * - 모든 consumer Array.isArray / fallback 처리 동작 그대로.
 * - cycle 212/216 inject-based ASCEND preserve test 통과.
 * - cycle 260 claimedQuestIds normalization 보존 (테스트 회귀 가드).
 * - target.stats.visitedMaps 정규화는 직후 `.includes()` / `.push()` 직접 호출에
 *   필요해 보존.
 * - target.stats.exploreState 정규화는 spread 패턴으로 객체 보장에 필요해 보존.
 */


test('cycle 379: claimedAchievements normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.claimedAchievements = Array\.isArray/m.test(block),
        'target.stats.claimedAchievements normalization 0건');
});

test('cycle 379: claimedQuestIds normalization 보존 (cycle 260 회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/target\.stats\.claimedQuestIds = Array\.isArray/.test(block),
        'cycle 260 claimedQuestIds normalization 보존');
});

test('cycle 379: visitedMaps / exploreState 정규화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.stats\.visitedMaps = Array\.isArray/.test(source),
        'visitedMaps 정규화 보존 (직후 .includes/.push 직접 호출 의존)');
    assert.ok(/target\.stats\.exploreState = \{ \.\.\.DEFAULT_EXPLORE_STATE/.test(source),
        'exploreState 정규화 보존 (spread 패턴)');
});

test('cycle 379: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                claimedAchievements: ['ach_test_1'],
                claimedQuestIds: [42, 99],
            }
        }
    });
    assert.deepEqual(result.player.stats.claimedAchievements, ['ach_test_1'],
        'claimedAchievements inject 보존');
    assert.deepEqual(result.player.stats.claimedQuestIds, [42, 99],
        'claimedQuestIds inject 보존 (cycle 260 가드)');
});

test('cycle 378 회귀 가드: 8 sub-field fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const fields = ['prestigeRank', 'relicCount', 'crafts', 'buildWins',
                    'abyssFloor', 'abyssRecord', 'demonKingSlain', 'dailyProtocol'];
    for (const field of fields) {
        const re = new RegExp(`^\\s+target\\.(meta|stats)\\.${field}\\s*=`, 'm');
        assert.ok(!re.test(block), `cycle 378 ${field} fallback 0건 보존`);
    }
});

// ─── 원본: tests/cycle-381-migrate-data-status-skillloadout-redundant.test.js ───
/**
 * cycle 381: migrateData status / skillLoadout.selected normalizations 2회 redundant 정리
 *   (cycle 222-380 silent dead config 시리즈 145번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/dataMigration.ts migrateData에 2 normalizations:
 *   · target.status = Array.isArray(target.status) ? target.status : [];
 *   · target.skillLoadout.selected = Number.isInteger(target.skillLoadout.selected)
 *     ? target.skillLoadout.selected : 0;
 * - 모든 consumer가 이미 동일 패턴 fallback 처리:
 *   · player.status:
 *     - playerStateUtils:52: `Array.isArray(player?.status) && player.status.length > 0` ✓
 *     - adventureGuide:284: `Array.isArray(player?.status) && ...` ✓
 *     - exploreUtils:94: `[...(p.status || []), ...]` — `|| []` fallback ✓
 *     - StatusBar:166: `Array.isArray(player.status) && ...` ✓
 *     - useInventoryActions:144 / combatItem:37: `toArray(player.status)` ✓
 *     - CombatEngine:438: `Array.isArray(player.status) ? : []` ✓
 *   · player.skillLoadout.selected:
 *     - getSelectedSkill: `Number.isInteger(player.skillLoadout?.selected) ? : 0` ✓
 *     - characterActions:46: 동일 패턴 ✓
 *
 * 패턴 (cycle 222-380 silent dead config 시리즈 145번째):
 * - cycle 379: claimedAchievements normalization 1 redundant.
 * - cycle 381: status / skillLoadout.selected 2 redundant (동일 lens 재개).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer Array.isArray / Number.isInteger 패턴 동작 그대로.
 * - target.skillLoadout.cooldowns 정규화 보존 (CombatEngine 직접 assign 의존).
 * - target.skillLoadout 객체 자체 init 보존.
 */


test('cycle 381: target.status normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.status = Array\.isArray\(target\.status\)/m.test(block),
        'target.status normalization 0건');
});

test('cycle 381: target.skillLoadout.selected normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillLoadout\.selected = Number\.isInteger/m.test(block),
        'target.skillLoadout.selected normalization 0건');
});

test('cycle 381: skillLoadout 객체 init / cooldowns 정규화 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.skillLoadout = target\.skillLoadout \|\| \{ selected: 0, cooldowns: \{\} \}/.test(source),
        'target.skillLoadout 객체 init 보존');
    assert.ok(/target\.skillLoadout\.cooldowns = target\.skillLoadout\.cooldowns \|\| \{\}/.test(source),
        'target.skillLoadout.cooldowns 정규화 보존 (CombatEngine 직접 assign 의존)');
});

test('cycle 381: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            status: ['burn', 'poison'],
            skillLoadout: { selected: 2, cooldowns: { '강타': 1 } },
        }
    });
    assert.deepEqual(result.player.status, ['burn', 'poison'],
        'status inject 보존');
    assert.equal(result.player.skillLoadout.selected, 2,
        'skillLoadout.selected inject 보존');
});

test('cycle 379 회귀 가드: claimedAchievements normalization 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.claimedAchievements = Array\.isArray/m.test(block),
        'cycle 379 claimedAchievements normalization 0건 보존');
});

// ─── 원본: tests/cycle-382-migrate-data-relics-titles-redundant.test.js ───
/**
 * cycle 382: migrateData target.relics / target.titles normalizations 2회 redundant 정리
 *   (cycle 222-381 silent dead config 시리즈 146번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/gameUtils.ts migrateData에 2 array normalizations:
 *   · target.relics = Array.isArray(target.relics) ? target.relics : [];
 *   · target.titles = Array.isArray(target.titles) ? target.titles : [];
 * - 모든 consumer가 이미 fallback 처리:
 *   · player.relics:
 *     - statsCalculator: `player.relics || []` ✓
 *     - gameUtils:672: `player.relics?.length || 0` ✓
 *     - SystemTab:262/263: `(player.relics || []).length` / optional chain ✓
 *     - SystemTab:298/301/304: 298 line 가드 후 .length/.map (line 301/304는 가드 의존)
 *     - CombatPanel:90: `player.relics?.find(...)` ✓
 *   · player.titles:
 *     - gameUtils:555: `new Set(player.titles || [])` ✓
 *     - SystemTab:113/267/315: `player.titles || []` ✓
 *     - SystemTab:317/325: 315 line 가드 후 .length/.map
 *     - useInventoryActions:504: `Array.isArray(p.titles) ? p.titles : []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건 (inject-based assertion만).
 *
 * 패턴 (cycle 222-381 silent dead config 시리즈 146번째):
 * - cycle 381: status / skillLoadout.selected 2 redundant.
 * - cycle 382: relics / titles 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant array normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback 동작 그대로.
 * - target.relics / target.titles는 INITIAL_STATE에서 [] 초기화 (신규 플레이어).
 * - SystemTab 가드 패턴 (`(player.relics || []).length > 0` 등) 의존.
 */


test('cycle 382: target.relics normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.relics = Array\.isArray\(target\.relics\)/m.test(block),
        'target.relics normalization 0건');
});

test('cycle 382: target.titles normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.titles = Array\.isArray\(target\.titles\)/m.test(block),
        'target.titles normalization 0건');
});

test('cycle 382: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            relics: [{ id: 'blood_pact', name: '피의 서약' }],
            titles: ['first_blood', 'centurion'],
        }
    });
    assert.equal(result.player.relics.length, 1, 'relics inject 보존');
    assert.deepEqual(result.player.titles, ['first_blood', 'centurion'],
        'titles inject 보존');
});

test('cycle 381 회귀 가드: status / skillLoadout.selected normalizations 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.status = Array\.isArray/m.test(block),
        'cycle 381 status normalization 0건 보존');
    assert.ok(!/^\s+target\.skillLoadout\.selected = Number\.isInteger/m.test(block),
        'cycle 381 skillLoadout.selected normalization 0건 보존');
});

// ─── 원본: tests/cycle-383-migrate-data-codex-cosmetic-arrays-redundant.test.js ───
/**
 * cycle 383: migrateData codexClaimed normalization 1회 redundant 정리
 *   (cycle 222-382 silent dead config 시리즈 147번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/dataMigration.ts migrateData에 1 array normalization:
 *   · target.stats.codexClaimed = Array.isArray(...) ? ... : [];
 * - 모든 consumer가 이미 fallback 처리:
 *   · Codex.tsx:39: `player?.stats?.codexClaimed || []` ✓
 *   · rewardHandlers:68: `state.player.stats?.codexClaimed || []` ✓
 *   · progressionHandlers:67: `Array.isArray(prevStats.codexClaimed) ? : []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 * - cosmeticTitles는 cycle 189 회귀 가드 (`assert.deepEqual(stats.cosmeticTitles, [])`)로
 *   fallback 보존 필수 (시도 후 발견된 가드).
 *
 * 패턴 (cycle 222-382 silent dead config 시리즈 147번째):
 * - cycle 382: relics / titles normalizations 2 redundant.
 * - cycle 383: codexClaimed normalization 1 redundant (동일 lens, cosmeticTitles 가드 발견).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - codexClaimed normalization 1 라인 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback / Array.isArray 동작 그대로.
 * - cosmeticTitles 정규화 보존 (cycle 189 migrate output 가드).
 * - reviveTokens / synthProtects Math.max(0, ...) 정규화 보존 (negative 클램핑 의존).
 * - premiumCurrency `|| 0` 보존 (StatusBar 직접 표시 의존).
 * - claimedQuestIds / visitedMaps / exploreState 기존 보존 가드 유지.
 */


test('cycle 383: target.stats.codexClaimed normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.codexClaimed = Array\.isArray/m.test(block),
        'target.stats.codexClaimed normalization 0건');
});

test('cycle 383: target.stats.cosmeticTitles normalization 보존 (cycle 189 회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(/target\.stats\.cosmeticTitles = Array\.isArray/.test(block),
        'cycle 189 cosmeticTitles normalization 보존');
});

test('cycle 383: 보존되어야 할 정규화 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    // reviveTokens / synthProtects는 Math.max(0, ...) 보존 — 음수 클램핑 필요.
    assert.ok(/target\.reviveTokens = Math\.max\(0, Number/.test(source),
        'reviveTokens Math.max 보존 (음수 클램핑)');
    assert.ok(/target\.stats\.synthProtects = Math\.max\(0, Number/.test(source),
        'synthProtects Math.max 보존 (음수 클램핑)');
    assert.ok(/target\.premiumCurrency = target\.premiumCurrency \|\| 0/.test(source),
        'premiumCurrency `|| 0` 보존 (StatusBar 직접 표시)');
});

test('cycle 383: migrateData 동작 보존 (inject 배열 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                codexClaimed: ['weapons_5', 'monsters_10'],
                cosmeticTitles: ['title_stargazer'],
            }
        }
    });
    assert.deepEqual(result.player.stats.codexClaimed, ['weapons_5', 'monsters_10'],
        'codexClaimed inject 보존');
    assert.deepEqual(result.player.stats.cosmeticTitles, ['title_stargazer'],
        'cosmeticTitles inject 보존 (cycle 189 가드)');
});

test('cycle 382 회귀 가드: relics / titles normalizations 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.relics = Array\.isArray/m.test(block),
        'cycle 382 relics normalization 0건 보존');
    assert.ok(!/^\s+target\.titles = Array\.isArray/m.test(block),
        'cycle 382 titles normalization 0건 보존');
});

// ─── 원본: tests/cycle-384-migrate-data-areaboss-deathsave-redundant.test.js ───
/**
 * cycle 384: migrateData areaBossDefeated / deathSaveUsedCount fallback 2회 redundant 정리
 *   (cycle 222-383 silent dead config 시리즈 148번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/dataMigration.ts migrateData에 2 fallbacks:
 *   · target.stats.areaBossDefeated = target.stats.areaBossDefeated || {};
 *   · target.combatFlags.deathSaveUsedCount = target.combatFlags.deathSaveUsedCount || 0;
 * - 모든 consumer가 이미 fallback / optional chain 처리:
 *   · stats.areaBossDefeated:
 *     - exploreUtils:148: `player.stats?.areaBossDefeated?.[areaBossName]` — optional chain ✓
 *     - combatVictory:173: `(p.stats.areaBossDefeated || {})` — fallback ✓
 *   · combatFlags.deathSaveUsedCount:
 *     - CombatEngine:92: `flags.deathSaveUsedCount || 0` — fallback ✓
 *     - CombatEngine:105: `reviveUsedCount + 1` — local var (이미 `|| 0` 적용)
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-383 silent dead config 시리즈 148번째):
 * - cycle 383: codexClaimed normalization 1 redundant.
 * - cycle 384: areaBossDefeated / deathSaveUsedCount 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer optional chain / `|| {}` / `|| 0` 동작 그대로.
 * - target.combatFlags 객체 자체 init 보존 (line 421-426).
 * - target.eventChainProgress 객체 init 보존 (직후 추가 코드 의존 가능).
 */


test('cycle 384: target.stats.areaBossDefeated fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.areaBossDefeated = target\.stats\.areaBossDefeated/m.test(block),
        'target.stats.areaBossDefeated fallback 0건');
});

test('cycle 384: target.combatFlags.deathSaveUsedCount fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.combatFlags\.deathSaveUsedCount = target\.combatFlags\.deathSaveUsedCount/m.test(block),
        'target.combatFlags.deathSaveUsedCount fallback 0건');
});

test('cycle 384: combatFlags 객체 init / eventChainProgress init 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/target\.combatFlags = \{[\s\S]*comboCount: 0,[\s\S]*deathSaveUsed: false,/.test(source),
        'target.combatFlags 객체 init 보존');
    assert.ok(/target\.eventChainProgress = \{\}/.test(source),
        'target.eventChainProgress 객체 init 보존');
});

test('cycle 384: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 10, total_gold: 500, deaths: 0,
                areaBossDefeated: { '용의 둥지의 보스': true },
            },
        }
    });
    assert.deepEqual(result.player.stats.areaBossDefeated, { '용의 둥지의 보스': true },
        'areaBossDefeated inject 보존');
});

test('cycle 383 회귀 가드: codexClaimed normalization 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.codexClaimed = Array\.isArray/m.test(block),
        'cycle 383 codexClaimed normalization 0건 보존');
});

// ─── 원본: tests/cycle-385-migrate-data-discoverychains-duplicate.test.js ───
/**
 * cycle 385: migrateData discoveryChains normalization 중복 1회 redundant 정리
 *   (cycle 222-384 silent dead config 시리즈 149번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant duplicate normalization):
 * - src/utils/dataMigration.ts migrateData에 동일한 discoveryChains 정규화가 2곳에 존재:
 *   · 라인 440 (cycle 120 영역): `target.stats.discoveryChains = Array.isArray(...) ? ... : []`
 *   · 라인 522 (v5.0 발견 체인 영역): 동일 코드 중복.
 * - 두 라인 모두 동일 함수 내 unconditional block — 첫 번째 라인이 이미 정규화 완료.
 *   두 번째 라인은 noop (`Array.isArray([]) ? [] : []`).
 * - cycle 120/131 회귀 가드 테스트는 첫 번째 라인의 정규화 결과만 검증 가능.
 *
 * 패턴 (cycle 222-384 silent dead config 시리즈 149번째):
 * - cycle 384: areaBossDefeated / deathSaveUsedCount 2 redundant.
 * - cycle 385: discoveryChains duplicate normalization 1 redundant
 *   (defensive fallback redundancy lens 변형 — duplicate detection).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 두 번째 (line 522) discoveryChains normalization 제거.
 *
 * 회귀 가드:
 * - 첫 번째 (line 440) discoveryChains normalization 보존 (cycle 120/131 회귀 가드).
 * - migrateData output `stats.discoveryChains === []` 동일 결과.
 */


test('cycle 385: discoveryChains normalization 1회만 (중복 제거)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.discoveryChains = Array\.isArray/gm) || [];
    assert.equal(matches.length, 1,
        `discoveryChains normalization 1회만, 발견: ${matches.length}`);
});

test('cycle 385: migrateData 동작 보존 (cycle 120/131 회귀 가드)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // 1) 빈 stats → discoveryChains 빈 배열 default.
    const result1 = migrateData({
        player: { name: 'test', job: '모험가', stats: { kills: 0, total_gold: 0, deaths: 0 } }
    });
    assert.deepEqual(result1.player.stats.discoveryChains, [],
        '구버전 save → discoveryChains 빈 배열 default (cycle 120 회귀 가드)');
    // 2) inject 값 보존.
    const result2 = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 0, total_gold: 0, deaths: 0, discoveryChains: ['fire_convergence'] }
        }
    });
    assert.deepEqual(result2.player.stats.discoveryChains, ['fire_convergence'],
        'discoveryChains inject 보존');
    // 3) 비배열 → 빈 배열로 정규화.
    const result3 = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: { kills: 0, total_gold: 0, deaths: 0, discoveryChains: 'invalid' }
        }
    });
    assert.deepEqual(result3.player.stats.discoveryChains, [],
        '비배열 → 빈 배열로 정규화 (cycle 120 회귀 가드)');
});

test('cycle 384 회귀 가드: areaBossDefeated / deathSaveUsedCount fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.areaBossDefeated = target\.stats\.areaBossDefeated/m.test(block),
        'cycle 384 areaBossDefeated fallback 0건 보존');
    assert.ok(!/^\s+target\.combatFlags\.deathSaveUsedCount = target\.combatFlags\.deathSaveUsedCount/m.test(block),
        'cycle 384 deathSaveUsedCount fallback 0건 보존');
});

// ─── 원본: tests/cycle-386-migrate-data-daily-invade-redundant.test.js ───
/**
 * cycle 386: migrateData dailyInvadeCount / lastInvadeDate fallback 2회 redundant 정리
 *   (cycle 222-385 silent dead config 시리즈 150번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive fallbacks):
 * - src/utils/gameUtils.ts migrateData에 2 fallbacks:
 *   · target.stats.dailyInvadeCount = target.stats.dailyInvadeCount || 0;
 *   · target.stats.lastInvadeDate = target.stats.lastInvadeDate || null;
 * - 모든 consumer가 이미 fallback / 안전 비교 처리:
 *   · stats.dailyInvadeCount:
 *     - GravePanel:26: `(player?.stats?.dailyInvadeCount || 0)` ✓
 *     - useInventoryActions:589: `(player.stats?.dailyInvadeCount || 0)` ✓
 *     - multiplayerHandlers:24: `(state.player.stats?.dailyInvadeCount || 0)` ✓
 *   · stats.lastInvadeDate:
 *     - GravePanel:25: `player?.stats?.lastInvadeDate` (이후 strict equal 비교) ✓
 *     - useInventoryActions:588: 동일 패턴 ✓
 *     - multiplayerHandlers:23: 동일 패턴 ✓
 *     - undefined === today (false), null === today (false) — 동일 처리.
 * - cycle 216 회귀 가드 테스트는 inject 값 기반 assertion (post-ASCEND 보존),
 *   migrate output default 검증 안 함.
 *
 * 패턴 (cycle 222-385 silent dead config 시리즈 150번째):
 * - cycle 385: discoveryChains duplicate normalization 1 redundant.
 * - cycle 386: dailyInvadeCount / lastInvadeDate 2 redundant (defensive fallback lens).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 2 redundant fallback lines 제거.
 *
 * 회귀 가드:
 * - 모든 consumer fallback / strict equal 비교 동작 그대로.
 * - cycle 216 inject-based ASCEND preserve test 통과.
 */


test('cycle 386: target.stats.dailyInvadeCount fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.dailyInvadeCount = target\.stats\.dailyInvadeCount/m.test(block),
        'target.stats.dailyInvadeCount fallback 0건');
});

test('cycle 386: target.stats.lastInvadeDate fallback 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.lastInvadeDate = target\.stats\.lastInvadeDate/m.test(block),
        'target.stats.lastInvadeDate fallback 0건');
});

test('cycle 386: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            stats: {
                kills: 0, total_gold: 0, deaths: 0,
                dailyInvadeCount: 3, lastInvadeDate: '2026-05-09',
            },
        }
    });
    assert.equal(result.player.stats.dailyInvadeCount, 3,
        'dailyInvadeCount inject 보존');
    assert.equal(result.player.stats.lastInvadeDate, '2026-05-09',
        'lastInvadeDate inject 보존');
});

test('cycle 385 회귀 가드: discoveryChains normalization 1회만 (중복 제거)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/^\s+target\.stats\.discoveryChains = Array\.isArray/gm) || [];
    assert.equal(matches.length, 1, 'cycle 385 discoveryChains normalization 1회만 보존');
});

// ─── 원본: tests/cycle-387-migrate-data-skillchoices-challenge-redundant.test.js ───
/**
 * cycle 387: migrateData skillChoices / challengeModifiers normalizations 2회 redundant 정리
 *   (cycle 222-386 silent dead config 시리즈 151번째 — cleanup lens 연속).
 *
 * 발견 (2 redundant defensive normalizations):
 * - src/utils/dataMigration.ts migrateData에 2 normalizations:
 *   · target.skillChoices = target.skillChoices && typeof ... === 'object' ? : {};
 *   · target.challengeModifiers = Array.isArray(target.challengeModifiers) ? : [];
 * - 모든 consumer가 이미 fallback / optional chain 처리:
 *   · skillChoices:
 *     - SkillTreePreview:186/379: `player.skillChoices?.[skill.name]` ✓
 *     - characterActions:107: `player.skillChoices?.[skillName] || '기본'` ✓
 *     - characterActions:113: `{ ...(p.skillChoices || {}), [skillName]: ... }` ✓
 *     - CombatEngine:683: `player.skillChoices?.[skill.name]` ✓
 *     - multiplayerHandlers:11: `{ ...(state.player.skillChoices || {}), ... }` ✓
 *   · challengeModifiers:
 *     - exploreUtils:198: `player.challengeModifiers?.includes('eliteOnly')` ✓
 *     - StatusBar:156: `player.challengeModifiers?.includes('blindMap')` ✓
 *     - useInventoryActions:107: `player.challengeModifiers?.includes('noPotion')` ✓
 *     - combatAttack:32: `playerAtActionStart.challengeModifiers?.includes('randomSkills')` ✓
 *     - characterActions:20: `Array.isArray(challengeModifiers) ? : []` ✓
 *     - CombatEngine:1421: `p.challengeModifiers || []` ✓
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-386 silent dead config 시리즈 151번째):
 * - cycle 386: dailyInvadeCount / lastInvadeDate 2 redundant.
 * - cycle 387: skillChoices / challengeModifiers 2 redundant (동일 lens 연속).
 *
 * 수정 (src/utils/dataMigration.ts):
 * - 2 redundant normalizations 제거.
 *
 * 회귀 가드:
 * - 모든 consumer optional chain / `|| []` / `|| {}` 동작 그대로.
 * - target.weeklyProtocol 객체 init은 보존 (`if (!target.weeklyProtocol) { ... }`).
 */


test('cycle 387: target.skillChoices normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillChoices = target\.skillChoices/m.test(block),
        'target.skillChoices normalization 0건');
});

test('cycle 387: target.challengeModifiers normalization 0건', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.challengeModifiers = Array\.isArray/m.test(block),
        'target.challengeModifiers normalization 0건');
});

test('cycle 387: target.weeklyProtocol 객체 init 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    assert.ok(/if \(!target\.weeklyProtocol\)/.test(source),
        'target.weeklyProtocol 객체 init 보존');
});

test('cycle 387: migrateData 동작 보존 (inject 값 보존)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    const result = migrateData({
        player: {
            name: 'test', job: '모험가',
            skillChoices: { '강타': 'A' },
            challengeModifiers: ['halfHp', 'noGold'],
        }
    });
    assert.deepEqual(result.player.skillChoices, { '강타': 'A' },
        'skillChoices inject 보존');
    assert.deepEqual(result.player.challengeModifiers, ['halfHp', 'noGold'],
        'challengeModifiers inject 보존');
});

test('cycle 386 회귀 가드: dailyInvadeCount / lastInvadeDate fallback 0건 보존', async () => {
    const source = await readSrc('src/utils/dataMigration.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.stats\.dailyInvadeCount = target\.stats\.dailyInvadeCount/m.test(block),
        'cycle 386 dailyInvadeCount fallback 0건 보존');
    assert.ok(!/^\s+target\.stats\.lastInvadeDate = target\.stats\.lastInvadeDate/m.test(block),
        'cycle 386 lastInvadeDate fallback 0건 보존');
});

// ─── 원본: tests/cycle-388-migrate-data-killstreak-redundant.test.js ───
/**
 * cycle 388: migrateData killStreak normalization redundant 정리
 *   (cycle 222-387 silent dead config 시리즈 152번째 — cleanup lens 연속).
 *
 * 발견 (1 redundant defensive normalization):
 * - src/utils/gameUtils.ts migrateData에 3-line if 블록:
 *   `if (typeof target.killStreak !== 'number') { target.killStreak = 0; }`
 * - 모든 consumer가 이미 fallback 처리:
 *   · statsCalculator:378: `computeKillStreakBonus(player.killStreak || 0)` ✓
 *   · statsCalculator:413: `killStreak: player.killStreak || 0` ✓
 *   · StatusBar:159: `(player.killStreak || 0) >= 3` ✓
 *   · StatusBar:160: `{player.killStreak}` (gated by 159 truthy)
 * - 회귀 가드 테스트가 migrate output 명시 검증 0건.
 *
 * 패턴 (cycle 222-387 silent dead config 시리즈 152번째):
 * - cycle 387: skillChoices / challengeModifiers 2 redundant.
 * - cycle 388: killStreak `if (typeof !== number)` 3-line block redundant.
 *
 * 수정 (src/utils/gameUtils.ts):
 * - 3-line if 블록 제거.
 *
 * 회귀 가드:
 * - 모든 consumer `player.killStreak || 0` fallback 동작 그대로.
 * - 비숫자 값(string 등) 코너케이스: `string || 0` = string (truthy), 이후
 *   비교 (`>= 3`)에서 NaN → false 반환으로 안전 (crash 없음).
 */


test('cycle 388: migrateData killStreak normalization 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/typeof target\.killStreak !== 'number'/.test(block),
        'migrateData killStreak normalization 0건');
});

test('cycle 388: migrateData 동작 보존 (inject 값 / 누락 케이스)', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.js');
    // inject 값 보존.
    const result1 = migrateData({
        player: { name: 'test', job: '모험가', killStreak: 5 }
    });
    assert.equal(result1.player.killStreak, 5, 'killStreak inject 값 보존');
    // 누락 → undefined (consumer fallback `|| 0` 처리).
    const result2 = migrateData({
        player: { name: 'test', job: '모험가' }
    });
    // killStreak이 undefined여도 게임 정상 동작 (consumer level fallback).
    assert.ok(result2.player, 'player 객체 보존');
});

test('cycle 387 회귀 가드: skillChoices / challengeModifiers 0건 보존', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnStart = source.indexOf('export const migrateData');
    const fnEnd = source.indexOf('export const checkTitles');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/^\s+target\.skillChoices = target\.skillChoices/m.test(block),
        'cycle 387 skillChoices normalization 0건 보존');
    assert.ok(!/^\s+target\.challengeModifiers = Array\.isArray/m.test(block),
        'cycle 387 challengeModifiers normalization 0건 보존');
});
