import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 118: 첫 방문 지역 사운드 큐 — cycle 117 discovery_chain 사운드와 짝.
 *
 * 발견:
 * - cycle 83에서 'discoveries' 시맨틱을 visitedMaps.length로 통일하면서 첫 방문이
 *   영구 카운터로 잡힘. cycle 102/103에서 chain 보상 시스템도 1급 시민이 됐고
 *   cycle 117에서 chain 완료 사운드 추가.
 * - 그러나 첫 방문 자체의 audio cue는 없음 (MOVE_NEW_AREA 'event' 로그는
 *   useGameEngine 사운드 매핑에 없음).
 *
 * 추가:
 * - SoundManager case 'new_area' — D5/F#5/A5 D major triad 짧은 arpeggio.
 *   discovery_chain(G major 4음 0.6s)보다 가볍고 짧음 (3음 0.3s).
 * - moveActions: firstVisit 분기에서 soundManager.play('new_area') 직접 호출.
 *   cycle 88(escape) / cycle 117(discovery_chain) 패턴.
 *
 * 톤 차별화:
 * - victory: C major 5음 (0.6s+) — 전투 승리
 * - legendary: C major + B6 shimmer (0.7s) — 전설 드롭
 * - discovery_chain: G major 4음 (0.6s) — 체인 완료 (cycle 117)
 * - new_area: D major 3음 (0.3s) — 첫 방문 (가볍고 빠름)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SoundManager: case "new_area" 분기 존재', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]new_area['"]\s*:/);
});

test('moveActions: firstVisit 분기에서 new_area 사운드 재생', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    assert.match(
        source,
        /soundManager.*\(['"]new_area['"]\)|play\(['"]new_area['"]\)/,
        'should call soundManager.play("new_area") on first visit'
    );
});

test('moveActions: soundManager import 추가됨', async () => {
    const source = await readSrc('src/hooks/gameActions/moveActions.ts');
    assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
});

test('SoundManager: cycle 117 discovery_chain 회귀 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
});
