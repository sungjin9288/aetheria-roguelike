import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * LegendaryDropOverlay — signature surface 일관성 wrap-up.
 *
 * cycle 11~29에 걸쳐 모든 signature surface는 stable testid를 가졌다:
 * legendary-codex-empty-hint, ascension-signature-preserve,
 * run-summary-signatures, status-signature-chip, combat-signature-drop-hint,
 * mobile-summary-signature-${slot}, move-recommendation-signature-${name},
 * inventory-signature-chip-${id}, equipment-signature-chip-${slot},
 * grave-signature-bounty-${uid}, bestiary-signature-drops,
 * legendary-codex-pity-status, post-combat-legendary.
 *
 * 단 한 곳, drop 모먼트의 풀스크린 overlay만 testid 없이 동적
 * data-legendary-drop={item.name} 속성에만 의존. 이 사이클로 일관성을 닫는다.
 *
 * 계약:
 *   1. data-testid="legendary-drop-overlay" 노출
 *   2. 기존 data-legendary-drop={item.name} 회귀 보존
 *   3. 기존 role="alertdialog" 회귀 보존 (스크린리더 지원)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('LegendaryDropOverlay exposes legendary-drop-overlay testid', async () => {
    const source = await readSrc('src/components/LegendaryDropOverlay.tsx');
    assert.ok(
        /data-testid\s*=\s*["']legendary-drop-overlay["']/.test(source),
        'should expose data-testid="legendary-drop-overlay"'
    );
});

test('LegendaryDropOverlay preserves dynamic data-legendary-drop attribute (regression)', async () => {
    const source = await readSrc('src/components/LegendaryDropOverlay.tsx');
    assert.ok(
        /data-legendary-drop\s*=\s*\{\s*item\.name\s*\}/.test(source),
        'data-legendary-drop={item.name} dynamic attribute must be preserved for per-item selection'
    );
});

test('LegendaryDropOverlay preserves role="alertdialog" (a11y regression)', async () => {
    const source = await readSrc('src/components/LegendaryDropOverlay.tsx');
    assert.ok(
        /role\s*=\s*["']alertdialog["']/.test(source),
        'role="alertdialog" must be preserved for screen reader announcement'
    );
});
