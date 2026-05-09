import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 435: DifficultyManager makeBattleRecord `ts` 출력 dead 정리
 *   (cycle 222-434 silent dead config 시리즈 194번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356 24-cycle 시리즈 패턴).
 *
 * 발견 (1 dead output field):
 * - src/systems/DifficultyManager.ts makeBattleRecord:
 *     `({ result, hpRatio: ..., ts: Date.now() })`
 * - 호출 사이트 (battle record consumers) 분석:
 *     · DifficultyManager.calcPerformanceScore: `battle.hpRatio` (lines 153)
 *     · gameUtils.ts:686: `battle.result === 'win'`
 *     · 외부 read: 0건. battle.ts read 0건.
 * - 결과: ts 필드 어디로도 흐르지 않는 dead output.
 *
 * 패턴 (cycle 222-434 시리즈 194번째):
 * - cycle 333-356 시리즈 (24 cycles): 함수 출력 dead 필드 cleanup.
 * - cycle 416: CombatPanel ACTION_BUTTONS tag/detail 출력 dead.
 * - cycle 423: ControlPanel coreButtons sidebarLabel 출력 dead.
 * - cycle 435: makeBattleRecord ts 출력 dead — 동일 lens 회귀.
 *
 * 수정 (src/systems/DifficultyManager.ts):
 * - makeBattleRecord return에서 `ts: Date.now()` 제거.
 *
 * 회귀 가드:
 * - result / hpRatio (활성 read 필드) 그대로.
 * - 50개 윈도우 슬라이싱 / DIFF_TABLE 매핑 등 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 435: makeBattleRecord 본체에서 ts 필드 0건', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fnIdx = source.indexOf('export const makeBattleRecord');
    const fnEnd = source.indexOf('});', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/ts: Date\.now\(\)/.test(block), 'ts: Date.now() 0건');
    assert.ok(!/\bts\b/.test(block), 'ts 필드명 0건');
});

test('cycle 435: 활성 필드 (result / hpRatio) 보존', async () => {
    const source = await readSrc('src/systems/DifficultyManager.ts');
    const fnIdx = source.indexOf('export const makeBattleRecord');
    const fnEnd = source.indexOf('});', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/\bresult\b/.test(block), 'result 필드 보존');
    assert.ok(/hpRatio/.test(block), 'hpRatio 필드 보존');
});

test('cycle 435: makeBattleRecord runtime — ts 필드 부재 + 활성 필드 정상', async () => {
    const { makeBattleRecord } = await import('../src/systems/DifficultyManager.ts');
    const record = makeBattleRecord('win', 0.5);
    assert.equal(record.result, 'win', 'result 정상');
    assert.equal(record.hpRatio, 0.5, 'hpRatio 정상');
    assert.equal(record.ts, undefined, 'ts 필드 부재 (dead 정리)');
    // hpRatio 클램프 동작 확인
    const overhigh = makeBattleRecord('escape', 1.5);
    assert.equal(overhigh.hpRatio, 1, 'hpRatio 1 초과 클램프');
    const overlow = makeBattleRecord('death', -0.2);
    assert.equal(overlow.hpRatio, 0, 'hpRatio 0 미만 클램프');
});

test('cycle 435: 정합성 가드 — battle.ts read 0건 (전체 src/)', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    let tsReads = 0;
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        // battle.ts 또는 record.ts 패턴 (Date.now에서 비롯된 timestamp 필드 read)
        if (/battle\.ts\b|record\.ts\b/.test(content)) tsReads += 1;
    }
    assert.equal(tsReads, 0, 'battle.ts / record.ts read 0건 (정합성)');
});

test('cycle 434 회귀 가드: EquipmentAvatarPreview defaults 0건', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    const fnIdx = source.indexOf('const EquipmentAvatarPreview');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/size = 24/.test(block), 'cycle 434 default size 제거 보존');
    assert.ok(!/variant = 'default'/.test(block), 'cycle 434 default variant 제거 보존');
});
