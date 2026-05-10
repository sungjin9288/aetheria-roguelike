import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 532: buildClassVitals `meta = {}` default unreachable
 *   (cycle 222-531 silent dead config 시리즈 275번째 — redundant default annotation
 *   util/component default 청소 메가 시리즈 28번째). hooks/ 디렉토리 진입 —
 *   utils/ + components/ 외 hooks/까지 lens 확장.
 *
 * 발견 (1 default unreachable):
 * - src/hooks/gameActions/_shared.ts (line 13):
 *     export const buildClassVitals = (level: any, jobId: any,
 *         meta: any = {}) => {
 *         const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
 *         const maxHp = ... + (meta.bonusHp || 0);
 *         const maxMp = ... + (meta.bonusMp || 0);
 *         ...
 *     };
 * - 호출 사이트 (2 callsite, hooks/gameActions/characterActions.ts):
 *     · line 17: buildClassVitals(player.level || 1, jobId, player.meta || {})
 *     · line 129: buildClassVitals(player.level, jobName, player.meta || {})
 *     · 다른 파일 import 0건.
 * - 결과: meta 항상 `player.meta || {}` 명시 전달. default {} 도달 불가.
 *
 * 패턴 (cycle 222-531 시리즈 275번째):
 * - cycle 502-531: util/component default 청소 메가 시리즈 28사이클.
 * - cycle 532: hooks/ 진입 — components/ 진입(cycle 529)에 이은 lens 확장.
 *
 * 수정 (src/hooks/gameActions/_shared.ts):
 * - signature에서 meta: any = {} → meta: any.
 * - body의 (meta.bonusHp || 0) / (meta.bonusMp || 0) defensive guard 보존.
 *
 * 회귀 가드:
 * - 2 callsite 동작 그대로.
 * - body CLASSES 조회 / Math.floor / Math.max 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 532: buildClassVitals signature에서 meta default 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    const fnIdx = source.indexOf('export const buildClassVitals');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/meta:\s*any\s*=\s*\{\}/.test(sig),
        'buildClassVitals meta default {} 제거');
    assert.ok(/\bmeta\b/.test(sig), 'meta 파라미터 자체는 보존');
});

test('cycle 532: 정합성 가드 — 2 callsite 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    assert.ok(/buildClassVitals\(player\.level \|\| 1,\s*jobId,\s*player\.meta \|\| \{\}\)/.test(source),
        '1st callsite (player.level || 1, jobId, player.meta || {}) 보존');
    assert.ok(/buildClassVitals\(player\.level,\s*jobName,\s*player\.meta \|\| \{\}\)/.test(source),
        '2nd callsite (player.level, jobName, player.meta || {}) 보존');
});

test('cycle 532: body defensive guard 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.ok(/\(meta\.bonusHp \|\| 0\)/.test(source),
        '(meta.bonusHp || 0) defensive guard 보존');
    assert.ok(/\(meta\.bonusMp \|\| 0\)/.test(source),
        '(meta.bonusMp || 0) defensive guard 보존');
    assert.ok(/CLASSES\[jobId\] \|\| CLASSES\[CONSTANTS\.DEFAULT_JOB\]/.test(source),
        'CLASSES jobId fallback 보존');
});

test('cycle 532: cycle 502-531 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const formatPercent[^=]*value:\s*any\s*=\s*0/.test(sp),
        'cycle 531 formatPercent value default 0건');

    const av = await readSrc('src/components/PixelCharacterAvatar.tsx');
    assert.ok(!/const softenColor[^=]*alpha:\s*any\s*=\s*0\.24/.test(av),
        'cycle 529 softenColor alpha default 0건');
});
