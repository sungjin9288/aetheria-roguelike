import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrateData, hasMigratedPlayer } from '../src/utils/dataMigration.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { getGraveItems } from '../src/utils/graveUtils.ts';

/**
 * W10-B2 — 세이브 호환 왕복.
 *
 * `tests/fixtures/saves/v*.json` 은 각 `CONSTANTS.DATA_VERSION` 시점에 실제로 존재했을
 * 세이브 봉투(envelope) 모양을 dataMigration.ts의 필드별 분기(각 `if (!x) x = ...`가
 * "그 필드가 그 시점엔 없었다"를 증언한다)와 기존 테스트 fixture 군집(tests/data-migration.test.js
 * 등이 즐겨 쓰는 version:5.0/1/2/4.0/9/99)에서 재구성했다. 각 파일의 `_note` 키가 재구성 근거와
 * 불확실한 부분을 밝힌다 — `stripNote()`로 실제 마이그레이션 입력에서 제거한다.
 *
 * 이 스위트가 확인하는 것은 두 단계다:
 *   1. `migrateData()` 자체의 불변식(quickSlots 3칸, version>=2.7, essenceLifetime 역산 등).
 *   2. 그 결과를 `AT.LOAD_DATA` 로 리듀서에 태울 때만 성립하는 완전성
 *      (`state.player` 가 `INITIAL_STATE.player` 의 모든 키를 갖는다) — migrateData 원시
 *      출력만으로는 이게 보장되지 않는다는 것 자체가 이 트랙의 핵심 실측 발견이다(§3 참조).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, 'fixtures', 'saves');

const readFixture = async (label) => {
    const raw = JSON.parse(await readFile(path.join(FIXTURES_DIR, `v${label}.json`), 'utf8'));
    const { _note, ...fixture } = raw;
    return fixture;
};

const stripVolatile = (value) => {
    const clone = JSON.parse(JSON.stringify(value));
    delete clone.savedAt;
    if (clone.player) delete clone.player.lastSeenAt;
    return clone;
};

const dispatchLoadData = (migrated) => gameReducer(INITIAL_STATE, {
    type: AT.LOAD_DATA,
    payload: {
        player: migrated.player,
        gameState: migrated.gameState,
        enemy: migrated.enemy ?? null,
        grave: migrated.grave ?? null,
        currentEvent: migrated.currentEvent ?? null,
        quickSlots: migrated.quickSlots,
    },
});

/** 버전 라벨 → 파일명 접미사. `_note`가 재구성 근거를 담는다(§13.1 Wave 10 B2). */
const VERSION_LABELS = ['1', '2', '2.7', '4.0', '5', '5.0', '5.1'];

/**
 * `player.status` 가 배열로 남는지 여부 — migrateData는 "스칼라면 1원소 배열로 승격,
 * 배열이거나 **아예 없으면 손대지 않는다**"(주석 W2/Wave 5)이므로, status를 전혀 쓰지 않은
 * 레거시 픽스처(v1/v2.7/v4.0/v5)는 이 라운드트립 이후에도 `undefined`로 남는다.
 * 이것은 버그가 아니라 실측된 현재 동작이다 — TODO(B2 finding): "player.status는 항상
 * 배열"이라는 소비자 가정은 migrateData 원시 출력에는 적용되지 않고, LOAD_DATA가
 * `INITIAL_STATE.player.status = []` 기본값으로 덮어써야만 성립한다.
 */
const STATUS_ARRAY_ON_RAW_OUTPUT = {
    '1': false,
    '2': true, // 스칼라 'poison' → ['poison']로 승격되는 경로를 이 픽스처가 실측한다.
    '2.7': false,
    '4.0': false,
    '5': false,
    '5.0': true, // 이미 배열([])로 저장돼 있던 경우 — 그대로 보존.
    '5.1': true, // 이미 배열(['poison'])로 저장돼 있던 경우 — 그대로 보존.
};

/** meta.essenceLifetime 역산 백필의 결정론적 기대값(§ mirror.ts MIRROR_NODES.start_gold.costs 실측). */
const EXPECTED_ESSENCE_LIFETIME = {
    '1': 0,
    '2': 0,
    '2.7': 0,
    '4.0': 40, // meta.essence=40, mirror 없음(→{}) → 지출 0.
    '5': 300, // meta.essence=300, mirror={} → 지출 0.
    '5.0': 230, // meta.essence=50 + start_gold Lv2 지출(60+120=180) = 230.
    '5.1': 680, // 이미 저장된 값 — 백필 분기(typeof !== 'number' 가드)를 타지 않고 보존.
};

