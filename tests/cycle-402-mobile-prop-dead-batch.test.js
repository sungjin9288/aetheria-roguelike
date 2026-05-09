import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 402: PostCombatCard + IntroScreen `mobile` interface dead prop 정리
 *   (cycle 222-401 silent dead config 시리즈 164번째 — interface dead lens 연속).
 *
 * 발견 (2 components × 2 sites = 4 dead lines):
 *
 * 1) src/components/PostCombatCard.tsx PostCombatCardProps line 25:
 *    `mobile?: boolean;`
 *    - 본체 destructure: `{ result, onClose, onRest, onSell }` — mobile 제외.
 *    - 변수 read 0건 (parent passed `mobile={true}` silent dropped).
 *
 * 2) src/components/IntroScreen.tsx IntroScreenProps line 12:
 *    `mobile?: boolean;`
 *    - 본체 destructure: `{ onStart }` — mobile 제외.
 *    - 변수 read 0건 (parent passed `<IntroScreen ... mobile />` silent dropped).
 *
 * 3) src/components/app/GameRoot.tsx line 180: `<PostCombatCard ... mobile={true} />`.
 * 4) src/App.tsx: `<IntroScreen onStart={...} mobile />`.
 *
 * 패턴 (cycle 222-401 시리즈 164번째):
 * - cycle 401: DashboardProps mobile interface dead 양쪽 정리 (paired remove).
 * - cycle 402: PostCombatCard + IntroScreen 동일 lens 연속 batch (2 components paired remove).
 *   `mobile` prop이 정의되었지만 본체 destructure 미사용 + read 0건이 컴포넌트 3개째 발견.
 *
 * 수정:
 * 1) src/components/PostCombatCard.tsx PostCombatCardProps에서 `mobile?: boolean;` 제거.
 * 2) src/components/IntroScreen.tsx IntroScreenProps에서 `mobile?: boolean;` 제거.
 * 3) src/components/app/GameRoot.tsx PostCombatCard JSX에서 `mobile={true}` 라인 제거.
 * 4) src/App.tsx IntroScreen JSX에서 `mobile` prop 제거.
 *
 * 회귀 가드:
 * - PostCombatCard 활성 props (result/onClose/onRest/onSell) 동작 그대로.
 * - IntroScreen 활성 props (onStart) 동작 그대로.
 * - mobile-test-id / 실제 mobile 변수 (CombatPanel 등 별개 컴포넌트) 보존.
 * - cycle 401 Dashboard mobile prop 정리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 402: PostCombatCardProps에서 mobile 0건', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    const ifaceStart = source.indexOf('interface PostCombatCardProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
        'PostCombatCardProps에서 mobile 0건');
});

test('cycle 402: IntroScreenProps에서 mobile 0건', async () => {
    const source = await readSrc('src/components/IntroScreen.tsx');
    const ifaceStart = source.indexOf('interface IntroScreenProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
        'IntroScreenProps에서 mobile 0건');
});

test('cycle 402: GameRoot.tsx PostCombatCard JSX에서 mobile prop 0건', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    const dashStart = source.indexOf('<PostCombatCard');
    const dashEnd = source.indexOf('/>', dashStart);
    const block = source.slice(dashStart, dashEnd);
    assert.ok(!/mobile=\{true\}|^\s+mobile\s*$/m.test(block),
        'PostCombatCard JSX에서 mobile prop 0건');
});

test('cycle 402: App.tsx IntroScreen JSX에서 mobile prop 0건', async () => {
    const source = await readSrc('src/App.tsx');
    const introMatch = source.match(/<IntroScreen[^>]*\/>/);
    assert.ok(introMatch, 'IntroScreen JSX 발견');
    assert.ok(!/\bmobile\b/.test(introMatch[0]),
        'IntroScreen JSX에서 mobile prop 0건');
});

test('cycle 402: PostCombatCard 활성 props 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    const ifaceStart = source.indexOf('interface PostCombatCardProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    for (const field of ['result', 'onClose', 'onRest', 'onSell']) {
        const re = new RegExp(`${field}\\?:`);
        assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
    }
});

test('cycle 401 회귀 가드: DashboardProps mobile 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const ifaceStart = source.indexOf('interface DashboardProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
        'cycle 401 Dashboard mobile 0건 보존');
});
