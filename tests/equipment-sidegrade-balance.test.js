import assert from 'node:assert/strict';
import test from 'node:test';

import { BALANCE } from '../src/data/constants.js';
import { ITEMS } from '../src/data/items.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import { buildClassVitals } from '../src/hooks/gameActions/_shared.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

const EQUIPMENT = [...ITEMS.weapons, ...ITEMS.armors];
const FLOAT_TOLERANCE = 1e-9;
const PRODUCTION_DIMENSIONS = ['atk', 'def', 'maxHp', 'maxMp', 'crit', 'evasion'];

const SIDEGRADES = [
    {
        type: 'armor',
        name: '레인저 외투',
        dominator: '강화가죽갑옷',
        field: 'evasion',
        value: 0.03,
        desc_stat: 'DEF+13 / 회피+3%',
        exact: { val: 13, price: 290, jobs: ['레인저'] },
        deltas: [{ job: '레인저', evasion: 0.03 }],
    },
    {
        type: 'weapon',
        name: '독아 채찍',
        dominator: '독사의 송곳니',
        field: 'crit',
        value: 0.09,
        desc_stat: 'ATK+47(독) / CRIT+9%',
        exact: { val: 47, price: 1250, jobs: ['어쌔신'] },
        deltas: [{ job: '어쌔신', crit: 0.05 }],
    },
    {
        type: 'weapon',
        name: '성운 지팡이',
        dominator: '신전 도시의 지팡이',
        field: 'mpBonus',
        value: 20,
        desc_stat: 'ATK+195(빛) / MP+20 / 2H',
        exact: { val: 195, price: 30500, hands: 2, elem: '빛', jobs: ['아크메이지', '흑마법사'] },
        deltas: [{ job: '아크메이지', maxMp: 62 }, { job: '흑마법사', maxMp: 69 }],
    },
    {
        type: 'weapon',
        name: '폭풍 스태프',
        dominator: '고대 마탑 스태프',
        field: 'mpBonus',
        value: 10,
        desc_stat: 'ATK+56(빛) / MP+10 / 2H',
        exact: { val: 56, price: 1620, hands: 2, elem: '빛', jobs: ['마법사', '아크메이지'] },
        deltas: [{ job: '마법사', maxMp: 31 }, { job: '아크메이지', maxMp: 36 }],
    },
];

const findEquipment = (name) => {
    const item = EQUIPMENT.find((row) => row.name === name);
    assert.ok(item, `missing canonical equipment: ${name}`);
    return item;
};

const buildProductionPlayer = (job, tier, item = null) => {
    const level = BALANCE.TIER_REQ_LEVEL[tier];
    const vitals = buildClassVitals(level, job, { bonusHp: 0, bonusMp: 0, prestigeRank: 0 });
    const equip = { weapon: null, armor: null, offhand: null };
    if (item) equip[item.type === 'shield' ? 'offhand' : item.type] = item;
    return {
        name: 'equipment-sidegrade-balance',
        job,
        level,
        hp: vitals.maxHp,
        maxHp: vitals.maxHp,
        mp: vitals.maxMp,
        maxMp: vitals.maxMp,
        atk: 10,
        def: 5,
        equip,
        relics: [],
        stats: {},
        meta: { bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0 },
        skillChoices: {},
        titles: [],
        activeTitle: null,
    };
};

const projectProductionDelta = (row, job) => {
    const baseline = calculateFullStats(buildProductionPlayer(job, row.tier));
    const equipped = calculateFullStats(buildProductionPlayer(job, row.tier, row));
    return {
        atk: equipped.atk - baseline.atk,
        def: equipped.def - baseline.def,
        maxHp: equipped.maxHp - baseline.maxHp,
        maxMp: equipped.maxMp - baseline.maxMp,
        crit: equipped.critChance - baseline.critChance,
        // CombatEngine.enemyAttack owns armor evasion as this literal passive chance.
        evasion: row.type === 'armor' ? (row.evasion || 0) : 0,
    };
};

const compareProductionValue = (left, right, dimension) => {
    if (dimension === 'crit' || dimension === 'evasion') {
        if (Math.abs(left - right) <= FLOAT_TOLERANCE) return 0;
    }
    return left === right ? 0 : left > right ? 1 : -1;
};

