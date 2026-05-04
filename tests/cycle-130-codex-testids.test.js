import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 130: Codex testid 노출 — testid sweep 마무리.
 *
 * Codex는 무기/방어구/방패/몬스터/레시피/재료/Legendary 7개 도감 + milestone
 * 수령 버튼이 있는 핵심 진행 surface. e2e가 도감 milestone 수령 흐름을
 * 자동화하려면 stable selector 필요.
 *
 * 추가 (cycle 18+ 명명 패턴 일관):
 * - data-testid="codex-panel" — 루트.
 * - data-testid={`codex-tab-${tab.id}`} — 3개 sub tab (equip / monsters /
 *   legend).
 * - data-testid={`codex-claim-${m.id}`} — milestone 수령 버튼.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('Codex: codex-panel root testid 노출', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.match(source, /data-testid\s*=\s*["']codex-panel["']/);
});

test('Codex: codex-tab-{tab.id} dynamic testid 노출', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.match(source, /data-testid\s*=\s*\{`codex-tab-\$\{[^}]+\}`\}/);
});

test('Codex: codex-claim-{milestone.id} dynamic testid 노출', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    assert.match(source, /data-testid\s*=\s*\{`codex-claim-\$\{[^}]+\}`\}/);
});
