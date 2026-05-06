import test from 'node:test';
import assert from 'node:assert/strict';

import { SEASON_XP } from '../src/data/seasonPass.js';
import { registerCodex, registerLootToCodex, countNewCodexEntries } from '../src/utils/gameUtils.js';

/**
 * cycle 193: SEASON_XP.codexDiscover dead config 활성 — 신규 codex 등록 시 시즌 XP 부여.
 *
 * 발견:
 * - SEASON_XP.codexDiscover (8 XP) 정의됐으나 dispatch 0건이던 dead config.
 * - 신규 monster / weapon / armor / shield / material 발견 시 시즌 XP 적립이
 *   spec에는 있지만 코드 미구현.
 * - explore/kill/bossKill/craft/quest/synth는 모두 dispatch 정상 — 'codexDiscover'만
 *   누락이던 inconsistency.
 *
 * 수정:
 * 1. src/utils/gameUtils.ts:
 *    - countNewCodexEntries 헬퍼 추가 — 호출 전후 codex 사이즈 차이로 신규 등록
 *      수 판정.
 * 2. src/hooks/combatActions/combatVictory.ts:
 *    - loot 추가 + monster 등록 직전/직후 countNewCodexEntries 비교.
 *    - newCount > 0이면 dispatch ADD_SEASON_XP * SEASON_XP.codexDiscover * newCount.
 */

test('cycle 193: SEASON_XP.codexDiscover key 정의됨 (dead config 회귀 가드)', () => {
    assert.equal(typeof SEASON_XP.codexDiscover, 'number');
    assert.ok(SEASON_XP.codexDiscover > 0);
});

test('cycle 193: countNewCodexEntries — codex 카테고리별 entry 수 합산', () => {
    const player = {
        stats: {
            codex: {
                weapons: { '강철 롱소드': { discovered: true } },
                armors: { '가죽 갑옷': { discovered: true }, '사슬 갑옷': { discovered: true } },
                monsters: { '슬라임': { discovered: true } },
            },
        },
    };
    assert.equal(countNewCodexEntries(player), 4);
});

test('cycle 193: registerCodex 신규 등록 시 count +1', () => {
    const player = { stats: { codex: { monsters: {} } } };
    const before = countNewCodexEntries(player);
    const updated = registerCodex(player, 'monsters', '슬라임');
    const after = countNewCodexEntries(updated);
    assert.equal(after - before, 1);
});

test('cycle 193: registerCodex 중복 등록 시 count 변화 없음', () => {
    const player = { stats: { codex: { monsters: { '슬라임': { discovered: true } } } } };
    const before = countNewCodexEntries(player);
    const updated = registerCodex(player, 'monsters', '슬라임');
    const after = countNewCodexEntries(updated);
    assert.equal(after - before, 0);
});

test('cycle 193: registerLootToCodex 다중 신규 등록 — 각 entry 별 count 증가', () => {
    const player = { stats: { codex: { weapons: {}, armors: {}, materials: {} } } };
    const before = countNewCodexEntries(player);
    const items = [
        { type: 'weapon', name: '강철 롱소드' },
        { type: 'armor', name: '가죽 갑옷' },
        { type: 'mat', name: '슬라임 젤리' },
    ];
    const updated = registerLootToCodex(player, items);
    const after = countNewCodexEntries(updated);
    assert.equal(after - before, 3);
});

test('cycle 193: combatVictory 호출에 SEASON_XP.codexDiscover 분기 추가됨 (코드 명시 가드)', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf8');
    assert.match(src, /SEASON_XP\.codexDiscover/);
    assert.match(src, /newCodexCount/);
});
