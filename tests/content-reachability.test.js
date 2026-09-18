import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { DB } from '../src/data/db.ts';
import { buildContentReachabilityReport, canonicalizeContentReachability } from '../src/systems/contentReachability.ts';
import { getShopCatalog } from '../src/utils/shopRotation.ts';
import { getAllSignatureDropSourceIndex } from '../src/utils/signatureDropSources.ts';

const clone = (value) => structuredClone(value);

test('안전 지역에 등록만 된 몬스터를 모바일 조우 가능으로 세지 않는다', () => {
    const maps = clone(DB.MAPS);
    maps['시작의 마을'].monsters = ['황금 왕국 수호자'];
    maps['황금 왕국'].monsters = maps['황금 왕국'].monsters.filter((name) => name !== '황금 왕국 수호자');
    const report = buildContentReachabilityReport({ ...DB, MAPS: maps });
    assert.ok(report.monsters.missingRoutes.includes('황금 왕국 수호자'));
});

test('canonical content has the approved production catalog counts and routes', () => {
    const report = buildContentReachabilityReport();

    assert.equal(report.schemaVersion, 2);
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

// ── Wave 12 D1: 접근 비용 축 ────────────────────────────────────────────────
// "도달 가능한가"(unreachable: [])는 비용 축이 없으면 공허하다 — 이 블록은 각 콘텐츠
// 계열의 게이트 레벨과 그 레벨의 모델 액션/초/시간을 고정하고, 무엇보다 **앵커와 보간을
// 리포트가 구분한다**는 것을 강제한다. 보간값을 모델 산출처럼 싣는 것이 이 트랙의 실패다.

const ANCHOR_LEVELS = [1, 2, 5, 10, 20, 45, 60, 75];

test('cost axis anchors come from the progression checkpoints plus the simulation origin', () => {
    const { cost } = buildContentReachabilityReport();

    assert.equal(cost.policy.modelAuthority, 'simulateProgression');
    assert.equal(cost.policy.anchorSeed, 20_260_810);
    assert.equal(cost.policy.anchorStatistic, 'single-seed');
    assert.equal(cost.policy.secondsPerAction, 90);
    assert.equal(cost.policy.secondsPerHour, 3_600);
    assert.equal(cost.policy.actualPlayClaim, false);
    assert.equal(cost.policy.cumulativeExpAuthority, 'CombatEngine.applyExpGain');
    // 보간 규칙은 주석이 아니라 리포트의 필드여야 한다 — 읽는 사람이 재현할 수 있어야 한다.
    assert.equal(typeof cost.policy.interpolationRule, 'string');
    assert.ok(cost.policy.interpolationRule.includes('expFraction'));
    assert.equal(typeof cost.policy.mapGateAuthority, 'string');
    assert.ok(cost.policy.limitations.some((line) => line.includes('interpolated')));

    assert.deepEqual(cost.anchors.map((anchor) => anchor.level), ANCHOR_LEVELS);
    assert.equal(cost.anchors[0].source, 'simulation-origin');
    assert.equal(cost.anchors[0].modeledActions, 0);
    assert.equal(cost.anchors[0].cumulativeExp, 0);
    for (const anchor of cost.anchors.slice(1)) assert.equal(anchor.source, 'checkpoint');
    for (const anchor of cost.anchors) {
        assert.equal(anchor.modeledSeconds, anchor.modeledActions * cost.policy.secondsPerAction);
        assert.equal(anchor.modeledHours, Math.round((anchor.modeledSeconds * 100) / 3_600) / 100);
    }
    const actions = cost.anchors.map((anchor) => anchor.modeledActions);
    assert.deepEqual(actions, [...actions].sort((left, right) => left - right));
    assert.deepEqual(cost.malformedGates, []);
    assert.deepEqual(cost.unresolvedEventChainTerminals, []);
});

test('every cost row declares whether it is anchored or interpolated, and interpolation is reproducible', () => {
    const { cost } = buildContentReachabilityReport();
    const anchorLevels = new Set(cost.anchors.map((anchor) => anchor.level));
    const rows = [
        ...cost.gates.maps,
        ...cost.gates.quests,
        ...cost.gates.equipmentTiers,
        ...cost.gates.jobs,
        ...cost.gates.eventChainTerminals,
    ].map((bucket) => bucket.cost);

    assert.ok(rows.length > 0);
    let interpolatedRows = 0;
    for (const row of rows) {
        if (anchorLevels.has(row.level)) {
            assert.equal(row.basis, 'anchored', `level ${row.level} sits on an anchor`);
            assert.equal(row.interpolation, null);
            continue;
        }
        if (row.basis === 'beyond-anchors') {
            // 앵커 범위 밖은 외삽하지 않는다 — 비용을 비워 둔다.
            assert.equal(row.modeledActions, null);
            assert.equal(row.modeledSeconds, null);
            assert.equal(row.modeledHours, null);
            assert.equal(row.interpolation, null);
            continue;
        }
        assert.equal(row.basis, 'interpolated', `level ${row.level}`);
        interpolatedRows += 1;
        const { interpolation } = row;
        assert.ok(interpolation.lowerLevel < row.level && row.level < interpolation.upperLevel);
        assert.ok(anchorLevels.has(interpolation.lowerLevel) && anchorLevels.has(interpolation.upperLevel));
        const fraction = (row.cumulativeExp - interpolation.lowerCumulativeExp)
            / (interpolation.upperCumulativeExp - interpolation.lowerCumulativeExp);
        assert.equal(fraction, interpolation.expFraction);
        assert.equal(row.modeledActions, Math.round(
            interpolation.lowerModeledActions
            + fraction * (interpolation.upperModeledActions - interpolation.lowerModeledActions),
        ));
        assert.equal(row.modeledSeconds, row.modeledActions * cost.policy.secondsPerAction);
        assert.equal(row.modeledHours, Math.round((row.modeledSeconds * 100) / 3_600) / 100);
    }
    assert.ok(interpolatedRows > 0, 'the production catalog gates content between checkpoints');
});

test('the gate levels behind each content class carry their modeled cost', () => {
    const { cost } = buildContentReachabilityReport();
    const bucketAt = (buckets, gateLevel) => buckets.find((bucket) => bucket.gateLevel === gateLevel);

    // tier-3 직업 5종은 Lv60 앵커에 그대로 앉아 있다 — 모델 액션 5,246 / 131.15h.
    const tierThreeJobs = bucketAt(cost.gates.jobs, 60);
    assert.equal(tierThreeJobs.count, 5);
    assert.equal(tierThreeJobs.cost.basis, 'anchored');
    assert.equal(tierThreeJobs.cost.modeledActions, 5_246);
    assert.equal(tierThreeJobs.cost.modeledHours, 131.15);
    assert.equal(cost.gates.jobs.reduce((sum, bucket) => sum + bucket.count, 0), 18);

    // 장비 tier 게이트는 BALANCE.TIER_REQ_LEVEL 그대로이고 합은 카탈로그 229종이다.
    assert.deepEqual(
        cost.gates.equipmentTiers.map(({ tier, gateLevel, count }) => [tier, gateLevel, count]),
        [[1, 1, 36], [2, 10, 43], [3, 28, 43], [4, 45, 42], [5, 60, 45], [6, 75, 20]],
    );
    assert.equal(cost.gates.equipmentTiers.reduce((sum, tier) => sum + tier.count, 0), 229);
    assert.equal(bucketAt(cost.gates.equipmentTiers, 28).cost.basis, 'interpolated');
    assert.equal(bucketAt(cost.gates.equipmentTiers, 60).cost.modeledActions, 5_246);

    assert.equal(cost.gates.quests.reduce((sum, bucket) => sum + bucket.count, 0), 143);
    assert.equal(cost.gates.maps.reduce((sum, bucket) => sum + bucket.count, 0), 52);

    // 이벤트 체인 종착 13개 중 5개가 같은 맵 하나(에테르 관문, route gate Lv68)에 몰려 있다.
    assert.deepEqual(cost.summary, { eventChains: 13, eventChainSteps: 39, eventChainTerminalSteps: 13 });
    assert.equal(cost.gates.eventChainTerminals.reduce((sum, bucket) => sum + bucket.count, 0), 13);
    const etherGate = bucketAt(cost.gates.eventChainTerminals, 68);
    assert.equal(etherGate.count, 5);
    assert.equal(etherGate.cost.basis, 'interpolated');
    assert.equal(etherGate.cost.modeledActions, 6_809);
    assert.equal(etherGate.cost.modeledHours, 170.23);
});

test('the behind-the-gate summary states how many hours of content sits past each level', () => {
    const { cost } = buildContentReachabilityReport();
    const rowAt = (level) => cost.behind.find((row) => row.level === level);

    assert.deepEqual(rowAt(1), {
        level: 1,
        basis: 'anchored',
        modeledActions: 0,
        modeledHours: 0,
        maps: 52,
        quests: 143,
        equipment: 229,
        jobs: 18,
        eventChainTerminalSteps: 13,
    });
    assert.deepEqual(rowAt(45), {
        level: 45,
        basis: 'anchored',
        modeledActions: 1_575,
        modeledHours: 39.38,
        maps: 15,
        quests: 42,
        equipment: 107,
        jobs: 5,
        eventChainTerminalSteps: 9,
    });
    // 승천(마왕성 Lv48)은 체크포인트가 없다 — 보간이고, 리포트가 그렇게 표기한다.
    assert.deepEqual(rowAt(48), {
        level: 48,
        basis: 'interpolated',
        modeledActions: 2_131,
        modeledHours: 53.28,
        maps: 15,
        quests: 42,
        equipment: 65,
        jobs: 5,
        eventChainTerminalSteps: 9,
    });
    assert.deepEqual(rowAt(60), {
        level: 60,
        basis: 'anchored',
        modeledActions: 5_246,
        modeledHours: 131.15,
        maps: 9,
        quests: 26,
        equipment: 65,
        jobs: 5,
        eventChainTerminalSteps: 5,
    });
    assert.deepEqual(rowAt(68), {
        level: 68,
        basis: 'interpolated',
        modeledActions: 6_809,
        modeledHours: 170.23,
        maps: 6,
        quests: 18,
        equipment: 20,
        jobs: 0,
        eventChainTerminalSteps: 5,
    });
    const levels = cost.behind.map((row) => row.level);
    assert.deepEqual(levels, [...levels].sort((left, right) => left - right));
    assert.equal(new Set(levels).size, levels.length);
});

test('map gate cost uses the route level, and divergence from the declared level is reported', () => {
    const { cost } = buildContentReachabilityReport();
    const divergenceFor = (name) => cost.mapGateDivergence.find((entry) => entry.map === name);

    // 무한 심연은 level 'infinite'이라 레벨 잠금이 없다 — 실제 게이트는 경로가 만든다.
    assert.deepEqual(divergenceFor('혼돈의 심연'), {
        map: '혼돈의 심연',
        declaredLevel: 'infinite',
        routeGateLevel: 48,
    });
    // 선언은 Lv55지만 유일한 경로가 Lv62 지역을 지난다.
    assert.deepEqual(divergenceFor('금지된 도서관'), {
        map: '금지된 도서관',
        declaredLevel: 55,
        routeGateLevel: 62,
    });
    for (const entry of cost.mapGateDivergence) {
        assert.notEqual(entry.declaredLevel, entry.routeGateLevel);
        assert.ok(Number.isSafeInteger(entry.routeGateLevel));
    }
    const mapMembers = cost.gates.maps.flatMap((bucket) => bucket.members);
    assert.equal(new Set(mapMembers).size, 52);
});

test('cost axis is unavailable — not invented — when the source has no progression authority', () => {
    const report = buildContentReachabilityReport({ ...DB, MAPS: clone(DB.MAPS) });

    assert.equal(report.cost.policy.modelAuthority, null);
    assert.equal(report.cost.policy.anchorSeed, null);
    assert.equal(report.cost.policy.secondsPerAction, null);
    assert.deepEqual(report.cost.anchors, []);
    const rows = [
        ...report.cost.gates.maps,
        ...report.cost.gates.quests,
        ...report.cost.gates.equipmentTiers,
        ...report.cost.gates.jobs,
        ...report.cost.gates.eventChainTerminals,
    ].map((bucket) => bucket.cost);
    assert.ok(rows.length > 0);
    for (const row of rows) {
        assert.equal(row.basis, 'unavailable');
        assert.equal(row.modeledActions, null);
        assert.equal(row.modeledSeconds, null);
        assert.equal(row.modeledHours, null);
    }
});

test('malformed gate levels are listed instead of being priced', () => {
    const quests = clone(DB.QUESTS);
    quests[0] = { ...quests[0], minLv: 999 };
    const classes = clone(DB.CLASSES);
    classes['전사'] = { ...classes['전사'], reqLv: Number.NaN };
    const report = buildContentReachabilityReport({ ...DB, QUESTS: quests, CLASSES: classes });

    assert.ok(report.cost.malformedGates.includes(`quest:${String(quests[0].id)}`));
    assert.ok(report.cost.malformedGates.includes('job:전사'));
    const pricedQuests = report.cost.gates.quests.flatMap((bucket) => bucket.members);
    assert.equal(pricedQuests.includes(quests[0].id), false);
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
