import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 154: 시너지 defMult / chaosAtk / critDmg 핸들러 추가 (cycle 148 baseline 14 → 11).
 *
 * cycle 153이 effect-name dispatch 11종을 일괄 정리한 후 진짜 미구현 영역을
 * 실제 구현으로 좁힌다.
 *
 * 1. eternal_fortress (defMult 0.8) — applySynergyBonuses 신규 defMult 누적
 *    필드 + finalDef 곱 반영.
 * 2. entropy_god (chaosAtk 0.5) — applySynergyBonuses에서 atkMult로 합류.
 * 3. void_dragon (critDmg 2.0) / primordial_wrath (critDmg 2.5) — CombatEngine
 *    attack / performSkill의 critDmgRelic 분기에 시너지 bonus.critDmg 곱셈
 *    추가. crit_dmg 유물과 동시 보유 시 곱연산.
 */

const fakePlayer = () => ({
    name: 'tester', job: '모험가', level: 50,
    hp: 1000, maxHp: 1000, mp: 500, maxMp: 500, atk: 1000, def: 500,
    inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], skillChoices: {}, titles: [], activeTitle: null,
    killStreak: 0, combatFlags: {}, status: [],
    stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
});

test("eternal_fortress (defMult 0.8): synergy 활성 시 def가 비활성 대비 ~1.80배", async () => {
    // 비활성: 3개 require 중 2개만 보유 → applySynergyBonuses defMult 미적용
    // 활성: 3개 require 전부 보유 → defMult +0.8 (배율 1.8)
    // 두 케이스 모두 같은 baseline 유물 stats 보유 → ratio가 정확히 defMult 효과를 반영.
    const { RELICS } = await import('../src/data/relics.js');
    const partial = ['난공불락', '암석 피부'].map((n) => RELICS.find((r) => r.name === n)).filter(Boolean);
    const full = ['난공불락', '암석 피부', '대지의 심장'].map((n) => RELICS.find((r) => r.name === n)).filter(Boolean);
    assert.equal(partial.length, 2);
    assert.equal(full.length, 3);

    const base = fakePlayer();
    const partialStats = calculateFullStats({ ...base, relics: partial });
    const fullStats = calculateFullStats({ ...base, relics: full });

    // 추가된 '대지의 심장'은 defFlat 없으므로 partial과 full의 baseline def 동일.
    // full에는 synergy defMult 0.8 추가 → ratio ~1.8.
    const defRatio = fullStats.def / partialStats.def;
    assert.ok(defRatio >= 1.70 && defRatio <= 1.90,
        `expected eternal_fortress def ratio ~1.80; got ${defRatio.toFixed(3)}`);
});

test("entropy_god (chaosAtk 0.5): finalAtk가 atkMult로 합류 (베이스라인 회귀)", async () => {
    const { RELICS } = await import('../src/data/relics.js');
    const requires = ['엔트로피 엔진', '죽음의 낙인', '혼돈의 보석'];
    const owned = requires.map((name) => RELICS.find((r) => r.name === name)).filter(Boolean);
    assert.equal(owned.length, requires.length, '시너지 require 유물 수집 실패');

    const base = fakePlayer();
    const baseStats = calculateFullStats(base);
    const synStats = calculateFullStats({ ...base, relics: owned });

    // entropy_god trigger require에 entropy_brand도 포함될 수 있어 atk 합산 효과 — ratio >= 1.4 보수 검증.
    const atkRatio = synStats.atk / baseStats.atk;
    assert.ok(atkRatio >= 1.40, `expected entropy_god 트리거 후 atk ratio >= 1.40; got ${atkRatio.toFixed(3)}`);
});

test("CombatEngine.ts: void_dragon / primordial_wrath critDmg 곱셈 분기 명시", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    assert.match(engineSrc, /'void_dragon'/);
    assert.match(engineSrc, /critDmgSyn/);
    assert.match(engineSrc, /critDmgSynSkill/);
});

test("statsCalculator.ts: synergyBonus.defMult가 finalDef 곱 인자로 사용됨", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
    assert.match(calcSrc, /synergyBonus\.defMult/);
    assert.match(calcSrc, /'eternal_fortress'/);
    assert.match(calcSrc, /'entropy_god'/);
});
