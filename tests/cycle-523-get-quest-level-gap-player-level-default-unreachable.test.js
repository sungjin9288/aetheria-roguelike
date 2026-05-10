import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 523: getQuestLevelGap `playerLevel = 1` default unreachable
 *   (cycle 222-522 silent dead config 시리즈 267번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 20번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/questOperations.ts (line 34):
 *     const getQuestLevelGap = (quest, playerLevel: any = 1) =>
 *         Math.abs((quest?.minLv || 1) - (playerLevel || 1));
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · questOperations.ts:116 — getQuestLevelGap(quest, playerLevel)
 *       (playerLevel은 caller scoreQuest에서 player?.level || 1로 보장).
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: playerLevel 항상 명시 전달. default 1 도달 불가.
 *
 * 패턴 (cycle 222-522 시리즈 267번째):
 * - cycle 502-522: util default 청소 메가 시리즈 19사이클.
 * - cycle 523: getQuestLevelGap playerLevel — 동일 lens. cycle 519
 *   getMapLevel과 동일 패턴 (private + body의 || 1 defensive 보존).
 *
 * 수정 (src/utils/questOperations.ts):
 * - signature에서 playerLevel: any = 1 → playerLevel: any.
 * - body의 (playerLevel || 1) defensive 가드 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body Math.abs((quest?.minLv || 1) - (playerLevel || 1)) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 523: getQuestLevelGap signature에서 playerLevel default 0건', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    const fnIdx = source.indexOf('const getQuestLevelGap');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(sig), 'playerLevel default 1 제거');
    assert.ok(/\bplayerLevel\b/.test(sig), 'playerLevel 파라미터 자체는 보존');
});

test('cycle 523: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    assert.ok(/getQuestLevelGap\(quest,\s*playerLevel\)/.test(source),
        'internal callsite (quest, playerLevel) 보존');
});

test('cycle 523: body Math.abs defensive 가드 보존', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    assert.ok(/Math\.abs\(\(quest\?\.minLv \|\| 1\) - \(playerLevel \|\| 1\)\)/.test(source),
        'Math.abs((quest?.minLv || 1) - (playerLevel || 1)) defensive guard 보존');
});

test('cycle 523: cycle 502-522 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const toInt[^=]*fallback:\s*any\s*=\s*0/.test(aiu),
        'cycle 522 toInt fallback default 0건');

    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/const hashText[^=]*value:\s*any\s*=\s*''/.test(ea),
        'cycle 521 hashText value default 0건');
});