test('migrateData: 7개 버전 픽스처 모두 player 슬롯을 가진 유효한 MigratedSave를 낸다', async () => {
    for (const label of VERSION_LABELS) {
        const fixture = await readFixture(label);
        const migrated = migrateData(fixture);
        assert.ok(migrated, `v${label}: migrateData가 null을 반환함`);
        assert.equal(hasMigratedPlayer(migrated), true, `v${label}: hasMigratedPlayer가 false`);
    }
});

test('migrateData: quickSlots는 항상 정확히 3칸(모자라면 null 패딩, 넘치면 절단)', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        assert.equal(migrated.quickSlots.length, 3, `v${label}`);
        assert.ok(Array.isArray(migrated.quickSlots), `v${label}`);
    }
});

test('migrateData: version은 항상 2.7 이상으로 정규화된다', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        assert.ok(Number(migrated.version) >= 2.7, `v${label}: version=${migrated.version}`);
    }
});

test('migrateData: meta.essenceLifetime은 결정론적으로 역산 백필되거나(구세이브) 보존된다(v5.1)', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        assert.equal(
            migrated.player.meta.essenceLifetime,
            EXPECTED_ESSENCE_LIFETIME[label],
            `v${label}`,
        );
    }
});

test('migrateData: player.status — 배열/스칼라는 정규화되지만 완전히 없으면 방치된다 (TODO(B2 finding))', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        const expectArray = STATUS_ARRAY_ON_RAW_OUTPUT[label];
        if (expectArray) {
            assert.ok(Array.isArray(migrated.player.status), `v${label}: status가 배열이 아님`);
        } else {
            // 현재 동작 그대로 — status 키 자체가 없던 세이브는 migrateData 이후에도 undefined다.
            // LOAD_DATA를 거쳐야만(§ 아래 completeness 테스트) []로 채워진다.
            assert.equal(migrated.player.status, undefined, `v${label}: status가 예상과 다르게 채워짐(finding이 stale해졌을 수 있음)`);
        }
    }
});

test('migrateData: 원시 출력은 레거시 세이브의 INITIAL_STATE.player 완전성을 보장하지 않는다 (TODO(B2 finding))', async () => {
    // migrateData는 achievements/skillChoices/challengeModifiers/status/relics/titles/
    // activeTitle/killStreak를 전혀 정규화하지 않는다(코드에 해당 대입문이 없다 — cycle
    // 375/382/387/388 주석이 "정규화 제거"라고만 밝힌다). 그래서 이 8개 필드가 원래
    // 없던 레거시 세이브는 migrateData 이후에도 여전히 없다. v5.0/v5.1 픽스처는 실제
    // 최신 클라이언트가 항상 player 전체를 직렬화한다는 사실(createCloudAutosave.ts)에
    // 근거해 이 필드들을 이미 채워 넣었으므로 여기서는 빈 배열이 나온다.
    const LEGACY_MISSING = ['achievements', 'skillChoices', 'challengeModifiers', 'status', 'relics', 'titles', 'activeTitle', 'killStreak'];
    const expectations = {
        '1': LEGACY_MISSING,
        '2': LEGACY_MISSING.filter((key) => key !== 'status'), // v2는 status를 스칼라로 갖고 있어 승격된다.
        '2.7': LEGACY_MISSING,
        '4.0': LEGACY_MISSING,
        '5': LEGACY_MISSING,
        '5.0': [],
        '5.1': [],
    };
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        const missing = Object.keys(INITIAL_STATE.player)
            .filter((key) => migrated.player[key] === undefined);
        assert.deepEqual(missing.sort(), [...expectations[label]].sort(), `v${label}`);
    }
});

test('LOAD_DATA: 리듀서를 거치면 모든 버전에서 state.player가 INITIAL_STATE.player의 모든 키를 갖는다', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        const state = dispatchLoadData(migrated);
        const missing = Object.keys(INITIAL_STATE.player)
            .filter((key) => state.player[key] === undefined);
        assert.deepEqual(missing, [], `v${label}: LOAD_DATA 이후에도 누락된 키 발견 — ${missing.join(', ')}`);
    }
});

test('LOAD_DATA: quickSlots는 인벤토리에 없는 참조를 null로 새니타이즈한다 (v5.1: 오래된 참조)', async () => {
    const migrated = migrateData(await readFixture('5.1'));
    // 픽스처 자체(migrateData 원시 출력)에는 stale 참조가 그대로 남아있다 — quickSlots
    // 새니타이즈는 migrateData의 책무가 아니라 LOAD_DATA(sanitizeQuickSlots)의 책무다.
    assert.equal(migrated.quickSlots[0]?.id, 'stale-quickslot-item');
    assert.ok(!migrated.player.inv.some((item) => item.id === 'stale-quickslot-item'));

    const state = dispatchLoadData(migrated);
    assert.deepEqual(state.quickSlots, [null, null, null]);
});

