import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { DB } from '../src/data/db.ts';
import { buildContentReachabilityReport, canonicalizeContentReachability } from '../src/systems/contentReachability.ts';
import { getShopCatalog } from '../src/utils/shopRotation.ts';
import { getAllSignatureDropSourceIndex } from '../src/utils/signatureDropSources.ts';

const clone = (value) => structuredClone(value);

test('canonical content has the approved production catalog counts and routes', () => {
    const report = buildContentReachabilityReport();

    assert.deepEqual(report.catalog, {
        maps: 52,
        monsters: 254,
        quests: 143,
        jobs: 18,
        equipment: 229,
        signatures: 25,
    });
    assert.equal(report.maps.reachable.length, 52);
    assert.deepEqual(report.maps.unreachable, []);
    assert.deepEqual(report.maps.invalidExits, []);
    assert.equal(report.monsters.reachable.length, 254);
    assert.deepEqual(report.monsters.missingRoutes, []);
    assert.deepEqual(report.quests.invalidPrerequisites, []);
    assert.deepEqual(report.quests.prerequisiteCycles, []);
    assert.deepEqual(report.quests.unreachableTargets, []);
    assert.deepEqual(report.quests.invalidRewards, []);
    assert.equal(report.jobs.reachable.length, 18);
    assert.equal(report.jobs.terminalLineages.length, 8);
    assert.deepEqual(report.jobs.checkpointLevels, [2, 5, 10, 20, 45, 60, 75]);
    assert.deepEqual(
        report.jobs.checkpointSnapshots.map((checkpoint) => checkpoint.reachableJobCount),
        [1, 5, 5, 6, 13, 18, 18],
    );
    assert.deepEqual(
        report.jobs.checkpointSnapshots.at(-1).reachableJobs.toSorted(),
        report.jobs.reachable.toSorted(),
    );
    assert.equal(report.jobs.jobSnapshotCount, 18);
    assert.equal(report.equipment.routes.length, 229);
    assert.deepEqual(report.equipment.missingRoutes, []);
    assert.equal(report.equipment.prematureEquipCount, 0);
    assert.equal(report.signatures.routes.length, 25);
    assert.deepEqual(report.signatures.missingDropRoutes, []);
    assert.deepEqual(report.errors, []);
});

test('reachability projection is deterministic and hashable without mutating source data', () => {
    const before = JSON.stringify(DB.MAPS);
    const first = buildContentReachabilityReport();
    const second = buildContentReachabilityReport();
    assert.deepEqual(canonicalizeContentReachability(first), canonicalizeContentReachability(second));
    const hash = createHash('sha256')
        .update(JSON.stringify(canonicalizeContentReachability(first)))
        .digest('hex');
    assert.equal(hash.length, 64);
    assert.equal(JSON.stringify(DB.MAPS), before);
});

test('canonical shop routes come from the production shop catalog', () => {
    const report = buildContentReachabilityReport();
    const stock = new Set(getShopCatalog('시작의 마을').map((item) => item.name));
    for (const route of report.equipment.routes) {
        assert.equal(route.sources.includes('시작의 마을'), stock.has(route.name));
    }
});

test('map exits, monster routes, quest references, and equipment routes fail closed', () => {
    const maps = clone(DB.MAPS);
    maps['시작의 마을'].exits = [...maps['시작의 마을'].exits, '없는 지역'];
    const mapReport = buildContentReachabilityReport({ ...DB, MAPS: maps });
    assert.ok(mapReport.maps.invalidExits.includes('시작의 마을→없는 지역'));

    const monsters = clone(DB.MONSTERS);
    const routeMonster = Object.keys(monsters).find((name) => name === '슬라임');
    for (const map of Object.values(maps)) {
        map.monsters = (map.monsters || []).filter((name) => name !== routeMonster);
        map.bossMonsters = (map.bossMonsters || []).filter((name) => name !== routeMonster);
    }
    const monsterReport = buildContentReachabilityReport({ ...DB, MAPS: maps, MONSTERS: monsters });
    assert.ok(monsterReport.monsters.missingRoutes.includes(routeMonster));

    const quests = clone(DB.QUESTS);
    quests[0] = { ...quests[0], prerequisiteQuestId: '없는 퀘스트' };
    const questReport = buildContentReachabilityReport({ ...DB, MAPS: DB.MAPS, QUESTS: quests });
    assert.ok(questReport.quests.invalidPrerequisites.includes(quests[0].id));

    const items = clone(DB.ITEMS);
    const hiddenEquipment = '롱소드';
    const allMaps = Object.fromEntries(Object.entries(DB.MAPS).map(([name, map]) => [name, {
        ...map,
        type: map.type === 'safe' ? 'field' : map.type,
        monsters: [...(map.monsters || [])],
        bossMonsters: [...(map.bossMonsters || [])],
    }]));
    const equipmentReport = buildContentReachabilityReport({ ...DB, MAPS: allMaps, ITEMS: items });
    assert.ok(equipmentReport.equipment.missingRoutes.includes(hiddenEquipment));
});

test('prerequisite cycles and malformed progression gates are reported', () => {
    const quests = clone(DB.QUESTS);
    const first = quests[0];
    const second = quests[1];
    quests[0] = { ...first, prerequisiteQuestId: second.id };
    quests[1] = { ...second, prerequisiteQuestId: first.id };
    const cycleReport = buildContentReachabilityReport({ ...DB, QUESTS: quests });
    assert.ok(cycleReport.quests.prerequisiteCycles.length > 0);

    const items = clone(DB.ITEMS);
    items.weapons[0] = { ...items.weapons[0], tier: 99 };
    const malformedReport = buildContentReachabilityReport({ ...DB, ITEMS: items });
    assert.ok(malformedReport.errors.some((error) => error.startsWith('INVALID_EQUIPMENT_GATE:')));
});

test('custom source reachability compares against its own graph instead of the live catalog', () => {
    const maps = {
        '시작의 마을': { ...clone(DB.MAPS['시작의 마을']), exits: [] },
    };
    const report = buildContentReachabilityReport({ ...DB, MAPS: maps });
    assert.deepEqual(report.maps.reachable, ['시작의 마을']);
    assert.equal(report.errors.includes('UNREACHABLE_MAPS'), false);
});

test('class, quest reward, and signature source corruption fail closed', () => {
    const classes = clone(DB.CLASSES);
    classes['전사'] = { ...classes['전사'], reqLv: Number.NaN };
    const classReport = buildContentReachabilityReport({ ...DB, CLASSES: classes });
    assert.ok(classReport.errors.includes('INVALID_CLASS_GATE:전사'));

    const quests = clone(DB.QUESTS);
    quests[0] = {
        ...quests[0],
        minLv: 999,
        reward: { ...quests[0].reward, exp: -1, gold: Number.NaN },
    };
    const questReport = buildContentReachabilityReport({ ...DB, QUESTS: quests });
    assert.ok(questReport.quests.invalidRewards.includes(quests[0].id));

    const signatures = clone(getAllSignatureDropSourceIndex());
    const signatureName = Object.keys(signatures)[0];
    signatures[signatureName] = [];
    const signatureReport = buildContentReachabilityReport(DB, signatures);
    assert.ok(signatureReport.signatures.missingDropRoutes.includes(signatureName));
});
