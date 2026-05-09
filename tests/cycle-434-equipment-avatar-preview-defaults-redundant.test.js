import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 434: EquipmentAvatarPreview 3 default values redundant 정리
 *   (cycle 222-433 silent dead config 시리즈 193번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-433 패턴, redundant default 4-cycle 시리즈
 *   431/432/433/434).
 *
 * 발견 (3 redundant default values):
 * - src/components/icons/EquipmentAvatarPreview.tsx:
 *     `({ item, size = 24, className = '', variant = 'default' }: any) => { ... }`
 * - 호출 사이트 분석 (1곳, 모든 prop 명시 전달):
 *     ItemIcon.tsx:114: `<EquipmentAvatarPreview item={item} size={size}
 *                       variant={previewVariant} className="h-full w-full" />`
 *   → size / variant / className 모두 명시 → 3 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-433 시리즈 193번째):
 * - cycle 431: AvatarEquipmentOverlay default layer 제거.
 * - cycle 432: AetherMark default size 제거.
 * - cycle 433: SignalBadge default tone / size 제거.
 * - cycle 434: EquipmentAvatarPreview 3 default 제거 — 동일 lens 4-cycle 시리즈.
 *
 * 수정 (src/components/icons/EquipmentAvatarPreview.tsx):
 * - destructure에서 3 default 제거.
 *
 * 회귀 가드:
 * - 1 호출자 (ItemIcon) 모든 prop 명시 → 동작 그대로.
 * - variant 기반 ternary 분기 ('card' / 'default') 그대로 활성.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 434: EquipmentAvatarPreview destructure에서 3 default 제거', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    const fnIdx = source.indexOf('const EquipmentAvatarPreview');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/size = 24/.test(block), 'default size 제거됨');
    assert.ok(!/className = ''/.test(block), 'default className 제거됨');
    assert.ok(!/variant = 'default'/.test(block), 'default variant 제거됨');
    // 파라미터는 보존
    assert.ok(/\bitem\b/.test(block), 'item 파라미터 보존');
    assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
    assert.ok(/\bclassName\b/.test(block), 'className 파라미터 보존');
    assert.ok(/\bvariant\b/.test(block), 'variant 파라미터 보존');
});

test('cycle 434: 호출 사이트 정합성 가드 (ItemIcon 명시 전달)', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const callMatch = source.match(/<EquipmentAvatarPreview[^/]*\/>/);
    assert.ok(callMatch, 'EquipmentAvatarPreview 호출 발견');
    const call = callMatch[0];
    assert.ok(/item=/.test(call), 'item 명시');
    assert.ok(/size=/.test(call), 'size 명시');
    assert.ok(/variant=/.test(call), 'variant 명시');
    assert.ok(/className=/.test(call), 'className 명시');
});

test('cycle 434: variant ternary 분기 (card / default) 활성', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    assert.ok(/variant === 'card'/.test(source), "variant 'card' 분기 보존");
});

test('cycle 433 회귀 가드: SignalBadge default tone / size 0건', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    const fnIdx = source.indexOf('const SignalBadge =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/tone = 'neutral'/.test(block), 'cycle 433 default tone 제거 보존');
    assert.ok(!/size = 'sm'/.test(block), 'cycle 433 default size 제거 보존');
});
