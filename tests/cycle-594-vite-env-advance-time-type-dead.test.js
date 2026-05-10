import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 594: Window 인터페이스의 advanceTime 타입 선언 dead cascade 정리
 *   (cycle 222-593 silent dead config 시리즈 331번째 — dead exposure pattern
 *   cascade, cycle 593 paired completion).
 *
 * 발견 (1 dead type declaration cascade):
 * - src/vite-env.d.ts (line 38):
 *     interface Window {
 *         __AETHERIA_PERF_REGISTRY__?: PerfRegistry;
 *         ...
 *         render_game_to_text?: any;
 *         advanceTime?: any;  ← cycle 593에서 실제 정의 제거된 잔존 타입
 *     }
 * - 호출 사이트:
 *     · cycle 593에서 window.advanceTime 정의 제거됨.
 *     · 타입 선언만 잔존, 실제 property 0건.
 * - 결과: 타입 선언 dead. paired completion으로 정리.
 *
 * 패턴 (cycle 222-593 시리즈 331번째):
 * - cycle 593에서 window.advanceTime 실제 정의/cleanup 제거.
 * - cycle 594: 타입 선언 cascade cleanup. cycle 526/541/567/568 cascade 패턴.
 *
 * 수정 (src/vite-env.d.ts):
 * - Window interface에서 advanceTime?: any 1줄 제거.
 *
 * 회귀 가드:
 * - render_game_to_text / __AETHERIA_TEST_API__ / __AETHERIA_PERF_REGISTRY__
 *   타입 선언 보존 (active).
 * - cycle 593 src/hooks/useGameTestApi.ts cleanup 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 594: vite-env.d.ts Window interface에서 advanceTime 타입 0건', async () => {
    const source = await readSrc('src/vite-env.d.ts');
    assert.ok(!/advanceTime\?:\s*any/.test(source),
        'Window.advanceTime 타입 선언 제거');
});

test('cycle 594: 활성 Window 타입 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/vite-env.d.ts');
    assert.ok(/render_game_to_text\?:\s*any/.test(source),
        'render_game_to_text 타입 보존 (smoke/perf 스크립트 active)');
    assert.ok(/__AETHERIA_TEST_API__\?:\s*any/.test(source),
        '__AETHERIA_TEST_API__ 타입 보존');
    assert.ok(/__AETHERIA_PERF_REGISTRY__\?:\s*PerfRegistry/.test(source),
        '__AETHERIA_PERF_REGISTRY__ 타입 보존');
});

test('cycle 594: cycle 593 정의 제거 보존', async () => {
    const source = await readSrc('src/hooks/useGameTestApi.ts');
    assert.ok(!/window\.advanceTime\s*=/.test(source),
        'cycle 593 window.advanceTime 정의 제거 보존');
});
