import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 89: 도주 스킬(escape_100) 코드 패스를 cycle 74-88 escape feedback chain에
 * 합류시킴.
 *
 * 발견된 회귀 / 누락:
 *   - CombatEngine performSkill에 effect: 'escape_100' 분기가 있어 100% 도주 보장
 *     스킬을 처리. 사용 클래스: '공허의 문'(시간술사), '순간 이동'(차원술사) 등
 *     2개 스킬.
 *   - combatAttack.ts forceEscape 분기는 단순히 dispatch SET_ENEMY=null + GS.IDLE
 *     만 처리하고:
 *       a) stats.escapes 증분 누락 (cycle 74)
 *       b) recentBattles에 escape record 푸시 누락 (cycle 74)
 *       c) escape 사운드 재생 누락 (cycle 88)
 *   - 결과: 도주 스킬 사용자는 'escape' 카운터가 0이라 cycle 76-77 quest/title,
 *     78 share, 80 stats panel, 86-87 reflection까지 전부 갱신 안 됨.
 *
 * 수정:
 *   forceEscape 분기를 일반 escape 성공 분기와 동일한 stats/sound 처리로 통합.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('combatAttack.ts forceEscape 분기가 stats.escapes 증분 처리', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    // forceEscape 블록 안에 escapes 누적 패턴이 있어야 함.
    // 단순한 grep — forceEscape 등장 이후 200자 이내에 escapes: ... + 1 패턴.
    const idx = source.indexOf('result.forceEscape');
    assert.ok(idx > -1, 'forceEscape branch should exist');
    const window = source.slice(idx, idx + 1600);
    assert.match(
        window,
        /escapes:\s*\(p\.stats\?\.escapes\s*\|\|\s*0\)\s*\+\s*1/,
        'forceEscape branch should increment stats.escapes (parity with cycle 74 normal escape path)'
    );
});

test('combatAttack.ts forceEscape 분기가 escape 사운드 재생', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    const idx = source.indexOf('result.forceEscape');
    const window = source.slice(idx, idx + 1600);
    assert.match(
        window,
        /soundManager.*\(['"]escape['"]\)|play\(['"]escape['"]\)/,
        'forceEscape branch should play escape sound (parity with cycle 88)'
    );
});

test('combatAttack.ts forceEscape 분기가 recentBattles escape record 푸시', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    const idx = source.indexOf('result.forceEscape');
    const window = source.slice(idx, idx + 1600);
    assert.match(
        window,
        /pushBattleRecord\([^)]+makeBattleRecord\(['"]escape['"]/,
        'forceEscape branch should push escape battle record (parity with cycle 74)'
    );
});

test('일반 escape 분기 회귀 보존 — stats/sound 처리 그대로', async () => {
    const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
    // 일반 escape 분기 (escapeResult.success) 가 여전히 stats.escapes + sound 처리
    const idx = source.indexOf("if (type === 'escape')");
    assert.ok(idx > -1, 'normal escape branch should exist');
    const window = source.slice(idx, idx + 2000);
    assert.match(window, /escapes:\s*\(p\.stats\?\.escapes\s*\|\|\s*0\)\s*\+\s*1/);
    assert.match(window, /soundManager.*\(['"]escape['"]\)/);
});

test('escape_100 스킬은 여전히 등록됨 (회귀 가드)', async () => {
    const source = await readSrc('src/data/classes.ts');
    assert.match(source, /effect:\s*['"]escape_100['"]/, 'escape_100 skill effect should still be registered');
});
