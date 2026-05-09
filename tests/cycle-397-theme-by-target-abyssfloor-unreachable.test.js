import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 397: AchievementPanel THEME_BY_TARGET `abyssFloor` unreachable lookup 정리
 *   (cycle 222-396 silent dead config 시리즈 160번째 — unreachable lens 회귀).
 *
 * 발견 (1 unreachable lookup entry):
 * - src/components/AchievementPanel.tsx THEME_BY_TARGET map에 `abyssFloor`와
 *   `abyssRecord` 두 키가 모두 정의됨.
 * - 유일 consumer (getTheme): `THEME_BY_TARGET[achievement?.target] || THEME_BY_TARGET.kills`.
 * - DB.ACHIEVEMENTS 6 abyss entry 모두 `target: 'abyssRecord'` (depth: 10/30/50/100/200/300).
 * - `target: 'abyssFloor'` achievement 0건 — `abyssFloor` 키 lookup 절대 hit 안 됨.
 * - 두 target 모두 동일 시각 톤 (`fuchsia-100`)이라 functional 동작 영향 없음.
 *
 * 패턴 (cycle 222-396 silent dead config 시리즈 160번째):
 * - cycle 359/361/392/395: 미스매치/normalize-bypass unreachable lookup lens.
 * - cycle 397: THEME_BY_TARGET 미사용 lookup key — 동일 lens 회귀.
 *
 * 수정 (src/components/AchievementPanel.tsx):
 * - `abyssFloor: { ... }` 라인 제거 (`abyssRecord` 단일 entry 잔존).
 *
 * 회귀 가드:
 * - abyssRecord 키 (실제 6 achievement target) 보존 — getTheme 동작 그대로.
 * - 나머지 19 키 (kills/bossKills/.../synths/maxKillStreak/discoveryChains) 보존.
 * - getTheme `|| THEME_BY_TARGET.kills` fallback 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 397: THEME_BY_TARGET에서 abyssFloor 0건', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const blockStart = source.indexOf('const THEME_BY_TARGET');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/abyssFloor:/.test(block),
        'THEME_BY_TARGET에서 abyssFloor 0건');
    assert.ok(/abyssRecord:/.test(block),
        'abyssRecord 단일 entry 보존');
});

test('cycle 397: 정합성 가드 — DB.ACHIEVEMENTS abyss target은 abyssRecord 단일', async () => {
    const { DB } = await import('../src/data/db.js');
    // ach_abyss_* id로 abyss achievement 조회 (제목/설명은 Korean '심연').
    const abyssAchievements = (DB.ACHIEVEMENTS || [])
        .filter((a) => /^ach_abyss_/.test(a.id || ''));
    assert.ok(abyssAchievements.length >= 6, `abyss achievement >=6 (실제: ${abyssAchievements.length})`);
    for (const a of abyssAchievements) {
        assert.equal(a.target, 'abyssRecord', `${a.id} target='abyssRecord' (실제: ${a.target})`);
    }
});

test('cycle 397: AchievementPanel 19 entry 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const preservedKeys = [
        'kills', 'bossKills', 'deaths', 'total_gold', 'level',
        'escapes', 'explores', 'discoveries', 'relicCount', 'crafts',
        'rests', 'bountiesCompleted', 'abyssRecord', 'demonKingSlain',
        'prestige', 'signaturesDiscovered', 'signatureSetsCompleted', 'synths',
        'maxKillStreak', 'discoveryChains',
    ];
    for (const key of preservedKeys) {
        const re = new RegExp(`^\\s+${key}:\\s+\\{`, 'm');
        assert.ok(re.test(source), `${key} entry 보존`);
    }
});

test('cycle 396 회귀 가드: StatsPanel syn.label fix 보존', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const blockStart = source.indexOf('stats.activeSynergies.map');
    const blockEnd = source.indexOf('))}', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/syn\.name/.test(block),
        'cycle 396 syn.name 0건 보존');
    assert.ok(/syn\.label/.test(block),
        'cycle 396 syn.label 보존');
});
