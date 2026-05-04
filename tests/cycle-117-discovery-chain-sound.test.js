import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 117: 발견 체인 완료 사운드 큐 — cycle 102/103 chain 보상 시스템 sensory cue.
 *
 * 발견:
 * - cycle 88(escape sound) / cycle 95+(maxKillStreak) 같은 결의 sensory gap.
 * - cycle 102에서 ach_chain_1/3/all + cycle 103 chain_master 칭호로 발견 체인을
 *   1급 시민 보상 시스템으로 만들었으나, 체인 완료 모먼트 자체에 audio cue 없음.
 *   gold/exp/premium 30000+ 가치의 보상이 시각/텍스트로만 노출.
 * - exploreUtils.checkDiscoveryChains는 'success' 로그만 출력 — 'success'는
 *   useGameEngine 사운드 매핑에 없음.
 *
 * 추가:
 * - SoundManager case 'discovery_chain' — G5/B5/D6/G6 4음 arpeggio (밝은 major
 *   톤). victory 5음(C major)과 levelUp 4음(C major)과 구분되는 G major 색채.
 * - exploreUtils.checkDiscoveryChains: 체인 완료 후 soundManager.play('discovery_chain')
 *   직접 호출. cycle 88 escape 사운드 패턴과 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SoundManager: case "discovery_chain" 분기 존재', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
});

test('exploreUtils: checkDiscoveryChains에서 discovery_chain 사운드 재생', async () => {
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.match(
        source,
        /soundManager.*\(['"]discovery_chain['"]\)|play\(['"]discovery_chain['"]\)/,
        'should call soundManager.play("discovery_chain") on chain completion'
    );
});

test('exploreUtils: soundManager import 추가됨', async () => {
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
});

test('SoundManager: 기존 escape/legendary 회귀 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]escape['"]\s*:/);
    assert.match(source, /case\s+['"]legendary['"]\s*:/);
});
