import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 324: firebase.ts `app` dead export 제거
 *   (cycle 222-323 silent dead config 시리즈 93번째 — cleanup lens 연속).
 *
 * 발견 (dead export):
 * - src/firebase.ts: `app` export — initializeApp 결과 객체.
 * - src/ 어디에서도 `import { app } from '../firebase'` 0건.
 * - auth / db / hasFirebaseConfig는 active import (4 consumers + 50+ db usage).
 *
 * 패턴 (cycle 222-323 silent dead config 시리즈 93번째):
 * - cycle 323: 3 leftover unused imports (cycle 321/322 paired).
 * - cycle 324: firebase.ts `app` dead export 제거.
 *
 * 수정:
 * - src/firebase.ts: export list에서 `app` 제거.
 * - app const 정의 자체는 유지 (auth = getAuth(app) / db = getFirestore(app) 내부 사용).
 *
 * 회귀 가드:
 * - auth / db / hasFirebaseConfig export 그대로.
 * - getAuth(app) / getFirestore(app) 내부 호출 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 324: firebase.ts app export 제거', async () => {
    const source = await readSrc('src/firebase.ts');
    // export list에 `app` 없어야 함.
    const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
    assert.ok(exportLine, 'export 라인 발견');
    assert.ok(!/\bapp\b/.test(exportLine[1]),
        'app export 제거됨');
});

test('cycle 324: firebase.ts app const 정의 유지 (private)', async () => {
    const source = await readSrc('src/firebase.ts');
    assert.ok(/const app = initializeApp/.test(source),
        'app const 정의 유지');
    assert.ok(/getAuth\(app\)/.test(source),
        'getAuth(app) 호출 유지');
    assert.ok(/getFirestore\(app\)/.test(source),
        'getFirestore(app) 호출 유지');
});

test('cycle 324: auth / db / hasFirebaseConfig export 유지', async () => {
    const source = await readSrc('src/firebase.ts');
    const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
    assert.ok(exportLine, 'export 라인 발견');
    assert.ok(/\bauth\b/.test(exportLine[1]), 'auth export 유지');
    assert.ok(/\bdb\b/.test(exportLine[1]), 'db export 유지');
    assert.ok(/\bhasFirebaseConfig\b/.test(exportLine[1]), 'hasFirebaseConfig export 유지');
});

test('cycle 323 회귀 가드: 3 leftover unused imports 정리 보존', async () => {
    const eu = await readSrc('src/utils/exploreUtils.ts');
    const importMatch = eu.match(/^import type \{ ([^}]+) \} from '\.\.\/types\/index\.js';/m);
    assert.ok(importMatch && !/\bMonster\b/.test(importMatch[1]),
        'cycle 323 exploreUtils Monster 제거 보존');
});
