import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 325: SoundManager 'hover' case dead branch 제거
 *   (cycle 222-324 silent dead config 시리즈 94번째 — cleanup lens 연속).
 *
 * 발견 (dead switch case):
 * - src/systems/SoundManager.ts: switch(type)에 'hover' case 정의.
 *   부드러운 호버 sfx (800Hz → 1200Hz arc) 정의되어 있지만
 *   src/ 어디에서도 `soundManager.play('hover')` 호출 0건.
 *
 * 비교 — 다른 case는 모두 dispatch:
 * - 'click' / 'attack' / 'skill' / 'levelUp' / 'death' / 'victory' / 'escape' /
 *   'explore' / 'heal' / 'item' / 'error' / 'new_area' / 'discovery_chain' /
 *   'quest_complete' / 'legendary' 모두 호출 사이트 보유.
 *
 * 패턴 (cycle 222-324 silent dead config 시리즈 94번째):
 * - cycle 324: firebase.ts app dead export 제거.
 * - cycle 325: SoundManager hover dead case 정리.
 *
 * 수정 (src/systems/SoundManager.ts):
 * - 'hover' case 제거 (10 lines sfx 정의).
 *
 * 회귀 가드:
 * - 다른 14 case는 그대로 — dispatch path 영향 없음.
 * - soundManager.play / init / toggleMute API 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 325: SoundManager hover case 제거', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.ok(!/case 'hover':\s*\{/.test(source),
        "'hover' case 제거됨");
});

test('cycle 325: SoundManager 다른 14 case 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    const aliveCases = ['attack', 'click', 'death', 'discovery_chain', 'error', 'escape', 'explore', 'heal', 'item', 'legendary', 'levelUp', 'new_area', 'quest_complete', 'skill', 'victory'];
    aliveCases.forEach((name) => {
        const re = new RegExp(`case '${name}'`);
        assert.ok(re.test(source), `case '${name}' 보존`);
    });
});

test('cycle 325: soundManager export 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.ok(/export const soundManager/.test(source),
        'soundManager export 유지');
});

test('cycle 324 회귀 가드: firebase app export 제거 보존', async () => {
    const source = await readSrc('src/firebase.ts');
    const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
    assert.ok(exportLine && !/\bapp\b/.test(exportLine[1]),
        'cycle 324 app export 제거 보존');
});
