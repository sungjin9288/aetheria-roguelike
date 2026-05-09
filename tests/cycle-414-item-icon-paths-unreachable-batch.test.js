import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 414: ItemIcon ICON_PATHS equipment-style 16 unreachable keys 일괄 정리
 *   (cycle 222-413 silent dead config 시리즈 175번째 — unreachable lens 회귀).
 *
 * 발견 (16 dead lookup entries):
 * - src/components/icons/ItemIcon.tsx ICON_PATHS: 28 키 중 16개 unreachable.
 * - 렌더링 분기 (line 127-141):
 *   · `!activeAssetState.failed` → `<img>` 시도.
 *   · `activeAssetState.failed && isEquipmentItem` → `<EquipmentAvatarPreview>`.
 *   · `activeAssetState.failed && !isEquipmentItem` → `<svg><path d={path}>`.
 *
 * 결론: SVG rendering은 `!isEquipmentItem` 분기만 진입 — equipment 아이템
 *   (weapon/armor/shield)은 EquipmentAvatarPreview takes over on fail.
 *   따라서 equipment-style ICON_PATHS 키는 SVG에서 절대 hit 안 됨:
 *   sword/greatsword/dagger/staff/bow/axe/hammer/spear/scythe/whip/armor/robe/
 *   cloak/boots/shield/book — 16 unreachable.
 *
 * 보존 (12 키):
 * - material (fallback) + 비-equipment 타입 fallback 키
 *   (potion/key/pouch/ore/crystal/scale/fang/bone/core/relic/herb).
 *   이들은 getEquipmentVisualKey의 type-based fallback (line 268-278)로 도달 가능.
 *
 * 패턴 (cycle 222-413 시리즈 175번째):
 * - cycle 359/361/392/395/397/411/412/413: unreachable lookup lens.
 * - cycle 414: ICON_PATHS equipment-style 16 unreachable 일괄 정리 — 동일 lens 회귀.
 *
 * 수정 (src/components/icons/ItemIcon.tsx):
 * - ICON_PATHS에서 16 equipment-style 키 제거.
 *
 * 회귀 가드:
 * - 12 키 (material/potion/key/pouch/ore/crystal/scale/fang/bone/core/relic/herb) 보존.
 * - SVG 렌더링 동작 (`<path d={path}>`) 보존.
 * - 비-equipment 아이템 SVG 렌더링 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 414: ICON_PATHS equipment-style 16 키 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const ICON_PATHS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const removedKeys = ['sword', 'greatsword', 'dagger', 'staff', 'bow', 'axe',
        'hammer', 'spear', 'scythe', 'whip', 'armor', 'robe', 'cloak', 'boots',
        'shield', 'book'];
    for (const key of removedKeys) {
        const re = new RegExp(`^\\s+${key}:\\s*'`, 'm');
        assert.ok(!re.test(block), `ICON_PATHS에서 ${key} 0건`);
    }
});

test('cycle 414: 활성 12 키 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const blockStart = source.indexOf('const ICON_PATHS');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    const preservedKeys = ['material', 'potion', 'ore', 'crystal', 'scale',
        'fang', 'bone', 'core', 'relic', 'herb', 'pouch', 'key'];
    for (const key of preservedKeys) {
        const re = new RegExp(`^\\s+${key}:\\s*'`, 'm');
        assert.ok(re.test(block), `${key} 키 보존`);
    }
});

test('cycle 414: ICON_PATHS lookup + fallback 동작 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    assert.ok(/ICON_PATHS\[iconKey\] \|\| ICON_PATHS\.material/.test(source),
        'fallback `|| ICON_PATHS.material` 동작 보존');
    assert.ok(/<path d=\{path\}/.test(source),
        'SVG <path> 렌더링 보존');
});

test('cycle 413 회귀 가드: SignatureBadge TONE_COLORS.steel 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const blockStart = source.indexOf('const TONE_COLORS');
    const blockEnd = source.indexOf('});', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/^\s+steel:/m.test(block),
        'cycle 413 TONE_COLORS.steel 0건 보존');
});
