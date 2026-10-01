import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { MONSTERS } from '../src/data/monsters.js';
import { ALL_RESIST_ELEMENTS, EQUIPMENT_PASSIVES } from '../src/data/equipmentPassives.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { CANONICAL_EQUIPMENT } from '../src/utils/equipmentBaseIdentity.js';
import { findItemByName } from '../src/utils/gameUtils.js';
import { getItemStatText } from '../src/utils/equipmentUtils.js';
import {
    getEnemyAttackElement,
    getEquipmentPassives,
    getItemEquipmentPassive,
} from '../src/utils/equipmentPassives.js';

/**
 * 2026-10 Wave 57 — 장비 상시 효과(소유자 결정 "이번에 설계 · 구현"): 원소 저항 장비는 적 자신의 원소로 오는 공격의
 * 피해를 50% 줄이고(소유자 답 "몬스터의 자기 원소" · "50% 감소"), 재생 장비는 행동마다 최대 생명의 3% · 5%를
 * 회복한다(소유자 답 "3% · 5%"). 장비 설명은 오래전부터 이 효과를 약속했지만 읽는 곳이 없었다.
 */

const ROW = (type, name) => {
    const row = CANONICAL_EQUIPMENT.find((item) => item.type === type && item.name === name);
    assert.ok(row, `${type} ${name}`);
    return row;
};
const item = (name) => {
    const found = findItemByName(name);
    assert.ok(found, name);
    return { ...found };
};
/** 같은 수치 · 표에 없는 이름의 장비 — 효과만 뺀 대조군. */
const lookalike = (name, as = '시험 장비') => {
    const copy = { ...item(name), name: as };
    delete copy.baseItemName;
    return copy;
};
const makePlayer = (equip = {}, extra = {}) => ({
    name: '시험자', job: '나이트', level: 40, hp: 1_000, maxHp: 1_000, mp: 100, maxMp: 100, atk: 50, def: 0,
    inv: [], equip, status: [], titles: [], stats: { kills: 0 }, meta: {}, relics: [],
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
const makeEnemy = (resistance, extra = {}) => ({
    name: '시험 적', baseName: '시험 적', hp: 10_000, maxHp: 10_000, atk: 2_000, def: 0, level: 40, resistance,
    pattern: { guardChance: 0, heavyChance: 0 }, ...extra,
});
const hit = (player, enemy) => CombatEngine.enemyAttack(player, enemy, calculateFullStats(player), () => 0.5);
const RESIST_PROMISE = /저항|재생|회복력|에 강한/;

test('표의 모든 행은 실제 방어구 · 방패이고, 설명이 저항 · 재생을 약속하는 장비는 전부 표에 있다', () => {
    const tableKeys = [];
    for (const [type, rows] of Object.entries(EQUIPMENT_PASSIVES)) {
        for (const name of Object.keys(rows)) {
            ROW(type, name);
            tableKeys.push(`${type}:${name}`);
        }
    }
    const promised = CANONICAL_EQUIPMENT
        .filter((row) => (row.type === 'armor' || row.type === 'shield') && RESIST_PROMISE.test(row.desc || ''))
        .map((row) => `${row.type}:${row.name}`);
    assert.deepEqual([...tableKeys].sort(), [...promised].sort());
    assert.equal(tableKeys.length, 7);
    // "모든 원소를 저항한다" = 물리를 뺀 원소 전부. 그 밖의 저항은 장비 자신의 원소다.
    assert.deepEqual([...EQUIPMENT_PASSIVES.shield['원시의 이지스'].resist], [...ALL_RESIST_ELEMENTS]);
    assert.ok(!ALL_RESIST_ELEMENTS.includes('물리'));
    for (const [type, rows] of Object.entries(EQUIPMENT_PASSIVES)) {
        for (const [name, passive] of Object.entries(rows)) {
            if (!passive.resist || name === '원시의 이지스') continue;
            assert.deepEqual([...passive.resist], [ROW(type, name).elem], name);
        }
    }
    // 재생 비율은 소유자 답 그대로다.
    assert.equal(EQUIPMENT_PASSIVES.armor['세계수 갑주'].regenPerTurn, 0.03);
    assert.equal(EQUIPMENT_PASSIVES.armor['세계수 뿌리 갑옷'].regenPerTurn, 0.05);
    assert.equal(BALANCE.EQUIP_ELEMENT_RESIST_MULT, 0.5);
});

test('적 공격의 원소는 적 자신의 원소(resistance)다 — 물리는 원소가 아니다, 모든 몬스터가 원소를 갖는다', () => {
    assert.equal(getEnemyAttackElement({ resistance: '화염' }), '화염');
    assert.equal(getEnemyAttackElement({ resistance: '물리' }), null);
    assert.equal(getEnemyAttackElement({}), null);
    const monsters = Object.values(MONSTERS);
    assert.ok(monsters.length > 200);
    assert.ok(monsters.every((monster) => typeof monster.resistance === 'string'));
});

test('원소 저항: 막는 원소의 공격만 피해가 절반이다 — 장비 둘이 같은 원소를 막아도 한 번이다', () => {
    const fireArmor = makePlayer({ armor: item('화염 방어복') });
    const plainArmor = makePlayer({ armor: lookalike('화염 방어복') });
    // 같은 방어력에서 비교한다(대조군은 표에 없는 같은 수치의 갑옷).
    assert.equal(calculateFullStats(fireArmor).def, calculateFullStats(plainArmor).def);

    const resisted = hit(fireArmor, makeEnemy('화염'));
    const unresisted = hit(plainArmor, makeEnemy('화염'));
    assert.equal(resisted.damage, Math.floor(unresisted.damage * BALANCE.EQUIP_ELEMENT_RESIST_MULT));
    assert.ok(resisted.logs.some((log) => log.text === MSG.EQUIP_ELEMENT_RESIST_PROC('화염', 50, unresisted.damage, resisted.damage)));
    // 다른 원소 · 물리는 그대로.
    assert.equal(hit(fireArmor, makeEnemy('냉기')).damage, hit(plainArmor, makeEnemy('냉기')).damage);
    assert.equal(hit(fireArmor, makeEnemy('물리')).damage, hit(plainArmor, makeEnemy('물리')).damage);

    // 방어복 + 방패(둘 다 화염)도 50%다(75%가 아니다).
    const both = makePlayer({ armor: item('화염 방어복'), offhand: item('화염 방패') });
    const bothPlain = makePlayer({ armor: lookalike('화염 방어복'), offhand: lookalike('화염 방패') });
    assert.deepEqual(calculateFullStats(both).elementResists, ['화염']);
    assert.equal(hit(both, makeEnemy('화염')).damage, Math.floor(hit(bothPlain, makeEnemy('화염')).damage * 0.5));
});

test('원시의 이지스는 물리를 뺀 모든 원소의 공격을 절반으로 줄인다', () => {
    const aegis = makePlayer({ offhand: item('원시의 이지스') });
    const plain = makePlayer({ offhand: lookalike('원시의 이지스') });
    for (const element of ALL_RESIST_ELEMENTS) {
        const resisted = hit(aegis, makeEnemy(element)).damage;
        assert.equal(resisted, Math.floor(hit(plain, makeEnemy(element)).damage * 0.5), element);
    }
    assert.equal(hit(aegis, makeEnemy('물리')).damage, hit(plain, makeEnemy('물리')).damage);
});

test('도주 실패 피해도 적에게 받는 피해라 원소 저항을 받는다', () => {
    const fireArmor = makePlayer({ armor: item('화염 방어복') });
    const plain = makePlayer({ armor: lookalike('화염 방어복') });
    const fail = () => 0.1; // ESCAPE_CHANCE 0.5 이하 → 실패
    const resisted = CombatEngine.attemptEscape(makeEnemy('화염'), calculateFullStats(fireArmor), fail);
    const unresisted = CombatEngine.attemptEscape(makeEnemy('화염'), calculateFullStats(plain), fail);
    assert.equal(resisted.success, false);
    assert.equal(resisted.damage, Math.max(1, Math.floor(unresisted.damage * 0.5)));
});

test('효과는 표준 장비 정체성으로 찾는다 — 접두어 장비 · 예전 인스턴스(정체성 태그 없음)도 같다, 무기 칸은 효과가 없다', () => {
    const tagged = item('화염 방어복');
    const legacy = { ...tagged };
    delete legacy.baseItemName;
    const prefixed = { ...tagged, name: `단단한 ${tagged.name}`, prefixed: true, prefixName: '단단한', baseItemName: tagged.name };
    assert.deepEqual(getItemEquipmentPassive(legacy), { resist: ['화염'] });
    assert.deepEqual(getItemEquipmentPassive(prefixed), { resist: ['화염'] });
    assert.deepEqual(getEquipmentPassives({ weapon: { ...item('화염 방패'), type: 'weapon' } }).resist, []);
    assert.equal(getItemEquipmentPassive({ type: 'armor', name: '없는 갑옷' }), null);
});

test('재생 장비: 행동마다 최대 생명의 3% · 5% 회복 — 실효 최대에서 멈추고, 가득 차면 줄을 남기지 않는다', () => {
    for (const [name, ratio] of [['세계수 갑주', 0.03], ['세계수 뿌리 갑옷', 0.05]]) {
        const player = makePlayer({ armor: item(name) }, { hp: 100 });
        const tick = CombatEngine.tickCombatState(player, []);
        const heal = Math.floor(1_000 * ratio);
        assert.equal(tick.updatedPlayer.hp, 100 + heal, name);
        assert.ok(tick.logs.some((log) => log.text === MSG.RELIC_TURN_HP_REGEN(name, heal)), name);

        const effectiveMax = calculateFullStats(player).maxHp;
        const nearFull = CombatEngine.tickCombatState({ ...player, hp: effectiveMax - 1 }, []);
        assert.equal(nearFull.updatedPlayer.hp, effectiveMax, `${name} 상한`);
        const full = CombatEngine.tickCombatState({ ...player, hp: effectiveMax }, []);
        assert.equal(full.updatedPlayer.hp, effectiveMax);
        assert.ok(!full.logs.some((log) => log.text.includes(name)), `${name} 가득 차면 줄 없음`);
    }
    // 재생 장비가 없으면 회복 없음.
    const plain = makePlayer({ armor: lookalike('세계수 갑주') }, { hp: 100 });
    assert.equal(CombatEngine.tickCombatState(plain, []).updatedPlayer.hp, 100);
});

test('장비 문구가 효과를 데이터에서 그린다 — 저항 원소 · 모든 원소 · 재생 비율', () => {
    assert.ok(getItemStatText(item('화염 방어복')).includes(MSG.EQUIP_RESIST_STAT('화염', 50)));
    assert.ok(getItemStatText(item('화염 방패')).includes(MSG.EQUIP_RESIST_STAT('화염', 50)));
    assert.ok(getItemStatText(item('원시의 이지스')).includes(MSG.EQUIP_RESIST_STAT(MSG.EQUIP_RESIST_ALL_ELEMENTS, 50)));
    assert.ok(getItemStatText(item('세계수 갑주')).includes(MSG.EQUIP_REGEN_STAT(3)));
    assert.ok(getItemStatText(item('세계수 뿌리 갑옷')).includes(MSG.EQUIP_REGEN_STAT(5)));
    assert.ok(!getItemStatText(item('사슬 갑옷')).includes('%'));
});
