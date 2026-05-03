import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 82: 합성/제작 카운터의 StatsPanel 노출 + INITIAL_STATE 선언적 일관성.
 *
 * 배경:
 * - cycle 80에서 ESCAPES를 stats panel에 노출시킨 패턴(cycle 74→80)을
 *   crafts/syntheses에도 적용해 모험 중 누적되는 보조 카운터들을 가시화.
 * - INITIAL_STATE.player.stats에는 crafts:0이 있지만 syntheses는 누락.
 *   incrementStat이 missing field를 0으로 안전 처리하지만, 선언적
 *   일관성을 위해 추가한다 (target='synths' achievement 3종이 cycle 30+
 *   부터 존재).
 *
 * 계약:
 *   1. INITIAL_STATE.player.stats에 syntheses: 0 선언
 *   2. StatsPanel statEntries에 'CRAFTS' 라벨 row 노출
 *   3. StatsPanel statEntries에 'SYNTHESES' 라벨 row 노출
 *   4. 기존 ESCAPES row 회귀 보존
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('INITIAL_STATE.player.stats에 syntheses: 0 선언', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(
        /syntheses:\s*0/.test(source),
        'INITIAL_STATE.player.stats should declare syntheses: 0'
    );
});

test('StatsPanel: CRAFTS row 노출', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(
        /label:\s*['"]CRAFTS['"]/.test(source),
        'StatsPanel should expose CRAFTS row'
    );
});

test('StatsPanel: SYNTHESES row 노출', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(
        /label:\s*['"]SYNTHESES['"]/.test(source),
        'StatsPanel should expose SYNTHESES row'
    );
});

test('StatsPanel: ESCAPES row 회귀 보존 (cycle 80)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    assert.ok(
        /label:\s*['"]ESCAPES['"]/.test(source),
        'ESCAPES row from cycle 80 must be preserved'
    );
});
