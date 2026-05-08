import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 309: RemoteConfigLoader dead module 제거 + REMOTE_CONFIG_ENABLED 상수 정리
 *   (cycle 222-308 silent dead config 시리즈 79번째 — cleanup lens 연속).
 *
 * 발견 (dead module):
 * - src/systems/RemoteConfigLoader.ts: 41줄 모듈, src/, tests/ 어디에서도 import 0건.
 *   Firestore에서 game config를 fetch하는 fetchConfig / getItems / getMaps / getClasses
 *   메서드를 export하지만 호출되는 곳이 전혀 없음.
 * - src/data/constants.ts:23 CONSTANTS.REMOTE_CONFIG_ENABLED:
 *   - RemoteConfigLoader 내부에서만 read (line 12). RemoteConfigLoader가 dead라
 *     이 상수도 cascade dead.
 *
 * 패턴 (cycle 222-308 silent dead config 시리즈 79번째):
 * - cycle 308: LatencyTracker 5 dead surface 제거 (cascade cleanup).
 * - cycle 309: RemoteConfigLoader dead module 제거 + 의존 상수 정리.
 *
 * 수정:
 * - src/systems/RemoteConfigLoader.ts: 파일 삭제 (41 lines).
 * - src/data/constants.ts: REMOTE_CONFIG_ENABLED 키 제거.
 *
 * 회귀 가드:
 * - LatencyTracker / TokenQuotaManager / FeedbackValidator 등 다른 system 파일 영향 없음.
 * - DB / aiService 등 game data flow 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 309: RemoteConfigLoader.ts 파일 제거', async () => {
    let exists = true;
    try {
        await access(path.join(ROOT, 'src/systems/RemoteConfigLoader.ts'));
    } catch {
        exists = false;
    }
    assert.equal(exists, false, 'RemoteConfigLoader.ts 파일 제거됨');
});

test('cycle 309: CONSTANTS.REMOTE_CONFIG_ENABLED 제거', async () => {
    const source = await readSrc('src/data/constants.ts');
    assert.ok(!/REMOTE_CONFIG_ENABLED:\s*ENV/.test(source),
        'REMOTE_CONFIG_ENABLED 상수 정의 제거됨');
});

test('cycle 309: constants.ts에 REMOTE_CONFIG_ENABLED 키 정의 제거', async () => {
    const constSource = await readSrc('src/data/constants.ts');
    // 키 정의 (`REMOTE_CONFIG_ENABLED:`) 없어야 함 — 주석 mention은 허용.
    assert.ok(!/^\s*REMOTE_CONFIG_ENABLED:/m.test(constSource),
        'REMOTE_CONFIG_ENABLED 키 정의 제거');
});

test('cycle 309: 다른 system 파일 영향 없음 (회귀 가드)', async () => {
    const ltSrc = await readSrc('src/systems/LatencyTracker.ts');
    const tqSrc = await readSrc('src/systems/TokenQuotaManager.ts');
    assert.ok(/export const LatencyTracker/.test(ltSrc),
        'LatencyTracker 보존');
    assert.ok(/export const TokenQuotaManager/.test(tqSrc),
        'TokenQuotaManager 보존');
});

test('cycle 308 회귀 가드: LatencyTracker 5 dead surface 제거 유지', async () => {
    const source = await readSrc('src/systems/LatencyTracker.ts');
    assert.ok(!/getStats\s*\(/.test(source), 'cycle 308 getStats 제거 유지');
    assert.ok(!/recentLatencies:\s*\[\]/.test(source),
        'cycle 308 recentLatencies 제거 유지');
});
