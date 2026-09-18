import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrateData } from '../src/utils/dataMigration.ts';
import { CONSTANTS } from '../src/data/constants.ts';
import { FIRST_SEASON } from '../src/data/seasonPass.ts';

/**
 * W10-B2 — 골든 차등(differential) 하네스.
 *
 * Wave 8 Z2가 만들고(그리고 지웠던) 70입력 하네스를 재구성한다. `golden-inputs.json`은
 * legacy flat 세이브 / player·stats·meta·equip·skillLoadout·tempBuff 스칼라 슬롯 /
 * status·settings·combatFlags·killRegistry 스칼라 / relics·inv·quests 비배열 /
 * string·bool·array·object 모양의 version / quickSlot 과·부족 / null 인벤 원소 /
 * top-level 프리미티브 / 멱등성 대상을 망라한다(정확히 70개는 아니고 74개 — 카테고리
 * 커버리지를 우선했다. 각 항목의 `description`이 무엇을 실측하는지 밝힌다).
 *
 * `golden-outputs.json`은 **현재** migrateData가 각 입력에 대해 실제로 내는 값을
 * 그대로 굳힌 것이다 — 무엇이 옳은지 미리 정하지 않고, "지금 이렇게 동작한다"를 고정해
 * 향후 migrateData 변경이 이 파일을 의식적으로 갱신하게 만드는 것이 목적이다.
 * `SAVE_GOLDEN_WRITE=1`로 재생성한다.
 *
 * W11-C2(B2) — 시각 주입으로 결정론화: Wave 10이 여기서 실측한 비결정 지점은
 * `stats.currentRun`이 없는 입력에서 `normalizeCurrentRunProgress` →
 * `createCurrentRunProgress`가 `Date.now()`를 기본 `startedAt`으로 쓰는 것이었고,
 * 그래서 이 하네스가 `player.stats.currentRun.startedAt`을 매번 null로 정규화해야만
 * 비교가 가능했다. 이제 `migrateData(raw, { now })`가 시각을 받으므로 고정 시각
 * (`FIXED_NOW`)을 넘겨 **정규화 없이** 값 그대로 비교한다 — 골든에 박힌 startedAt이
 * 곧 "그 경로가 결정론적이다"라는 증거다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, 'fixtures', 'saves');
const INPUTS_PATH = path.join(FIXTURES_DIR, 'golden-inputs.json');
const OUTPUTS_PATH = path.join(FIXTURES_DIR, 'golden-outputs.json');

/**
 * 골든 비교에 쓰는 고정 시각 — `migrateData(raw, { now })`로 주입한다.
 * 이 값이 `stats.currentRun.startedAt`(currentRun이 없던 입력)으로 골든에 박힌다.
 */
const FIXED_NOW = 1_700_000_000_000;

/**
 * 저장 시각(`savedAt`)만 떨어낸다 — 실제 세이브에서는 벽시계이고 migrateData가 만들지 않는
 * 입력 유래 필드다. `stats.currentRun.startedAt` 정규화는 W11-C2(B2)에서 제거했다:
 * 시각을 주입하므로 값 그대로 비교한다.
 */
const normalizeVolatile = (value) => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return [...value];
    const clone = { ...value };
    delete clone.savedAt;
    return clone;
};

/** 입력 1건에 migrateData를 돌려 golden 비교 가능한 서술자로 만든다(던지면 던진 사실 자체를 고정).
 *
 * 실측 발견: migrateData는 `equip.offhand`처럼 어떤 분기도 값을 주지 않은 슬롯에
 * `undefined`를 **명시적으로** 대입하는 경로가 있다(장비 경제 마이그레이션의
 * `target.equip.offhand = migrateEquipmentInstancePrice(readItem(target.equip.offhand))`가
 * 무조건 실행된다). 이는 실제 저장 경로(Firestore/localStorage — 항상 JSON 직렬화)에서는
 * 어차피 사라지는 값이라 게임에 영향은 없지만, JS 객체를 그대로 비교하면 "키가 없음"과
 * "키가 undefined로 있음"이 deepStrictEqual에서 다르게 취급돼 골든 비교가 영원히 깨진다.
 * 그래서 여기서도 실제 저장 경로와 동일하게 JSON 왕복을 한 번 더 거친다.
 */
