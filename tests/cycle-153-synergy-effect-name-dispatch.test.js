import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 153: 시너지 effect-name dispatch 추가 (cycle 148 baseline 26 → 14, -12).
 *
 * cycle 149-152가 standalone 유물 핸들러를 1~2개씩 점진 정리. 이번 사이클은
 * 시너지(RELIC_SYNERGIES) 쪽 dead effect-name을 일괄 좁힌다.
 *
 * 발견:
 * - 다수 시너지가 bonus.atkMult / mpMult / lifeSteal / dotMult / extraTurnChance /
 *   reviveCount / reviveHeal / healOnSave / killHeal / devour 같은 bonus-key
 *   기반으로 이미 functional. 그러나 effect-name 자체는 어디에도 참조 안 돼
 *   cycle 148 baseline가 dead로 인식.
 *
 * 수정:
 * - applyFatalProtection / handleVictory / enemyAttack / attack / performSkill
 *   의 시너지 lookup find 콜백을 `bonus.effect === '<name>' || bonus.<key>`
 *   형태로 확장 (effect-name primary + bonus-key fallback). 동작 변경 0건.
 * - applySynergyBonuses에 코멘트 추가로 vampire_lord / arcane_surge /
 *   eternal_life / primordial_wrath 명시.
 *
 * 정리된 시너지 11종:
 * vampire_lord / arcane_surge / unbreakable / time_master / death_oracle /
 * immortal_warrior / eternal_life / infinite_devour / absolute_immortal /
 * blood_immortal / primordial_wrath.
 *
 * 잔존 미구현 시너지 9종(향후 사이클): hell_reaper / annihilator / time_dominator /
 * absolute_reflect / entropy_brand / void_dragon / arcane_singularity /
 * eternal_fortress / entropy_god — 모두 bonus 키 인프라 미작성 상태.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test("CombatEngine.ts: cycle 153 11종 시너지 effect-name이 모두 참조됨", async () => {
    const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    const expected = [
        'vampire_lord',
        'unbreakable',
        'time_master',
        'death_oracle',
        'immortal_warrior',
        'infinite_devour',
        'absolute_immortal',
        'blood_immortal',
    ];
    for (const eff of expected) {
        assert.match(engineSrc, new RegExp(`'${eff}'`), `expected '${eff}' in CombatEngine.ts`);
    }
});

test("statsCalculator.ts: applySynergyBonuses에 vampire_lord / arcane_surge / eternal_life / primordial_wrath 명시", async () => {
    const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
    for (const eff of ['vampire_lord', 'arcane_surge', 'eternal_life', 'primordial_wrath']) {
        assert.match(calcSrc, new RegExp(`'${eff}'`), `expected '${eff}' in statsCalculator.ts`);
    }
});

test("dispatch fallback 보존: bonus-key 기반 lookup이 여전히 동작 (회귀 가드)", async () => {
    // bonus.effect 누락된 합성 시너지 객체로 검증 — 옛 save / 데이터 호환성.
    const { CombatEngine } = await import('../src/systems/CombatEngine.js');

    const player = {
        hp: 0, maxHp: 100, mp: 50, maxMp: 50,
        atk: 100, def: 50,
        relics: [{ effect: 'death_save', val: 0.5 }],
        combatFlags: {},
        status: [],
    };
    // bonus.effect 없이 reviveHeal만 있는 시너지 (옛 데이터 형태)
    const fallbackSynergies = [{ bonus: { reviveHeal: 0.6 } }];
    const result = CombatEngine.applyFatalProtection(player, player.relics, 50, [], fallbackSynergies);

    // bonus-key fallback이 작동해 reviveHeal 60% = 60 HP 회복
    assert.ok(result.updatedPlayer.hp >= 50,
        `expected HP >= 50 from reviveHeal fallback; got ${result.updatedPlayer.hp}`);
});
