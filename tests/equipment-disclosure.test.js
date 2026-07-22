import test from 'node:test';
import assert from 'node:assert/strict';

import { getEquipmentDecision, getEquipmentDisclosure } from '../src/utils/equipmentUtils.ts';

test('equipment disclosure keeps the first journey simple and expands after level 5 or job change', () => {
    assert.deepEqual(getEquipmentDisclosure({ level: 1, job: '모험가' }), {
        mode: 'auto',
        isEarlyJourney: true,
        showDetails: false,
    });
    assert.equal(getEquipmentDisclosure({ level: 5, job: '모험가' }).showDetails, true);
    assert.equal(getEquipmentDisclosure({ level: 2, job: '레인저' }).showDetails, true);
});

test('explicit equipment detail preference overrides automatic progression', () => {
    assert.equal(getEquipmentDisclosure({
        level: 1,
        job: '모험가',
        settings: { equipmentDetailMode: 'full' },
    }).showDetails, true);
    assert.equal(getEquipmentDisclosure({
        level: 30,
        job: '나이트',
        settings: { equipmentDetailMode: 'summary' },
    }).showDetails, false);
});

test('two-hand job weapon reports two set pieces while one-hand gear reports one', () => {
    const player = { job: '레인저', equip: {} };
    const bow = {
        id: 'ranger_bow',
        name: '사냥꾼의 활',
        type: 'weapon',
        hands: 2,
        val: 12,
        jobs: ['레인저'],
    };
    const armor = {
        id: 'ranger_armor',
        name: '사냥꾼의 외투',
        type: 'armor',
        val: 8,
        jobs: ['레인저'],
    };

    assert.equal(getEquipmentDecision(player, bow)?.setContribution, 2);
    assert.equal(getEquipmentDecision(player, bow)?.setContributionText, '레인저 세트 +2');
    assert.equal(getEquipmentDecision(player, armor)?.setContribution, 1);
});

test('equipment decision exposes recommendation, primary delta and equipability', () => {
    const player = {
        job: '전사',
        equip: {
            weapon: { id: 'old', name: '낡은 검', type: 'weapon', val: 4, jobs: ['전사'] },
        },
    };
    const upgrade = getEquipmentDecision(player, {
        id: 'new',
        name: '강철 검',
        type: 'weapon',
        val: 10,
        jobs: ['전사'],
    });
    const blocked = getEquipmentDecision(player, {
        id: 'staff',
        name: '마도 지팡이',
        type: 'weapon',
        val: 20,
        jobs: ['마법사'],
    });

    assert.equal(upgrade?.recommendation, '추천 교체');
    assert.match(upgrade?.primaryDelta.text || '', /^공격력 \+/);
    assert.equal(upgrade?.equipable, true);
    assert.equal(blocked?.recommendation, '직업 제한');
    assert.equal(blocked?.equipable, false);
});
