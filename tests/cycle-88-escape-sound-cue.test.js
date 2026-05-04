import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 88: 도주 성공 사운드 큐 — escape feedback chain의 마지막 sensory channel.
 *
 * 배경:
 * - cycle 74에서 stats.escapes를 도입한 뒤 76(quest), 77(title), 78(share),
 *   80(StatsPanel), 86(RunSummaryCard chip), 87(focus advice)까지 시각/텍스트
 *   표면을 닫았으나, 도주 성공 모먼트 자체에는 sensory 큐가 없음 (실패는
 *   'error' 로그가 'error' 사운드를 트리거하지만 성공은 'info' 로그라 mapping
 *   되지 않음).
 * - victory(승리)는 5음 상승, escape(도주)는 그것과 대비되는 가벼운 retreat
 *   tone — 후퇴이지만 위험 회피 성공의 안도감.
 *
 * 추가:
 * - SoundManager.play case 'escape' — 짧은 하강 sine (1100 → 600Hz)
 * - combatAttack.ts: 도주 성공 분기에서 soundManager.play('escape') 호출
 *
 * 'attack' 사운드(useGameEngine 'combat' 로그 매핑)나 'item' 사운드(직접 호출)
 * 처럼, escape는 직접 호출 패턴으로 (info 로그 type을 좁히지 않으면 다른
 * info 로그도 escape sound 트리거하기 때문).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SoundManager: case "escape" 분기 존재', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(
        source,
        /case\s+['"]escape['"]\s*:/,
        'SoundManager.play should handle "escape" case'
    );
});

test('combatAttack.ts: 도주 성공 분기에서 escape 사운드 재생', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.ok(
        /soundManager.*\(['"]escape['"]\)/.test(source) || /play\(['"]escape['"]\)/.test(source),
        'combatAttack should call soundManager.play("escape") on escape success'
    );
});

test('combatAttack.ts: soundManager import 추가됨', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    assert.match(
        source,
        /import\s*\{[^}]*soundManager[^}]*\}\s*from/,
        'combatAttack should import soundManager'
    );
});

test('SoundManager: 기존 legendary chord 회귀 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(
        source,
        /case\s+['"]legendary['"]\s*:/,
        'cycle 20 legendary case must be preserved'
    );
});
