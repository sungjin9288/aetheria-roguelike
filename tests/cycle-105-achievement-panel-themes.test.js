import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 105: AchievementPanel THEME_BY_TARGET에 누락된 신규 target 2종 추가.
 *
 * 발견:
 * - cycle 95(maxKillStreak)와 cycle 102(discoveryChains)에서 추가한 achievement
 *   target들이 cycle 79에서 정착된 THEME_BY_TARGET 매핑에 누락되어 있음.
 * - 결과: ach_streak_5/10/20과 ach_chain_1/3/all이 AchievementPanel에서
 *   default fallback인 kills 테마(붉은색 Swords)로 표시. maxKillStreak는
 *   StatsPanel(cycle 96)에서 Flame red, discoveryChains는 StatsPanel(cycle 104)
 *   에서 Link2 indigo로 차별화돼 있어 surface 일관성이 깨진 상태.
 *
 * 추가:
 * - maxKillStreak: { icon: Flame, red 톤 } — StatsPanel cycle 96 톤과 매치.
 * - discoveryChains: { icon: Link2, indigo 톤 } — StatsPanel cycle 104 + 칭호
 *   chain_master(cycle 103) 톤과 매치.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('THEME_BY_TARGET: maxKillStreak entry 등록됨', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.match(source, /maxKillStreak\s*:\s*\{[^}]*Flame/);
});

test('THEME_BY_TARGET: discoveryChains entry 등록됨', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    assert.match(source, /discoveryChains\s*:\s*\{[^}]*Link2/);
});

test('THEME_BY_TARGET: maxKillStreak가 red 계열 톤', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const idx = source.indexOf('maxKillStreak:');
    const window = source.slice(idx, idx + 300);
    assert.match(window, /red-/);
});

test('THEME_BY_TARGET: discoveryChains가 indigo 계열 톤', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const idx = source.indexOf('discoveryChains:');
    const window = source.slice(idx, idx + 300);
    assert.match(window, /indigo-/);
});

test('lucide imports: Flame / Link2 추가됨', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const importLine = source.split('\n').find((l) => l.includes("from 'lucide-react'"));
    assert.ok(importLine, 'should have lucide-react import');
    assert.ok(importLine.includes('Flame'), 'Flame import missing');
    assert.ok(importLine.includes('Link2'), 'Link2 import missing');
});

test('기존 cycle 79 테마 14종 회귀 보존', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    for (const target of ['escapes', 'explores', 'discoveries', 'relicCount', 'crafts', 'rests',
        'bountiesCompleted', 'abyssRecord', 'demonKingSlain', 'prestige',
        'signaturesDiscovered', 'signatureSetsCompleted', 'synths']) {
        assert.match(source, new RegExp(`${target}\\s*:`));
    }
});
