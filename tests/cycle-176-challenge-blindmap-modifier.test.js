import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 176: 'blindMap' challenge modifier 활성 + 회귀 가드.
 *
 * 발견:
 * - constants.ts CHALLENGE_MODIFIERS에 6종 정의:
 *   halfHp / noGold / randomSkills / eliteOnly / noPotion / blindMap.
 * - 5종은 핸들러 보유 (각각 characterActions / CombatEngine / combatAttack /
 *   exploreUtils / useInventoryActions). 'blindMap'만 핸들러 0건 — 선택해도
 *   효과 없는 silent no-op.
 *
 * 수정:
 * 1. StatusBar의 위치 표시(player.loc)에 challengeModifiers.includes('blindMap')
 *    분기 추가 — '???' 표시로 대체.
 * 2. CHALLENGE_MODIFIERS의 모든 modifier id가 src/ 어딘가에서 핸들러로
 *    참조되는지 회귀 가드 (cycle 134/138/141/148/164/165 패턴).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    let out = '';
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out += await walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
            out += await readFile(full, 'utf8');
            out += '\n';
        }
    }
    return out;
};

test('cycle 176: 모든 CHALLENGE_MODIFIERS id가 src/에서 핸들러 참조됨', async () => {
    const corpus = await walk(SRC);
    // constants.ts 자체는 corpus에 포함됨 — modifier id의 단순 정의는 카운트에서 빼야 함.
    // includes('id') 또는 ['id'] 패턴 등 핸들러 패턴이 1+개여야 한다.
    const constantsSrc = await readFile(path.join(SRC, 'data/constants.ts'), 'utf8');

    const dead = [];
    for (const mod of BALANCE.CHALLENGE_MODIFIERS) {
        const id = mod.id;
        // includes('id') 패턴이 constants.ts 외부에 1+ 있는지.
        const re = new RegExp(`includes\\(['"]${id}['"]\\)`, 'g');
        const all = (corpus.match(re) || []).length;
        const inConstants = (constantsSrc.match(re) || []).length;
        const elsewhere = all - inConstants;
        if (elsewhere === 0) dead.push(id);
    }
    assert.deepEqual(dead, [],
        `dead challenge modifiers (no handler):\n  ${dead.join('\n  ')}`);
});

test('cycle 176: StatusBar에 blindMap 분기 명시', async () => {
    const sbSrc = await readFile(path.join(ROOT, 'src/components/StatusBar.tsx'), 'utf8');
    assert.match(sbSrc, /'blindMap'/, 'StatusBar에 blindMap 분기 명시');
    assert.match(sbSrc, /\?\?\?/, '???대체 표시');
});