const isStrictDominator = (dominator, candidate) => {
    if (candidate.type !== dominator.type || candidate.tier !== dominator.tier) return false;
    if (SIGNATURE_ITEM_REGISTRY[candidate.name]) return false;
    if (dominator.price > candidate.price) return false;
    if ((dominator.hands || 1) > (candidate.hands || 1)) return false;
    if ((dominator.elem || null) !== (candidate.elem || null)) return false;

    let hasStrictImprovement = false;
    for (const job of candidate.jobs) {
        if (!dominator.jobs.includes(job)) return false;
        const candidateDelta = projectProductionDelta(candidate, job);
        const dominatorDelta = projectProductionDelta(dominator, job);
        for (const dimension of PRODUCTION_DIMENSIONS) {
            const relation = compareProductionValue(dominatorDelta[dimension], candidateDelta[dimension], dimension);
            if (relation < 0) return false;
            if (relation > 0) hasStrictImprovement = true;
        }
    }
    return hasStrictImprovement;
};

for (const sidegrade of SIDEGRADES) {
    test(`${sidegrade.name} has the approved secondary stat and exact player copy`, () => {
        const item = findEquipment(sidegrade.name);
        const actual = {
            type: item.type,
            val: item.val,
            price: item.price,
            jobs: item.jobs,
            [sidegrade.field]: item[sidegrade.field],
            desc_stat: item.desc_stat,
        };
        if ('hands' in sidegrade.exact) actual.hands = item.hands;
        if ('elem' in sidegrade.exact) actual.elem = item.elem;
        assert.deepEqual(
            actual,
            {
                type: sidegrade.type,
                ...sidegrade.exact,
                [sidegrade.field]: sidegrade.value,
                desc_stat: sidegrade.desc_stat,
            },
        );
    });
}

test('sidegrades use production vitals and full-stat projections for their exact runtime deltas', () => {
    for (const sidegrade of SIDEGRADES) {
        const item = findEquipment(sidegrade.name);
        for (const expected of sidegrade.deltas) {
            const delta = projectProductionDelta(item, expected.job);
            for (const [dimension, value] of Object.entries(expected)) {
                if (dimension === 'job') continue;
                assert.ok(
                    Math.abs(delta[dimension] - value) <= FLOAT_TOLERANCE,
                    `${sidegrade.name} ${expected.job} ${dimension}: expected ${value}, received ${delta[dimension]}`,
                );
            }
        }
    }
});

test('레인저 외투 applies its exact evasion threshold through CombatEngine.enemyAttack', () => {
    const coat = findEquipment('레인저 외투');
    const player = buildProductionPlayer('레인저', coat.tier, coat);
    const stats = calculateFullStats(player);
    const result = CombatEngine.enemyAttack(player, { name: 'sidegrade dummy', hp: 1, maxHp: 1 }, stats, () => 0.029);

    assert.equal(coat.evasion, 0.03);
    assert.equal(result.damage, 0);
    assert.match(result.logs.at(-1).text, /\[회피\]/);
});

test('the four former dominance pairs are removed without creating a new strict dominator', () => {
    for (const sidegrade of SIDEGRADES) {
        const candidate = findEquipment(sidegrade.name);
        const formerDominator = findEquipment(sidegrade.dominator);
        assert.equal(isStrictDominator(formerDominator, candidate), false, `${sidegrade.name} remains dominated`);

        const newlyDominated = EQUIPMENT
            .filter((row) => row !== candidate && isStrictDominator(candidate, row))
            .map((row) => `${row.type}:${row.name}`);
        assert.deepEqual(newlyDominated, [], `${sidegrade.name} must not become a dominator`);
    }
});

test('removing each secondary field restores exactly its former dominance pair', () => {
    for (const sidegrade of SIDEGRADES) {
        const candidate = findEquipment(sidegrade.name);
        const predecessor = { ...candidate };
        delete predecessor[sidegrade.field];
        const formerDominator = findEquipment(sidegrade.dominator);

        assert.equal(
            isStrictDominator(formerDominator, predecessor),
            true,
            `${sidegrade.name} predecessor must restore ${sidegrade.dominator} dominance`,
        );
    }
});

test('신전 도시의 지팡이 keeps its source identity and production effective attack projection', () => {
    const signature = findEquipment('신전 도시의 지팡이');
    assert.equal(SIGNATURE_ITEM_REGISTRY[signature.name]?.spriteKey, 'signature-weapon-temple-city-staff');
    assert.deepEqual(
        {
            type: signature.type,
            val: signature.val,
            price: signature.price,
            hands: signature.hands,
            elem: signature.elem,
            jobs: signature.jobs,
            desc_stat: signature.desc_stat,
        },
        {
            type: 'weapon',
            val: 188,
            price: 29500,
            hands: 2,
            elem: '빛',
            jobs: ['아크메이지', '흑마법사'],
            desc_stat: 'ATK+188(빛) / 2H',
        },
    );
    assert.deepEqual(
        signature.jobs.map((job) => ({ job, atk: projectProductionDelta(signature, job).atk })),
        [{ job: '아크메이지', atk: 864 }, { job: '흑마법사', atk: 792 }],
    );
});
