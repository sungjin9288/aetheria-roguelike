import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 418: AetherMark SIZE_MAP `sm` unreachable 정리
 *   (cycle 222-417 silent dead config 시리즈 179번째 — unreachable lens 회귀).
 *
 * 발견 (1 dead lookup entry):
 * - src/components/AetherMark.tsx SIZE_MAP: sm/md/lg 3 키.
 * - lookup 사이트: `SIZE_MAP[size] || SIZE_MAP.md`.
 * - AetherMark consumers (전체):
 *   · IntroScreen.tsx:101 — `<AetherMark size="md" />`.
 *   · BootScreen.tsx — `<AetherMark size="lg" />`.
 * - `size="sm"` 호출 0건. 컴포넌트 default도 `size = 'md'`라 sm 도달 불가.
 * - 결과: SIZE_MAP.sm lookup 절대 hit 안 됨.
 *
 * 패턴 (cycle 222-417 시리즈 179번째):
 * - cycle 411/412/413: 데이터 정합성 기반 unreachable tone 정리.
 * - cycle 414: ICON_PATHS equipment-style 16 unreachable.
 * - cycle 418: SIZE_MAP.sm — 전체 호출 사이트 분석 기반 unreachable lens.
 *
 * 수정 (src/components/AetherMark.tsx):
 * - SIZE_MAP에서 `sm` 라인 제거.
 *
 * 회귀 가드:
 * - md / lg 활성 사이즈 보존.
 * - fallback `|| SIZE_MAP.md` 동작 그대로.
 * - default `size = 'md'` 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 418: AetherMark SIZE_MAP에서 sm 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const blockStart = source.indexOf('const SIZE_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+sm:/m.test(block),
        'SIZE_MAP에서 sm 0건');
});

test('cycle 418: 활성 사이즈 보존 (md/lg)', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const blockStart = source.indexOf('const SIZE_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const size of ['md', 'lg']) {
        const re = new RegExp(`^\\s+${size}:`, 'm');
        assert.ok(re.test(block), `${size} 사이즈 보존`);
    }
});

test('cycle 418: fallback default 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    assert.ok(/SIZE_MAP\[size\] \|\| SIZE_MAP\.md/.test(source),
        'fallback `|| SIZE_MAP.md` 동작 보존');
    assert.ok(/size = 'md'/.test(source),
        'default `size = md` 보존');
});

test('cycle 418: 정합성 가드 — AetherMark consumers 모두 md/lg만 사용', async () => {
    const intro = await readSrc('src/components/IntroScreen.tsx');
    const boot = await readSrc('src/components/app/BootScreen.tsx');
    assert.ok(/<AetherMark size="md"/.test(intro), 'IntroScreen md 사용');
    assert.ok(/<AetherMark size="lg"/.test(boot), 'BootScreen lg 사용');
    assert.ok(!/<AetherMark size="sm"/.test(intro + boot),
        'sm consumer 0건 (정합성)');
});

test('cycle 417 회귀 가드: SLOT_CONFIG icon 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const blockStart = source.indexOf('const SLOT_CONFIG');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/\bicon:/.test(block),
        'cycle 417 SLOT_CONFIG.icon 0건 보존');
});
