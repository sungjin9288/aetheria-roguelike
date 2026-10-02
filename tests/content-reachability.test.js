import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { DB } from '../src/data/db.ts';
import { FIRST_STORY_QUEST_ID } from '../src/data/quests.ts';
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

    // Wave 14 F2: cost.eventChainSpans 신설 + 체인 게이트가 종착 → 완주(전 스텝 max)로.
    // Wave 27 N3: 4 → 5 — cost.mapsWithoutWalkingRoute · questGateDivergence · unresolvedQuestGates ·
    //   policy.questGateAuthority 신설(맵 게이트는 실제 이동 규칙, 임무 게이트는 목표 게이트).
    assert.equal(report.schemaVersion, 5);
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
    // Wave 13 E1: tier-3 5종이 Lv45 체크포인트로 내려와 그 칸이 13 → 18이 된다.
    // Wave 14 F4: 성직자 `reqLv` 5 → 12이라 Lv5·Lv10 칸이 5 → 4다. Lv5의 후속 직업이 세 뿌리
    //   모두 0이 됐고(첫 되돌릴 수 없는 분기가 같은 모양이 됐다), Lv20 칸에서 6으로 합류한다.
    assert.deepEqual(
        report.jobs.checkpointSnapshots.map((checkpoint) => checkpoint.reachableJobCount),
        [1, 4, 4, 6, 18, 18, 18],
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
    assert.deepEqual(cost.unresolvedEventChainCompletions, []);
});

