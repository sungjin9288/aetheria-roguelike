import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 104: StatsPanel에 CHAINS row 추가 — discoveryChains 진행도 가시화.
 *
 * cycle 102/103에서 ach_chain_1/3/all + chain_master 칭호를 깔았으나
 * StatsPanel에는 노출되지 않은 상태. cycle 80(ESCAPES) / cycle 82(CRAFTS,
 * SYNTHESES) / cycle 96(MAX STREAK)와 동일 패턴으로 가시화 — 카운터 시스템
 * 마다 ach + 칭호 + StatsPanel row 한 짝의 일관 구조.
 *
 * 추가:
 * - StatsPanel statEntries에 'CHAINS' label row (Map 아이콘 또는 적절한
 *   indigo 톤 — chain_master 칭호 색과 매치).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('StatsPanel: CHAINS row 노출', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.match(source, /label:\s*['"]CHAINS['"]/);
});

test('StatsPanel: CHAINS row가 stats.discoveryChains 배열 길이를 읽음', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    // value 표현식에 discoveryChains와 length 둘 다 등장
    const idx = source.indexOf("label: 'CHAINS'");
    assert.ok(idx > -1);
    const window = source.slice(idx, idx + 300);
    assert.match(window, /discoveryChains/);
    assert.match(window, /\.length/);
});

test('StatsPanel: 기존 row 회귀 보존 (cycle 80/82/96)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.match(source, /label:\s*['"]ESCAPES['"]/);
    assert.match(source, /label:\s*['"]CRAFTS['"]/);
    assert.match(source, /label:\s*['"]SYNTHESES['"]/);
    assert.match(source, /label:\s*['"]MAX STREAK['"]/);
});