const computeGoldenResult = (input) => {
    try {
        const output = JSON.parse(JSON.stringify(migrateData(input, { now: FIXED_NOW })));
        return { threw: false, output: normalizeVolatile(output) };
    } catch (error) {
        return {
            threw: true,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
};

const inputs = JSON.parse(await readFile(INPUTS_PATH, 'utf8'));

if (process.env.SAVE_GOLDEN_WRITE === '1') {
    const regenerated = inputs.map(({ id, input }) => ({ id, result: computeGoldenResult(input) }));
    await writeFile(OUTPUTS_PATH, `${JSON.stringify(regenerated, null, 2)}\n`, 'utf8');
}

const recordedOutputs = JSON.parse(await readFile(OUTPUTS_PATH, 'utf8'));
const recordedById = new Map(recordedOutputs.map((entry) => [entry.id, entry.result]));

test('golden 입력/출력 파일이 서로 1:1로 대응한다(추가/삭제된 항목 없음)', () => {
    assert.deepEqual(
        [...recordedById.keys()].sort(),
        inputs.map((entry) => entry.id).sort(),
    );
});

for (const { id, description, input } of inputs) {
    test(`golden[${id}]: ${description}`, () => {
        const recorded = recordedById.get(id);
        assert.ok(recorded, `${id}: golden-outputs.json에 기록이 없음 — SAVE_GOLDEN_WRITE=1로 재생성 필요`);
        const actual = computeGoldenResult(input);
        assert.deepEqual(
            actual,
            recorded,
            `${id}: migrateData 동작이 커밋된 golden-outputs.json과 달라졌다 — 의도한 변경이면 `
            + 'SAVE_GOLDEN_WRITE=1 node --import tsx --test tests/save-migration-golden.test.js 로 갱신할 것',
        );
    });
}

/**
 * W11-C2(B2): 제외 항목이 없다. Wave 10은 P21(`activeExpedition.lowestHp` NaN)을
 * 격리해야 했다 — NaN이 골든 저장(JSON 왕복)에서 null로 죽고, 그 null을 다시 넣으면
 * `Number(null)=0`이라 첫 결과와 달라졌기 때문이다. `normalizeActiveExpedition`이
 * 폴백을 정규화된 startHp로 바꾼 뒤로는 그 입력도 그냥 멱등이다.
 */
test('golden: 멱등성 — 던지지 않은 모든 항목은 결과를 다시 넣어도(정규화 후) 동일하다', () => {
    for (const { id, input } of inputs) {
        const first = computeGoldenResult(input);
        if (first.threw) continue;
        const second = computeGoldenResult(first.output);
        assert.deepEqual(second, first, `${id}: 멱등성 위반`);
    }
});

test('golden[P21]: activeExpedition.lowestHp는 startHp 워터마크로 정규화된다 (W11-C2 B2)', () => {
    const entry = inputs.find((item) => item.id === 'P21-activeExpedition-lowestHp-normalized');
    const first = computeGoldenResult(entry.input);
    assert.equal(first.threw, false);
    // JSON 직렬화 이전(raw) 값 자체를 확인 — 더 이상 NaN이 아니다.
    const raw = migrateData(entry.input, { now: FIXED_NOW });
    assert.equal(Number.isNaN(raw.player.activeExpedition.lowestHp), false);
    // lowestHp/startHp 둘 다 없는 입력 → 정규화된 startHp(0)가 워터마크 시작값이다.
    assert.equal(raw.player.activeExpedition.startHp, 0);
    assert.equal(raw.player.activeExpedition.lowestHp, 0);
    assert.equal(first.output.player.activeExpedition.lowestHp, 0);
});

test('golden: migrateData는 주입한 시각만 쓴다 — 같은 입력 + 같은 now → 완전히 같은 출력', () => {
    const entry = inputs.find((item) => item.id === 'P21-activeExpedition-lowestHp-normalized');
    const first = JSON.parse(JSON.stringify(migrateData(entry.input, { now: 111 })));
    const second = JSON.parse(JSON.stringify(migrateData(entry.input, { now: 111 })));
    assert.deepEqual(second, first);
    assert.equal(first.player.stats.currentRun.startedAt, 111);
    // 다른 시각을 주면 그 필드만 달라진다(주입이 실제로 유일한 시각 소스라는 증거).
    const later = JSON.parse(JSON.stringify(migrateData(entry.input, { now: 222 })));
    assert.equal(later.player.stats.currentRun.startedAt, 222);
    later.player.stats.currentRun.startedAt = 111;
    assert.deepEqual(later, first);
});

/**
 * W12-D2 — 시즌 회전은 골든을 한 줄도 움직이지 않는다.
 *
 * 회전이 더한 것은 `seasonPass`의 **선택 필드**뿐이고 기본값은 읽는 쪽이 만든다.
 * 그래서 `migrateData`의 출력은 바뀔 이유가 없고, `DATA_VERSION`도 그대로다.
 * 위의 74입력 골든이 전부 통과한다는 사실이 이미 그 증거지만, 시즌 경로만 따로
 * 짚어 두면 회귀 시 어느 칸이 깨졌는지 즉시 보인다.
 */

test('golden: 시즌 기본값은 레지스트리의 첫 시즌이고 모양이 바뀌지 않았다 (DATA_VERSION 불변)', () => {
    // 'S1' 리터럴을 레지스트리로 승격했지만 **값**은 동일해야 한다 — 다르면 골든 74건이
    // 전부 stale해지고 구세이브가 없던 시즌으로 들어간다.
    assert.equal(FIRST_SEASON.id, 'S1');

    const migrated = migrateData({ version: 5.1, player: { name: 'golden' } }, { now: FIXED_NOW });
    assert.deepEqual(migrated.player.seasonPass, {
        xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1',
    });
    assert.equal(migrated.version, CONSTANTS.DATA_VERSION);
    assert.equal(CONSTANTS.DATA_VERSION, 5.1, '이 트랙은 DATA_VERSION을 올리지 않는다');
});

test('golden: 시즌 필드가 없던 입력들도 기록된 출력과 동일하다 (회전 도입 전후 동치)', () => {
    // 골든 입력 중 seasonPass를 아예 갖고 있지 않은 항목만 골라, 출력의 seasonPass가
    // 기록된 골든과 같은지 다시 확인한다(위 루프의 부분집합을 명시적으로 재단언).
    const seasonless = inputs.filter(({ input }) => (
        input && typeof input === 'object' && !input?.player?.seasonPass && !input?.seasonPass
    ));
    assert.ok(seasonless.length > 0, '시즌 필드 없는 골든 입력이 하나도 없다 — 하네스가 stale');

    for (const { id, input } of seasonless) {
        const recorded = recordedById.get(id);
        const actual = computeGoldenResult(input);
        if (actual.threw) continue;
        assert.deepEqual(
            actual.output?.player?.seasonPass,
            recorded.output?.player?.seasonPass,
            `${id}: 시즌 기본값이 골든과 달라졌다`,
        );
    }
});

test('golden: migrateData는 시각을 시즌 상태에 쓰지 않는다 (회전 트리거는 벽시계가 아니다)', () => {
    const raw = { version: 5.1, player: { name: 'clock' } };
    const early = migrateData(raw, { now: 111 });
    const late = migrateData(raw, { now: 999_999_999 });
    assert.deepEqual(early.player.seasonPass, late.player.seasonPass);
    assert.equal(
        JSON.stringify(early.player.seasonPass).includes('At'),
        false,
        '시즌 상태에 타임스탬프 필드가 섞였다',
    );
});
