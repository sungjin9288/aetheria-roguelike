import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 432: AetherMark default `size = 'md'` redundant 정리
 *   (cycle 222-431 silent dead config 시리즈 191번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-429/431 패턴).
 *
 * 발견 (1 redundant default value):
 * - src/components/AetherMark.tsx:
 *     `({ size = 'md', className = '' }: any) => { ... }`
 * - 호출 사이트 분석 (2곳, size 명시 전달):
 *     IntroScreen.tsx:71: `<AetherMark size="md" />`
 *     app/BootScreen.tsx:19: `<AetherMark size="lg" />`
 *   → 모든 호출자 명시 → default 'md' 도달 불가.
 * - className default는 모든 호출자가 omit이라 활성 → 보존.
 *
 * 패턴 (cycle 222-431 시리즈 191번째):
 * - cycle 418: AetherMark SIZE_MAP.sm 제거 (호출 사이트 분석 unreachable).
 * - cycle 431: AvatarEquipmentOverlay default layer 제거.
 * - cycle 432: AetherMark default size — cycle 418 paired completion (lookup
 *   table cleanup 후 잔존 default 제거).
 *
 * 수정 (src/components/AetherMark.tsx):
 * - destructure에서 `size = 'md'` → `size` (default 제거).
 * - SIZE_MAP fallback `|| SIZE_MAP.md`는 보존 (방어용).
 *
 * 회귀 가드:
 * - 2 호출자 명시 size 전달 → 동작 그대로.
 * - className default 보존.
 * - cycle 418 SIZE_MAP.sm 0건 회귀 가드.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 432: AetherMark destructure에서 default size 값 제거", async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const fnIdx = source.indexOf('const AetherMark =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/size = 'md'/.test(block), 'AetherMark destructure default 제거됨');
    assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
});

test('cycle 432: 2 호출자 모두 size 명시 전달 (정합성 가드)', async () => {
    const intro = await readSrc('src/components/IntroScreen.tsx');
    const boot = await readSrc('src/components/app/BootScreen.tsx');
    assert.ok(/<AetherMark size="md"/.test(intro), 'IntroScreen size="md" 명시');
    assert.ok(/<AetherMark size="lg"/.test(boot), 'BootScreen size="lg" 명시');
});

test('cycle 432: className cycle 493 cascade로 prop 자체 제거', async () => {
    // cycle 493이 AetherMark className prop cascade로 정리 (2 호출자 모두
    // 전달 0건). 이전 default 보존 가드 → cascade 보존 가드로 약화.
    const source = await readSrc('src/components/AetherMark.tsx');
    const fnIdx = source.indexOf('const AetherMark =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/className/.test(block), 'cycle 493 cascade로 className 제거 보존');
});

test('cycle 432: SIZE_MAP fallback 보존 (방어용)', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    assert.ok(/SIZE_MAP\[size\] \|\| SIZE_MAP\.md/.test(source),
        'SIZE_MAP fallback 보존');
});

test('cycle 418 회귀 가드: AetherMark SIZE_MAP.sm 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const blockStart = source.indexOf('const SIZE_MAP');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+sm:/m.test(block), 'cycle 418 SIZE_MAP.sm 0건 보존');
});

test('cycle 431 회귀 가드: AvatarEquipmentOverlay default layer 0건', async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/layer = 'front'/.test(block), 'cycle 431 default layer 제거 보존');
});