test('LOAD_DATA: quickSlots는 인벤토리에 남아있는 참조는 보존한다 (v2: 3칸 패딩 + 보존)', async () => {
    const migrated = migrateData(await readFixture('2'));
    const state = dispatchLoadData(migrated);
    assert.equal(state.quickSlots.length, 3);
    assert.equal(state.quickSlots[0]?.id, 'legacy-1');
    assert.deepEqual(state.quickSlots.slice(1), [null, null]);
});

test('grave: migrateData는 구형 단수 grave.item을 정규화하지 않는다 — getGraveItems가 소비 시점에 흡수한다 (TODO(B2 finding))', async () => {
    const migrated = migrateData(await readFixture('2'));
    // 현재 동작: migrateData/LOAD_DATA 어느 쪽도 grave를 만지지 않는다(§8-2 호환은
    // graveUtils.getGraveItems의 런타임 흡수에만 있다). 이 단언이 "왜 items 배열이
    // 안 생기는가"를 의도적으로 고정한다 — 미래에 migrateData가 grave를 정규화하게
    // 되면 이 테스트를 의식적으로 갱신해야 한다.
    assert.ok(migrated.grave.item, 'v2: grave.item(구형 단수)이 사라짐');
    assert.equal(migrated.grave.items, undefined, 'v2: grave.items가 생성됨 — finding이 stale해졌을 수 있음');
    // 하지만 소비 계약(getGraveItems)은 단수/복수 어느 쪽이든 올바르게 동작해야 한다.
    assert.deepEqual(getGraveItems(migrated.grave), [migrated.grave.item]);

    const state = dispatchLoadData(migrated);
    assert.deepEqual(state.grave, migrated.grave);
    assert.deepEqual(getGraveItems(state.grave), [migrated.grave.item]);
});

test('grave: 신형 복수 grave.items[]는 그대로 왕복하고 getGraveItems도 동일 결과를 낸다 (v5.1)', async () => {
    const migrated = migrateData(await readFixture('5.1'));
    assert.ok(Array.isArray(migrated.grave.items));
    assert.equal(migrated.grave.item, undefined);
    assert.deepEqual(getGraveItems(migrated.grave), migrated.grave.items);

    const state = dispatchLoadData(migrated);
    assert.deepEqual(getGraveItems(state.grave), migrated.grave.items);
});

test('migrateData: 특정 정규화 결과를 실측값으로 고정한다 (v4.0 combatFlags/원시의 파편 역산, v5.0 퀘스트 누적 진행)', async () => {
    const v40 = migrateData(await readFixture('4.0'));
    // voidHeart* 두 플래그만 보존되고 comboCount/deathSaveUsed는 매번 재설정된다.
    assert.deepEqual(v40.player.combatFlags, {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: true,
        voidHeartArmed: false,
    });
    // 인벤 내 '원시의 파편' 2개가 meta.endgame.primalShards로 역산되고 인벤에서는 사라진다.
    assert.equal(v40.player.meta.endgame.primalShards, 2);
    assert.equal(v40.player.meta.endgame.legacyInventoryMigrated, true);
    assert.ok(!v40.player.inv.some((item) => item.name === '원시의 파편'));
    // stats.codex가 없던 세이브는 인벤/장비/killRegistry에서 부트스트랩된다.
    assert.equal(v40.player.stats.codex.weapons['질풍의 단검']?.discovered, true);
    assert.equal(v40.player.stats.codex.monsters['슬라임']?.kills, 60);

    const v50 = migrateData(await readFixture('5.0'));
    // quest id:90(목표 100, kills=210) — 저장된 progress(20)보다 큰 실제 킬 수 기준
    // 누적 진행으로 끌어올려진다(getCumulativeQuestProgress).
    assert.deepEqual(v50.player.quests, [{ id: 90, progress: 100 }]);
    // 이미 codex가 있던 세이브는 부트스트랩을 건너뛰고 그대로 보존된다.
    assert.equal(v50.player.stats.codex.weapons['복합궁']?.discovered, true);
});

test('migrateData: 멱등성 — 두 번째 호출은 첫 번째 결과와 (타임스탬프 제외) 동일하다', async () => {
    for (const label of VERSION_LABELS) {
        const migrated = migrateData(await readFixture(label));
        const migratedTwice = migrateData(migrated);
        assert.deepEqual(stripVolatile(migratedTwice), stripVolatile(migrated), `v${label}`);
    }
});
