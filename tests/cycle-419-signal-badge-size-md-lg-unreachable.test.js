import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 419: SignalBadge SIZE_CLASS `md` / `lg` unreachable 정리
 *   (cycle 222-418 silent dead config 시리즈 180번째 — unreachable lens 회귀, 호출 사이트 분석).
 *
 * 발견 (2 dead lookup entries + default param 변경):
 * - src/components/SignalBadge.tsx SIZE_CLASS: sm/md/lg 3 키.
 * - lookup 사이트: `SIZE_CLASS[size] || SIZE_CLASS.md`.
 * - SignalBadge 호출 분석: 73 호출 사이트 모두 `size="sm"` 명시.
 *   default `size = 'md'`도 도달 불가 (모든 호출 explicit).
 * - 결과: SIZE_CLASS.md / SIZE_CLASS.lg lookup 절대 hit 안 됨.
 *
 * 패턴 (cycle 222-418 시리즈 180번째):
 * - cycle 418: AetherMark SIZE_MAP.sm — 호출 사이트 분석 기반 unreachable.
 * - cycle 419: SignalBadge SIZE_CLASS.md/lg — 동일 lens 회귀.
 *
 * 수정 (src/components/SignalBadge.tsx):
 * - SIZE_CLASS에서 `md`, `lg` 라인 제거 (sm 단일 유지).
 * - default `size = 'md'` → `size = 'sm'` (실질 동일 동작 — 모든 호출 sm 명시).
 * - fallback `|| SIZE_CLASS.md` → `|| SIZE_CLASS.sm`.
 *
 * 회귀 가드:
 * - sm 활성 사이즈 보존 (73 호출 사이트 모두 사용).
 * - tone/className/children 등 다른 prop 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 419: SignalBadge SIZE_CLASS에서 md/lg 0건', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const blockStart = source.indexOf('const SIZE_CLASS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+md:/m.test(block), 'SIZE_CLASS에서 md 0건');
    assert.ok(!/^\s+lg:/m.test(block), 'SIZE_CLASS에서 lg 0건');
});

test('cycle 419: sm 사이즈 보존 (활성)', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const blockStart = source.indexOf('const SIZE_CLASS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(/^\s+sm:/m.test(block), 'SIZE_CLASS.sm 보존');
});

test('cycle 419: default + fallback 갱신 (sm 기준)', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    assert.ok(/size = 'sm'/.test(source), 'default `size = sm` 변경');
    assert.ok(/SIZE_CLASS\[size\] \|\| SIZE_CLASS\.sm/.test(source),
        'fallback `|| SIZE_CLASS.sm` 변경');
});

test('cycle 419: 정합성 가드 — SignalBadge size="md" / size="lg" 호출 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    const componentDir = path.join(ROOT, 'src/components');
    const files = await readdir(componentDir, { recursive: true });
    let mdCount = 0;
    let lgCount = 0;
    for (const f of files) {
        if (!String(f).endsWith('.tsx')) continue;
        const fp = path.join(componentDir, String(f));
        const src = await readFile(fp, 'utf8').catch(() => '');
        const allBadges = src.match(/<SignalBadge[^>]*\/?>/g) || [];
        for (const m of allBadges) {
            if (/size="md"/.test(m)) mdCount += 1;
            if (/size="lg"/.test(m)) lgCount += 1;
        }
    }
    assert.equal(mdCount, 0, 'size="md" 호출 0건');
    assert.equal(lgCount, 0, 'size="lg" 호출 0건');
});

test('cycle 418 회귀 가드: AetherMark SIZE_MAP.sm 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const blockStart = source.indexOf('const SIZE_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+sm:/m.test(block),
        'cycle 418 AetherMark SIZE_MAP.sm 0건 보존');
});
