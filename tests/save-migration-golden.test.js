import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { migrateData } from '../src/utils/dataMigration.ts';

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
 * 그대로 굳힌 것이다(비결정적 필드 정규화 후) — 무엇이 옳은지 미리 정하지 않고,
 * "지금 이렇게 동작한다"를 고정해 향후 migrateData 변경이 이 파일을 의식적으로
 * 갱신하게 만드는 것이 목적이다. `SAVE_GOLDEN_WRITE=1`로 재생성한다.
 *
 * 비결정적 필드 실측(중요 발견): `stats.currentRun`이 없는 입력에서
 * `normalizeCurrentRunProgress` → `createCurrentRunProgress`가 `Date.now()`를
 * 기본 `startedAt`으로 쓴다(runProgress.ts) — migrateData 자신은 결정론적이라고
 * 어디에도 문서화돼 있지 않지만 실제로는 이 경로에서 비결정적이다. 골든 비교가
 * 영원히 깨지지 않도록 `player.stats.currentRun.startedAt`을 항상 정규화한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, 'fixtures', 'saves');
const INPUTS_PATH = path.join(FIXTURES_DIR, 'golden-inputs.json');
const OUTPUTS_PATH = path.join(FIXTURES_DIR, 'golden-outputs.json');

/** `slot.stats.currentRun.startedAt`이 있으면 null로 정규화한 새 slot을 돌려준다(없으면 원본 그대로). */
const withNormalizedCurrentRun = (slot) => {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return slot;
    const stats = slot.stats;
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return slot;
    const currentRun = stats.currentRun;
    if (!currentRun || typeof currentRun !== 'object' || Array.isArray(currentRun)) return slot;
    return { ...slot, stats: { ...stats, currentRun: { ...currentRun, startedAt: null } } };
};

/**
 * `stats.currentRun.startedAt`(Date.now() 기반, 비결정적)과 savedAt류를 정규화한다.
 * player 슬롯이 `clone.player`에 있는 일반적인 경우와, legacy flat 세이브처럼
 * `clone` 자신이 곧 player인 경우(§A 픽스처군) 둘 다 처리한다 — 후자를 놓치면
 * flat 세이브 golden 비교가 실행 시각에 따라 매번 깨진다(실측).
 */
const normalizeVolatile = (value) => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return [...value];
    const clone = { ...value };
    delete clone.savedAt;
    if (clone.player && typeof clone.player === 'object' && !Array.isArray(clone.player)) {
        clone.player = withNormalizedCurrentRun(clone.player);
    } else {
        // flat 세이브 — clone 자신이 player 슬롯이다.
        return withNormalizedCurrentRun(clone);
    }
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
        const output = JSON.parse(JSON.stringify(migrateData(input)));
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
 * P21은 의도적으로 제외한다(TODO(B2 finding), 항목 자체의 description 참조) —
 * `normalizeActiveExpedition`이 `lowestHp`/`startHp` 둘 다 없는 입력에서 NaN을 내고,
 * 이 하네스의 golden 저장(JSON 왕복)이 NaN→null로 정규화하면서 재입력 시 다른 값(0)이
 * 나오게 만든다. 이건 하네스의 인공물이 아니라 normalizeActiveExpedition 자체의
 * 실제 비결정 지점을 드러낸 것이라 "고쳐서 통과시키기"보다 격리해 남겨둔다.
 */
const IDEMPOTENCE_EXCLUDED_IDS = new Set(['P21-activeExpedition-lowestHp-nan-TODO-B2-finding']);

test('golden: 멱등성 — 던지지 않은 모든 항목(P21 제외)은 결과를 다시 넣어도(정규화 후) 동일하다', () => {
    for (const { id, input } of inputs) {
        if (IDEMPOTENCE_EXCLUDED_IDS.has(id)) continue;
        const first = computeGoldenResult(input);
        if (first.threw) continue;
        const second = computeGoldenResult(first.output);
        assert.deepEqual(second, first, `${id}: 멱등성 위반`);
    }
});

test('golden[P21]: activeExpedition.lowestHp가 NaN이 되는 실제 비결정 지점 (TODO(B2 finding))', () => {
    const entry = inputs.find((item) => item.id === 'P21-activeExpedition-lowestHp-nan-TODO-B2-finding');
    const first = computeGoldenResult(entry.input);
    assert.equal(first.threw, false);
    // JSON 직렬화 이전(raw) 값 자체를 다시 확인 — NaN이 실제로 발생함을 직접 실측한다.
    const raw = migrateData(entry.input);
    assert.equal(Number.isNaN(raw.player.activeExpedition.lowestHp), true);
    // golden에 저장된 값은 JSON 왕복으로 NaN→null이 된 것이다(하네스의 인공물, 실제 값은 NaN).
    assert.equal(first.output.player.activeExpedition.lowestHp, null);
});
