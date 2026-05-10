import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 585: ItemIcon `size = 24` default partial unreachable
 *   (cycle 222-584 silent dead config 시리즈 323번째 — redundant default annotation
 *   청소 메가 시리즈 76번째). partial cleanup pattern (cycle 542 재적용 6번째).
 *
 * 발견 (1 default unreachable, 3 defaults reachable 보존):
 * - src/components/icons/ItemIcon.tsx (line 55):
 *     const ItemIcon = ({ item, size = 24, showBorder = false, className = '',
 *         hideSignatureBadge = false }: any) => {...};
 * - 호출 사이트 (11 callers):
 *     · ShopPanel: 4 callers — size + showBorder + className
 *     · LegendaryDropOverlay: 1 caller — size + showBorder
 *     · MaterialCodex: 1 caller — size + showBorder + className
 *     · EquipmentCodexCard: 1 caller — size + showBorder
 *     · LegendaryCodex: 2 callers — size + hideSignatureBadge (showBorder/className 미전달)
 *     · WeaponCodex: 1 caller — size only (showBorder/className/hideSignatureBadge 미전달)
 *     · SmartInventory: 1 caller — size + showBorder + className
 * - 결과:
 *     · size 11/11 callers 명시 → default 24 도달 불가.
 *     · showBorder 미전달 caller 존재 (WeaponCodex/LegendaryCodex) → default
 *       false REACHABLE 보존.
 *     · className 미전달 caller 존재 (WeaponCodex/LegendaryCodex/Equipment
 *       CodexCard/LegendaryDropOverlay) → default '' REACHABLE 보존.
 *     · hideSignatureBadge 미전달 caller 존재 (대부분) → default false
 *       REACHABLE 보존.
 *
 * 패턴 (cycle 222-584 시리즈 323번째):
 * - cycle 502-584: default 청소 메가 시리즈 83사이클.
 * - cycle 585: partial cleanup pattern 6번째 적용 (cycle 542 / 553 / 558 /
 *   569 / 572 partial 재적용). 11 callers의 prop 단위 reachability 분리.
 *
 * 수정 (src/components/icons/ItemIcon.tsx):
 * - signature에서 size = 24 → size.
 * - showBorder = false / className = '' / hideSignatureBadge = false 보존.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 11 production callsite 동작 그대로.
 * - body ICON_PATHS / BALANCE.RARITY_COLORS 처리 보존.
 * - 3 reachable defaults 보존 (showBorder/className/hideSignatureBadge).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 585: ItemIcon signature에서 size default 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const fnIdx = source.indexOf('const ItemIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/size\s*=\s*24/.test(sig),
        'ItemIcon size default 24 제거');
});

test('cycle 585: 3 reachable defaults 보존 (partial cleanup)', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const fnIdx = source.indexOf('const ItemIcon = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/showBorder\s*=\s*false/.test(sig),
        'showBorder default false 보존 (WeaponCodex/LegendaryCodex 미전달이라 reachable)');
    assert.ok(/className\s*=\s*''/.test(sig),
        "className default '' 보존 (다수 callers 미전달이라 reachable)");
    assert.ok(/hideSignatureBadge\s*=\s*false/.test(sig),
        'hideSignatureBadge default false 보존 (대부분 callers 미전달이라 reachable)');
});

test('cycle 585: 정합성 가드 — sample callsites 보존', async () => {
    const wc = await readSrc('src/components/codex/WeaponCodex.tsx');
    assert.ok(/<ItemIcon item=\{item\} size=\{22\} \/>/.test(wc),
        'WeaponCodex callsite 보존 (size only)');

    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/<ItemIcon item=\{item\} size=\{34\} showBorder/.test(sp),
        'ShopPanel callsite 보존');
});

test('cycle 585: cycle 502-584 회귀 가드 — default 청소 시리즈 보존', async () => {
    const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
    assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(jcp),
        'cycle 584 JobChangePanel onOpenArchiveConsole default 0건');

    const sb = await readSrc('src/components/StatusBar.tsx');
    assert.ok(!/const StatusMetric = \({ label, value, max, variant\s*=\s*'hp'/.test(sb),
        'cycle 583 StatusMetric variant default 0건');
});
