import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 528: pickBestOneHandPair `weapons = []` + `requiredWeapon = null`
 *   2 defaults batch unreachable (cycle 222-527 silent dead config 시리즈
 *   272번째 — redundant default annotation util-level cleanup, util default
 *   청소 메가 시리즈 25번째).
 *
 * 발견 (2 defaults batch):
 * - src/utils/equipmentUtils.ts (line 133):
 *     const pickBestOneHandPair = (weapons: any[] = [],
 *         requiredWeapon: any = null) => {...}
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · equipmentUtils.ts:197-200 — pickBestOneHandPair(
 *           [currentMain, isWeapon(currentOffhand) ? currentOffhand : null,
 *            item].filter(Boolean),
 *           item
 *       )
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: 2 args 항상 명시 전달. weapons 항상 배열, requiredWeapon 항상 item
 *   (truthy). 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-527 시리즈 272번째):
 * - cycle 502-527: util default 청소 메가 시리즈 24사이클.
 * - cycle 528: pickBestOneHandPair batch — 동일 lens.
 *
 * 수정 (src/utils/equipmentUtils.ts):
 * - signature에서 weapons: any[] = [] → weapons: any[].
 * - signature에서 requiredWeapon: any = null → requiredWeapon: any.
 * - body의 weapons.filter / requiredWeapon truthy 체크 보존 (caller가 null
 *   넘기는 path가 아예 없음).
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body filter / forEach / getWeaponEquipScore 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 528: pickBestOneHandPair signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    const fnIdx = source.indexOf('const pickBestOneHandPair');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/weapons:\s*any\[\]\s*=\s*\[\]/.test(sig),
        'pickBestOneHandPair weapons default [] 제거');
    assert.ok(!/requiredWeapon:\s*any\s*=\s*null/.test(sig),
        'pickBestOneHandPair requiredWeapon default null 제거');
    assert.ok(/\bweapons\b/.test(sig), 'weapons 파라미터 자체는 보존');
    assert.ok(/\brequiredWeapon\b/.test(sig), 'requiredWeapon 파라미터 자체는 보존');
});

test('cycle 528: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/pickBestOneHandPair\(\s*\[currentMain,\s*isWeapon\(currentOffhand\)/.test(source),
        'pickBestOneHandPair callsite 보존');
    assert.ok(/\.filter\(Boolean\),\s*\n\s*item\s*\n\s*\)/.test(source),
        'filter(Boolean) + item 2 args 보존');
});

test('cycle 528: body filter/forEach/getWeaponEquipScore 호출 보존', async () => {
    const source = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(/weapons\.filter\(\(weapon: any\) => isOneHandWeapon\(weapon\)\)/.test(source),
        'weapons.filter 보존');
    assert.ok(/candidates\.forEach\(\(mainWeapon: any\)/.test(source),
        'candidates.forEach 보존');
    assert.ok(/getWeaponEquipScore\(mainWeapon, 'main'\)/.test(source),
        'getWeaponEquipScore main 호출 보존');
});

test('cycle 528: cycle 502-527 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const dedupeChoices[^=]*choices:\s*any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 527 dedupeChoices default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/const toPercent[^=]*value:\s*any\s*=\s*0/.test(rp),
        'cycle 526 toPercent value default 0건');
});
