import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 328: BossPhase type export → private downgrade
 *   (cycle 222-327 silent dead config 시리즈 97번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/types/monster.ts: BossPhase interface — phase2 / phase3 필드 타입으로만 사용,
 *   외부 import 0건.
 * - cycle 298 BossMonster private downgrade 패턴 동일.
 *
 * 패턴 (cycle 222-327 silent dead config 시리즈 97번째):
 * - cycle 327: JOB_TYPICAL_LOADOUT dead data 제거.
 * - cycle 328: BossPhase type private downgrade.
 *
 * 수정:
 * - src/types/monster.ts: BossPhase export 제거 (interface 정의 유지).
 * - tests/cycle-283-monster-types-dead.test.js: regex `(?:export )?interface BossPhase`
 *   패턴으로 private downgrade 호환 갱신.
 *
 * 회귀 가드:
 * - MonsterBase / Monster 유니온 / phase2 / phase3 필드 타입 그대로.
 * - cycle 283 dead 필드 cleanup 가드 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 328: BossPhase export 제거 (private)', async () => {
    const source = await readSrc('src/types/monster.ts');
    assert.ok(!/export interface BossPhase\b/.test(source),
        'BossPhase export 제거됨');
    assert.ok(/interface BossPhase\b/.test(source),
        'BossPhase 정의 유지 (private)');
});

test('cycle 328: phase2 / phase3 필드 타입 보존', async () => {
    const source = await readSrc('src/types/monster.ts');
    assert.ok(/phase2\?:\s*BossPhase/.test(source), 'phase2 필드 BossPhase 타입');
    assert.ok(/phase3\?:\s*BossPhase/.test(source), 'phase3 필드 BossPhase 타입');
});

test('cycle 328: monster.ts active export 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/types/monster.ts');
    assert.ok(/export interface MonsterBase\b/.test(source), 'MonsterBase export 유지');
    assert.ok(/export type Monster\b/.test(source), 'Monster 유니온 export 유지');
});

test('cycle 327 회귀 가드: JOB_TYPICAL_LOADOUT 제거 보존', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    assert.ok(!/export const JOB_TYPICAL_LOADOUT\b/.test(source),
        'cycle 327 JOB_TYPICAL_LOADOUT 제거 보존');
});
