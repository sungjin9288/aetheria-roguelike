import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 514: getEquipmentPreviewStage `variant = 'default'` default unreachable
 *   (cycle 222-513 silent dead config 시리즈 263번째 — redundant default annotation
 *   util-level cleanup, util default 청소 메가 시리즈 12번째).
 *
 * 발견 (1 default unreachable):
 * - src/utils/avatarEquipmentPreview.ts (line 119):
 *     export const getEquipmentPreviewStage = (item, appearance, variant: any = 'default') => {...}
 * - 호출 사이트 (1 callsite):
 *     · EquipmentAvatarPreview.tsx:11 — getEquipmentPreviewStage(item, appearance, variant).
 *     · 1 callsite, 3 args 명시 전달 (variant prop).
 *     · 다른 파일 import 0건.
 * - 결과: variant 항상 명시 전달. default 'default' 도달 불가.
 *
 * 패턴 (cycle 222-513 시리즈 263번째):
 * - cycle 502-513: util default 청소 메가 시리즈.
 * - cycle 514: getEquipmentPreviewStage variant default — 동일 lens.
 *
 * 수정 (src/utils/avatarEquipmentPreview.ts):
 * - signature에서 variant: any = 'default' → variant: any (default 제거).
 *
 * 회귀 가드:
 * - 1 callsite 동작 그대로.
 * - body withVariant / variant 사용 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 514: getEquipmentPreviewStage signature에서 variant default 0건', async () => {
    const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
    const fnIdx = source.indexOf('export const getEquipmentPreviewStage');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/variant:\s*any\s*=\s*'default'/.test(sig), 'variant default 제거');
    assert.ok(/\bvariant\b/.test(sig), 'variant 파라미터 자체는 보존');
});

test('cycle 514: 정합성 가드 — EquipmentAvatarPreview callsite 3 args', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    const matches = source.match(/getEquipmentPreviewStage\(/g) || [];
    assert.equal(matches.length, 1, 'getEquipmentPreviewStage 호출 1건');
    assert.ok(/getEquipmentPreviewStage\(item,\s*appearance,\s*variant\)/.test(source),
        '3 args 명시 전달 보존');
});

test('cycle 514: body variant 사용 보존', async () => {
    const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
    assert.ok(/withVariant/.test(source), 'withVariant 헬퍼 보존');
    assert.ok(/variant === 'card'/.test(source) || /\bvariant\b/.test(source),
        'variant 파라미터 사용 보존');
});

test('cycle 514: cycle 502-513 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/getEquipmentArtProfile[^=]*slotHint:\s*any\s*=\s*null/.test(ea),
        'cycle 513 getEquipmentArtProfile slotHint default 0건');
});
