import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 566: start action 3 defaults batch unreachable
 *   (cycle 222-565 silent dead config 시리즈 306번째 — redundant default annotation
 *   청소 메가 시리즈 59번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch):
 * - src/hooks/gameActions/characterActions.ts (line 14):
 *     start: (name: any, gender: any = 'male', jobId: any = CONSTANTS.DEFAULT_JOB,
 *         challengeModifiers: any = []) => {...}
 * - 호출 사이트:
 *     · IntroScreen.tsx:49 — onStart?.(selectedName, 'male', '모험가',
 *       selectedChallenges) — 4 args 명시 전달.
 *     · 다른 production caller 0건 (test caller 0건).
 * - 결과: gender / jobId / challengeModifiers 항상 명시 전달. 3 defaults
 *   모두 도달 불가. body의 Array.isArray(challengeModifiers) defensive guard
 *   는 별개 보존 (caller가 array 보장 못하는 path 자체).
 *
 * 패턴 (cycle 222-565 시리즈 306번째):
 * - cycle 502-565: default 청소 메가 시리즈 64사이클.
 * - cycle 566: hooks/gameActions/characterActions.ts 추가 cleanup — cycle
 *   532/535에 이은 동일 모듈. single-cycle 3-default batch (cycle 524/527/
 *   549 패턴).
 *
 * 수정 (src/hooks/gameActions/characterActions.ts):
 * - signature에서 gender / jobId / challengeModifiers 3 defaults 모두 제거.
 * - body의 Array.isArray(challengeModifiers) defensive guard 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (IntroScreen) 동작 그대로.
 * - body trimmedName / buildClassVitals / Array.isArray 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 566: start action signature에서 3 defaults 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    const fnIdx = source.indexOf('start: (name');
    const fnEnd = source.indexOf(')', fnIdx) + 1;
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/gender:\s*any\s*=\s*'male'/.test(sig),
        "start gender default 'male' 제거");
    assert.ok(!/jobId:\s*any\s*=\s*CONSTANTS\.DEFAULT_JOB/.test(sig),
        'start jobId default CONSTANTS.DEFAULT_JOB 제거');
    assert.ok(!/challengeModifiers:\s*any\s*=\s*\[\]/.test(sig),
        'start challengeModifiers default [] 제거');
});

test('cycle 566: 정합성 가드 — IntroScreen callsite 보존', async () => {
    const source = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(/onStart\?\.\(selectedName,\s*'male',\s*'모험가',\s*selectedChallenges\)/.test(source),
        "IntroScreen onStart?.(selectedName, 'male', '모험가', selectedChallenges) callsite 보존");
});

test('cycle 566: body Array.isArray defensive guard 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(/Array\.isArray\(challengeModifiers\) \? challengeModifiers : \[\]/.test(source),
        'Array.isArray(challengeModifiers) defensive guard 보존');
    assert.ok(/buildClassVitals\(player\.level \|\| 1, jobId, player\.meta \|\| \{\}\)/.test(source),
        'buildClassVitals 호출 보존');
});

test('cycle 566: cycle 502-565 회귀 가드 — default 청소 시리즈 보존', async () => {
    const stp = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(!/const SkillTreePreview = \({ player, actions\s*=\s*null/.test(stp),
        'cycle 565 SkillTreePreview actions default 0건');

    const ap = await readSrc('src/utils/avatarEquipmentPreview.ts');
    assert.ok(!/const withVariant[^=]*overrides:\s*any\s*=\s*\{\}/.test(ap),
        'cycle 564 withVariant overrides default 0건');
});