test('every cost row declares whether it is anchored or interpolated, and interpolation is reproducible', () => {
    const { cost } = buildContentReachabilityReport();
    const anchorLevels = new Set(cost.anchors.map((anchor) => anchor.level));
    const rows = [
        ...cost.gates.maps,
        ...cost.gates.quests,
        ...cost.gates.equipmentTiers,
        ...cost.gates.jobs,
        ...cost.gates.eventChainCompletions,
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

    // Wave 13 E1: tier-3 직업 5종은 Lv45 앵커에 앉는다 — 모델 액션 1,594 / 39.85h
    // (Lv60 5,274 / 131.85h에서 −92h). Wave 28(D7): 초반 구간에서 완전 정예가 빠져 앵커가 +2~5 액션
    //   움직였다(Lv45 1,575 → 1,579) — 초반 정예의 2~3배 경험치가 사라진 만큼이다. Wave 29: 보스 필드 14곳의
    //   일반 스폰이 보스가 아니게 되어 기준 시드의 앵커가 1,579 → 1,594로 움직였다 — 64시드 평균으로는 ±0.1%라
    //   이 이동은 기준 시드의 잡음이다(원장 §29). 45는 모델 체크포인트라 이 행은 `interpolated`가
    // 아니라 `anchored`다 — 게이트 비용이 보간이 아니라 시뮬레이터 산출이라는 뜻이다.
    // Wave 61(소유자 결정 A2): 보스 6종이 지역 조우에 들어가 기계 폐도(Lv28) · 에테르 폐허 · 공허의 회랑의 경험치가 올랐다 —
    //   1,594 → 1,568 / 39.85 → 39.2h. 64시드 평균 Lv45 −1.1% · Lv60 −0.3% · Lv75 −2.9%(모든 시드가 움직였다 — 잡음이 아니다, 원장 §62).
    // Wave 14 F4: 성직자가 5 → 12 버킷으로 옮겨가 5:4 → 5:3, 12:1 → 12:2다. Lv5는 이제 세
    //   뿌리(전사·마법사·도적)만 있고 그 어느 것도 후속을 열어두지 않는다 — 첫 되돌릴 수 없는
    //   분기가 세 뿌리에서 같은 모양이 된다는 것이 이 버킷 이동의 기준이다.
    assert.deepEqual(
        cost.gates.jobs.map(({ gateLevel, count }) => [gateLevel, count]),
        [[1, 1], [5, 3], [12, 2], [25, 1], [30, 6], [45, 5]],
    );
    assert.deepEqual(bucketAt(cost.gates.jobs, 5).members.toSorted(), ['도적', '마법사', '전사']);
    assert.deepEqual(bucketAt(cost.gates.jobs, 12).members.toSorted(), ['무당', '성직자']);
    const tierThreeJobs = bucketAt(cost.gates.jobs, 45);
    assert.equal(tierThreeJobs.count, 5);
    assert.deepEqual(tierThreeJobs.members.toSorted(), [
        '그림자 주군', '대마법사', '드래곤 나이트', '사냥의 군주', '팔라딘',
    ].toSorted());
    assert.equal(tierThreeJobs.cost.basis, 'anchored');
    assert.equal(tierThreeJobs.cost.modeledActions, 1_568);
    assert.equal(tierThreeJobs.cost.modeledHours, 39.2);
    assert.equal(bucketAt(cost.gates.jobs, 60), undefined);
    assert.equal(cost.gates.jobs.reduce((sum, bucket) => sum + bucket.count, 0), 18);

    // 장비 tier 게이트는 BALANCE.TIER_REQ_LEVEL 그대로이고 합은 카탈로그 229종이다.
    assert.deepEqual(
        cost.gates.equipmentTiers.map(({ tier, gateLevel, count }) => [tier, gateLevel, count]),
        [[1, 1, 36], [2, 10, 43], [3, 28, 43], [4, 45, 42], [5, 60, 45], [6, 75, 20]],
    );
    assert.equal(cost.gates.equipmentTiers.reduce((sum, tier) => sum + tier.count, 0), 229);
    assert.equal(bucketAt(cost.gates.equipmentTiers, 28).cost.basis, 'interpolated');
    assert.equal(bucketAt(cost.gates.equipmentTiers, 60).cost.modeledActions, 5_249);

    // Wave 27 N3: 143 → 141 / 52 → 49. 걷는 길이 없는 지역 3곳(시즌 둘 · 고대 보물고)은 값을 매기지 않고
    //   `mapsWithoutWalkingRoute`로 빠진다. 그 보물고가 목표인 임무 둘(136 · 137)도 같은 이유로
    //   `unresolvedQuestGates`로 빠진다 — 보물고는 열쇠 이벤트로만 들어가고 걷는 게이트가 없다.
    assert.equal(cost.gates.quests.reduce((sum, bucket) => sum + bucket.count, 0), 141);
    assert.deepEqual(cost.unresolvedQuestGates, [136, 137]);
    assert.equal(cost.gates.maps.reduce((sum, bucket) => sum + bucket.count, 0), 49);
    assert.deepEqual(cost.mapsWithoutWalkingRoute, [
        { map: '고대 보물고', entry: 'vault-key' },
        { map: '봄의 정원', entry: 'season' },
        { map: '서리 폭풍 유적', entry: 'season' },
    ]);

    // Wave 14 F4: 퀘스트 101('전직의 자격 (3차)')이 가리키는 게이트를 되찾는다. Wave 13 E1이
    //   3차 전직을 Lv60 → Lv45로 내렸는데 퀘스트는 `goal: 60 / minLv: 59`에 남아 있었고,
    //   그래서 `59` 버킷은 **가리킬 것이 없어진 게이트** 하나만 들고 있었다. 이제 소멸하고
    //   44 버킷이 1 → 2가 된다(126과 동거). 100번의 `minLv = goal − 1` 규칙 그대로다.
    assert.equal(bucketAt(cost.gates.quests, 59), undefined);
    assert.deepEqual(bucketAt(cost.gates.quests, 44).members.toSorted((a, b) => a - b), [101, 126]);

    // Wave 14 F2: 체인 버킷의 게이트는 **완주** 게이트(전 스텝 max)다 — 종착 스텝의
    // 게이트가 아니다. 스텝은 순서대로만 처리되므로 완주하려면 전 스텝의 지역을 지나야 한다.
    // 2026-09 Wave 15 G4: `summary`에 있던 `eventChainTerminalSteps`를 지웠다 — 그 값은
    // `terminals.length`이고 `terminals`는 체인당 한 행이라 **언제나** `eventChains`와
    // 같았다(G1이 종착 스텝을 넷 옮겨도 둘 다 13에 붙박여 있었던 것이 그 증거다).
    // 같은 수를 두 이름으로 싣던 키이므로 삭제가 재측정이 아니라 중복 제거다.
    assert.deepEqual(cost.summary, { eventChains: 13, eventChainSteps: 39 });
    assert.equal(cost.gates.eventChainCompletions.reduce((sum, bucket) => sum + bucket.count, 0), 13);
    // 2026-09 Wave 15 G1: 승천(마왕성 경로 게이트 Lv48 = 53.28h)을 걸치던 스텝 4개를
    //   루프 안으로 옮겼다 — ancient_prophecy:2 → 마왕성(48) · dragon_legacy:2 → 천공 정원(40)
    //   · world_tree_corruption:1 → 천공 정원(40) · :2 → 세계수 숲(40). 68:5 / 48:4 / 40:1이던
    //   것이 68:2 / 48:5 / 40:3이 됐고, 버킷 수는 6 그대로다(23·32·35 불변).
    const etherGate = bucketAt(cost.gates.eventChainCompletions, 68);
    assert.equal(etherGate.count, 2);
    // 68에 남는 둘은 승천 **뒤에** 열리는 체인이라 애초에 걸치지 않는다.
    assert.deepEqual(etherGate.members, ['divine_apostle_trial', 'rift_secret']);
    assert.equal(etherGate.cost.basis, 'interpolated');
    assert.equal(etherGate.cost.modeledActions, 6_682);
    assert.equal(etherGate.cost.modeledHours, 167.05);
    assert.equal(bucketAt(cost.gates.eventChainCompletions, 48).count, 5);
    assert.equal(bucketAt(cost.gates.eventChainCompletions, 40).count, 3);
    // 50 버킷은 생기지 않는다 — world_tree_corruption의 스텝 1(고대 신전 도시 50)까지
    // 옮겼기 때문이다. 종착만 옮겼다면 완주가 50(65.90h)에 남아 승천보다 뒤였다.
    assert.equal(bucketAt(cost.gates.eventChainCompletions, 50), undefined);
});

test('the behind-the-gate summary states how many hours of content sits past each level', () => {
    const { cost } = buildContentReachabilityReport();
    const rowAt = (level) => cost.behind.find((row) => row.level === level);

    // Wave 27 N3: 52 → 49 / 143 → 141 — 값을 매기지 않는 지역 3곳과 임무 2개(136 · 137)가 빠진다.
    assert.deepEqual(rowAt(1), {
        level: 1,
        basis: 'anchored',
        modeledActions: 0,
        modeledHours: 0,
        maps: 49,
        quests: 141,
        equipment: 229,
        jobs: 18,
        eventChains: 13,
    });
    // Wave 14 F4: 퀘스트 101이 59 → 44로 내려와 45 이후의 모든 행에서 `quests`가 1씩 줄어든다
    //   (45·48: 42 → 41, 49: 39 → 38, 50: 38 → 37, 52: 32 → 31, 55: 30 → 29). 같은 행의
    //   modeledActions/modeledHours는 한 자리도 안 움직인다 — 움직인 건 `quests` 열뿐이다.
    assert.deepEqual(rowAt(45), {
        level: 45,
        basis: 'anchored',
        modeledActions: 1_568,
        modeledHours: 39.2,
        maps: 15,
        quests: 41,
        equipment: 107,
        jobs: 5,
        eventChains: 7,
    });
    // 승천(마왕성 Lv48)은 체크포인트가 없다 — 보간이고, 리포트가 그렇게 표기한다.
    // Wave 13 E1: 승천 시점과 그 너머에 남는 직업이 5 → 0이다. 같은 행의
    // modeledActions/modeledHours는 한 자리도 안 움직인다 — 움직인 건 `jobs` 열뿐이다.
    assert.deepEqual(rowAt(48), {
        level: 48,
        basis: 'interpolated',
        modeledActions: 2_126,
        modeledHours: 53.15,
        maps: 15,
        quests: 41,
        equipment: 65,
        jobs: 0,
        eventChains: 7,
    });
    // 승천 게이트를 실제로 넘어선 첫 행(= 게이트 레벨이 48보다 큰 콘텐츠).
    // Wave 28(D6): 본편 86 · 87이 48로 내려와 49 · 60 · 68 행의 `quests`가 2씩 준다(38 → 36 · 27 → 25 · 24 → 22).
    assert.deepEqual(rowAt(49), {
        level: 49,
        basis: 'interpolated',
        modeledActions: 2_370,
        modeledHours: 59.25,
        maps: 13,
        quests: 36,
        equipment: 65,
        jobs: 0,
        eventChains: 2,
    });
    // Wave 27 N3: 60 · 68 행의 `quests`가 26 → 27 · 18 → 24다. 임무 87이 50 → 68(선행 86의 minLv 68),
    //   146 · 147 · 148(62)과 105 · 109(65)가 목표 지역의 경로 게이트 68로 올라왔다 — 60 행에는 87만,
    //   68 행에는 여섯 전부가 새로 "그 레벨 뒤에 남은 임무"로 세어진다. 45 · 48 · 49 행은 그대로다
    //   (움직인 임무가 전부 그 행의 양쪽 같은 편에 있다).
    assert.deepEqual(rowAt(60), {
        level: 60,
        basis: 'anchored',
        modeledActions: 5_249,
        modeledHours: 131.23,
        maps: 9,
        quests: 25,
        equipment: 65,
        jobs: 0,
        eventChains: 2,
    });
    assert.deepEqual(rowAt(68), {
        level: 68,
        basis: 'interpolated',
        modeledActions: 6_682,
        modeledHours: 167.05,
        maps: 6,
        quests: 22,
        equipment: 20,
        jobs: 0,
        eventChains: 2,
    });
    const levels = cost.behind.map((row) => row.level);
    assert.deepEqual(levels, [...levels].sort((left, right) => left - right));
    assert.equal(new Set(levels).size, levels.length);

    // Wave 14 F4: `behind` 행은 게이트 레벨의 합집합이라 행 하나가 통째로 사라진다 —
    //   Lv59는 **퀘스트 101의 게이트 하나만으로** 존재하던 행이었고, 그 퀘스트가 44로
    //   내려오면서 저장소의 어떤 콘텐츠도 59에 게이트를 두지 않게 됐다. 45 → 44행.
    // Wave 27 N3: 44 → 38행. 22 · 23 · 26 · 32 · 34 · 38 행이 사라진다 — 북부 권역 게이트(20~34)가 전부 35로,
    //   세계수 숲 임무 140~142(38)가 목표 지역 게이트 40으로 올라갔고, 26은 보물고 임무 137 하나만의
    //   게이트였다(지금은 unresolved). 20 · 25 · 28~30 행은 다른 콘텐츠가 남아 있어 유지된다.
    assert.equal(cost.behind.length, 38);
    assert.equal(rowAt(59), undefined);
    for (const level of [22, 23, 26, 32, 34, 38]) assert.equal(rowAt(level), undefined, `behind[${level}]`);

    // 성직자가 5 → 12 버킷으로 가면서 "아직 남은 직업" 열이 그 구간에서만 1씩 늘어난다.
    //   Lv5 행은 안 움직인다(게이트 5는 여전히 자기 행에서 '남은' 것으로 세어진다).
    assert.equal(rowAt(5).jobs, 17);
    for (const level of [6, 7, 8, 10, 12]) assert.equal(rowAt(level).jobs, 14, `behind[${level}].jobs`);
    assert.equal(rowAt(14).jobs, 12);
});

// ── Wave 13 E1 불변식: 직업 사다리는 코어 루프의 리셋 지점 안에서 닫힌다 ──────────────
// 마왕성은 코어 루프가 "승천(프레스티지)하라"고 가리키는 지점이다. 직업 게이트가 그보다
// 깊으면 그 직업은 해금되는 순간이 곧 리셋 직전이라 **한 번도 굴려지지 않는다** — 도달
// 가능(unreachable: [])하지만 플레이되지 않는, 비용 축이 없으면 안 보이는 결함이다.
// 48은 리터럴이 아니라 리포트의 맵 경로 게이트에서 읽는다(선언 레벨이 아니라 경로다).
test('직업 게이트 최대값은 마왕성 경로 게이트(승천 지점)를 넘지 않는다', () => {
    const { cost } = buildContentReachabilityReport();

    const demonCastleGate = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성'));
    assert.ok(demonCastleGate, '마왕성이 맵 게이트 버킷에 있어야 경로 게이트를 읽을 수 있다');
    assert.equal(demonCastleGate.gateLevel, 48);

    const deepestJobGate = Math.max(...cost.gates.jobs.map((bucket) => bucket.gateLevel));
    assert.ok(
        deepestJobGate <= demonCastleGate.gateLevel,
        `가장 깊은 직업 게이트 Lv${deepestJobGate}가 마왕성 경로 게이트 Lv${demonCastleGate.gateLevel}보다 깊다`
        + ' — 그 직업은 해금과 리셋이 같은 순간이라 한 번도 플레이되지 않는다',
    );

    // 해금만 되고 끝나지 않으려면 둘 사이에 실제로 시간이 남아야 한다.
    const deepestJobCost = cost.gates.jobs.find((bucket) => bucket.gateLevel === deepestJobGate).cost;
    const headroomHours = Math.round(
        (demonCastleGate.cost.modeledHours - deepestJobCost.modeledHours) * 100,
    ) / 100;
    assert.ok(headroomHours > 0, `승천까지 남는 시간이 ${headroomHours}h다`);
    // Wave 28(D7): 앵커가 둘 다 +0.1h 움직여 여유는 13.9h 그대로다. Wave 29: 기준 시드 앵커가 +0.37h · +0.4h
    //   움직여 여유는 13.93h다. Wave 61: 보스 6종 지역 조우로 앵커가 −0.65h · −0.63h 움직여 여유는 13.95h다.
    assert.equal(deepestJobCost.modeledHours, 39.2);
    assert.equal(demonCastleGate.cost.modeledHours, 53.15);
    assert.equal(headroomHours, 13.95);

    // 그래서 승천 시점에 남아 있는 직업은 0이다.
    assert.equal(cost.behind.find((row) => row.level === demonCastleGate.gateLevel).jobs, 0);
});

// ── Wave 28 (D6) 불변식: 본편 스토리 사슬도 승천 지점을 걸치지 않는다 ─────────────────────
// Wave 15 G1이 이벤트 체인에 세운 기준을 본편에 적용한다. 86이 에테르 관문(68)에 있던 동안 사슬의 끝
// 87은 170.23h였고, 그 전에 마왕을 잡을 때마다 계승 제안이 떴다 — 이야기를 끝내기 전에 리셋 지점이 왔다.
// 사슬은 FIRST_STORY_QUEST_ID에서 prerequisiteQuestId를 거꾸로 따라 만든다(목록을 손으로 적지 않는다).
test('본편 스토리 사슬의 모든 임무 게이트는 마왕성 경로 게이트 이하이고, 종장은 승천 지점과 같다', () => {
    const { cost } = buildContentReachabilityReport();
    const demonCastleGate = cost.gates.maps.find((bucket) => bucket.members.includes('마왕성')).gateLevel;
    const gateOf = new Map(cost.gates.quests.flatMap((bucket) => bucket.members.map((id) => [id, bucket.gateLevel])));

    const chain = [FIRST_STORY_QUEST_ID];
    for (;;) {
        const next = DB.QUESTS.find((quest) => quest.prerequisiteQuestId === chain.at(-1) && String(quest.title).startsWith('[스토리]'));
        if (!next) break;
        chain.push(next.id);
    }
    assert.deepEqual(chain, [80, 81, 82, 84, 83, 85, 86, 87], '본편 사슬');
    for (const id of chain) {
        assert.ok(gateOf.has(id), `quest ${id}: 게이트가 매겨져야 한다`);
        assert.ok(gateOf.get(id) <= demonCastleGate, `quest ${id}: Lv${gateOf.get(id)} > 마왕성 Lv${demonCastleGate}`);
    }
    assert.equal(gateOf.get(chain.at(-1)), demonCastleGate, '종장은 첫 마왕 처치(= 계승 제안) 지점에서 닫힌다');

    // 86의 목표는 그 지역에서 실제로 조우되는 비보스여야 한다 — 옮긴 목표가 공허하면 사슬이 끊긴다.
    const q86 = DB.QUESTS.find((quest) => quest.id === 86);
    const map86 = DB.MAPS[q86.location];
    assert.ok(map86.monsters.includes(q86.target), `${q86.target} @ ${q86.location}`);
    assert.equal((map86.bossMonsters || []).includes(q86.target), false);
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
    // Wave 27 N3: 52 → 49 + 3. 걷는 게이트가 없는 지역은 버킷이 아니라 입구 목록에 있고, 둘은 겹치지 않는다.
    const mapMembers = cost.gates.maps.flatMap((bucket) => bucket.members);
    assert.equal(new Set(mapMembers).size, 49);
    const unwalkable = cost.mapsWithoutWalkingRoute.map((entry) => entry.map);
    assert.equal(unwalkable.some((map) => mapMembers.includes(map)), false);
    assert.equal(mapMembers.length + unwalkable.length, 52);
    assert.equal(cost.mapGateDivergence.length, 16);
});

// ── Wave 27 N3: 임무 게이트는 minLv가 아니라 목표 게이트다 ─────────────────────
// 수락(ACCEPT_QUEST)은 선행 임무의 **수령**을 요구하고, 수락한 뒤에도 목표 지역에 걸어 들어가야 진행이
// 시작된다. 리포트가 minLv만 보던 동안 스토리 87은 L50 / 65.9h로 적혔는데, 선행 86의 minLv가 68이라
// 실제 첫 수락은 그보다 한참 뒤였다(자연 플레이 감사 중앙값 165h).

test('임무 게이트 = max(수락 게이트, 목표 지역의 경로 게이트), 수락 게이트 = max(minLv, 선행 임무의 게이트)', () => {
    const { cost } = buildContentReachabilityReport();
    assert.equal(typeof cost.policy.questGateAuthority, 'string');
    assert.ok(cost.policy.questGateAuthority.includes('acceptGateLevel'));
    const gateOf = new Map(cost.gates.quests.flatMap((bucket) => bucket.members.map((id) => [id, bucket.gateLevel])));

    for (const row of cost.questGateDivergence) {
        assert.ok(row.acceptGateLevel >= row.minLv, `quest ${row.quest}`);
        assert.ok(row.objectiveGateLevel >= row.acceptGateLevel, `quest ${row.quest}`);
        assert.notEqual(row.objectiveGateLevel, row.minLv, 'divergence 행은 minLv와 갈라지는 임무뿐이다');
        assert.equal(gateOf.get(row.quest), row.objectiveGateLevel, `quest ${row.quest}: 버킷 게이트 = 목표 게이트`);
    }
    // 갈라지지 않는 임무는 버킷 게이트가 곧 minLv다.
    const divergent = new Set(cost.questGateDivergence.map((row) => row.quest));
    for (const quest of DB.QUESTS) {
        if (divergent.has(quest.id) || cost.unresolvedQuestGates.includes(quest.id)) continue;
        assert.equal(gateOf.get(quest.id), quest.minLv, `quest ${quest.id}`);
    }

    const rowOf = (id) => cost.questGateDivergence.find((row) => row.quest === id);
    // 84: 수락은 28이지만 기계 폐도에 걸어 들어가는 것은 35부터다.
    assert.deepEqual(rowOf(84), { quest: 84, minLv: 28, acceptGateLevel: 28, objectiveMap: '기계 폐도', objectiveGateLevel: 35 });
    // 87: Wave 27에서는 선행 86(에테르 관문, minLv 68) 때문에 L68이었다. Wave 28(D6)이 86을 마왕성(48)으로 옮기고
    //   87 minLv를 48로 맞춰 사슬 전체가 승천 지점에서 닫힌다 — 더 이상 minLv와 갈라지지 않는다.
    assert.equal(rowOf(87), undefined);
    assert.equal(gateOf.get(87), 48);
    // 83: 선행 84(35)와 자기 위치 빙하 심연(35)이 minLv 35와 같아 움직이지 않는다.
    assert.equal(rowOf(83), undefined);
    assert.equal(gateOf.get(83), 35);

    const bucketOf = (id) => cost.gates.quests.find((bucket) => bucket.members.includes(id));
    assert.equal(bucketOf(87).cost.modeledHours, 53.15, '87: 170.23h(L68, Wave 27) → 53.38h(L48, Wave 28) → 기준 시드 앵커 이동(Wave 29)');
    assert.equal(bucketOf(84).cost.modeledHours, 12, '84: 6.38h(L28) → 12h(L35), 앵커 이동(Wave 28 D7 · Wave 29)으로 12h');
});

test('임무 게이트가 minLv와 갈라지는 20개는 전부 목표 지역에 가기 전에 수락되는 임무다', () => {
    const { cost } = buildContentReachabilityReport();
    assert.deepEqual(
        cost.questGateDivergence.map((row) => [row.quest, row.minLv, row.acceptGateLevel, row.objectiveMap, row.objectiveGateLevel]),
        [
            [2, 2, 2, '서쪽 평원', 3],
            [12, 20, 20, '피라미드', 35],
            [26, 20, 20, '피라미드', 35],
            [27, 20, 20, '빙하 심연', 35],
            [28, 22, 22, '북부 설원', 35],
            [38, 30, 30, '기계 폐도', 35],
            [39, 30, 30, '기계 폐도', 35],
            [84, 28, 28, '기계 폐도', 35],
            [105, 65, 65, '에테르 폐허', 68],
            [109, 65, 65, '에테르 폐허', 68],
            [122, 25, 25, '북부 설원', 35],
            [123, 25, 25, '피라미드', 35],
            [124, 30, 30, '기계 폐도', 35],
            [135, 23, 23, '피라미드', 35],
            [140, 38, 38, '세계수 숲', 40],
            [141, 38, 38, '세계수 숲', 40],
            [142, 38, 38, '세계수 숲', 40],
            [146, 62, 62, '차원의 균열 전초기지', 68],
            [147, 62, 62, '차원의 균열 전초기지', 68],
            [148, 62, 62, '차원의 균열 전초기지', 68],
        ],
    );
    // Wave 27의 소유자 결정 목록. Wave 28은 수락 규칙을 그대로 두고 보드에 목표 지역의 실제 진입 레벨을
    // 보이는 쪽을 택했다 — 20개 모두 수락 게이트보다 목표 지역의 경로 게이트가 늦다(선행 때문에 갈라지는 행은 0).
    assert.deepEqual(
        cost.questGateDivergence.filter((row) => row.objectiveGateLevel > row.acceptGateLevel).map((row) => row.quest),
        [2, 12, 26, 27, 28, 38, 39, 84, 105, 109, 122, 123, 124, 135, 140, 141, 142, 146, 147, 148],
    );
});

test('임무 게이트는 값을 매길 수 없으면 fail-closed다 — 선행 순환·선행 결손·걷지 못하는 목표 지역', () => {
    const quests = clone(DB.QUESTS);
    const indexOf = (id) => quests.findIndex((quest) => quest.id === id);
    // 선행 순환: 84 ↔ 83
    quests[indexOf(84)] = { ...quests[indexOf(84)], prerequisiteQuestId: 83 };
    // 선행 결손
    quests[indexOf(12)] = { ...quests[indexOf(12)], prerequisiteQuestId: '없는 임무' };
    const { cost } = buildContentReachabilityReport({ ...DB, QUESTS: quests });
    for (const id of [83, 84, 85, 86, 87, 12]) {
        assert.ok(cost.unresolvedQuestGates.includes(id), `quest ${id}: 순환/결손 선행에 매달린 임무는 미상이다`);
        assert.equal(cost.gates.quests.some((bucket) => bucket.members.includes(id)), false, `quest ${id}`);
    }
    // 걷지 못하는 목표 지역(보물고)은 선언 레벨 25로 매기지 않는다.
    assert.ok(cost.unresolvedQuestGates.includes(136));
    assert.deepEqual(cost.malformedGates, []);
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
        ...report.cost.gates.eventChainCompletions,
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
