import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 현상수배 대상 풀 계약 (2026-09 Wave 3 L 후속)
 * - seasonOnly 지역(level 범위 배열)은 시즌이 닫혀 있으면 갈 수 없으므로 풀에서 제외한다.
 *   이전에는 범위 배열이 number 비교에서 NaN이 되어 우연히 빠졌다 — 이제 명시적 조건이다.
 * - 숫자 레벨 지역은 [level-10, level+5] 창 안에서 포함된다. 보스는 지역 단위가 아니라 몬스터 단위로 빠진다
 *   (2026-10 Wave 62, 원장 §61.4 C12 — 지역의 `boss` 필드는 구역 보스의 이름이라 그 지역의 일반 몬스터는 대상이다.
 *   이전 계약 "보스 지역은 제외된다"가 Lv69+ 대상 0 · 슬라임 폴백을 만들었다. 전 레벨 계약은
 *   `tests/bounty-target-level-contract.test.js`).
 */
const { getBountyTargets } = await import('../src/reducers/handlers/questHandlers.ts');
const { DB } = await import('../src/data/db.ts');
const { isEncounterBoss } = await import('../src/utils/bossPresence.ts');
const { nonWalkingEntryOf } = await import('../src/utils/mapRouteGate.ts');

test('seasonOnly 지역의 몬스터는 어떤 레벨에서도 현상수배 대상이 아니다', () => {
    // 시즌 지역에만 존재하는 몬스터로 한정한다 (예: '눈보라 정령'은 일반 지역에도 있어 정당하게 포함된다).
    const regularMonsters = new Set(Object.values(DB.MAPS)
        .filter((map) => !map.seasonOnly)
        .flatMap((map) => map.monsters || []));
    const seasonMonsters = Object.values(DB.MAPS)
        .filter((map) => map.seasonOnly)
        .flatMap((map) => map.monsters || [])
        .filter((name) => !regularMonsters.has(name));
    assert.ok(seasonMonsters.length > 0, 'seasonOnly 전용 몬스터 fixture가 있어야 한다');
    for (const level of [1, 8, 12, 25, 30, 50]) {
        const targets = getBountyTargets(level);
        for (const name of seasonMonsters) {
            assert.ok(!targets.includes(name), `Lv${level} 풀에 시즌 몬스터 ${name}이 포함되면 안 된다`);
        }
    }
});

test('숫자 레벨 지역은 [level-10, level+5] 창 안에서 포함되고, 보스 몬스터만 제외된다 (구역 보스 이름이 있는 지역 포함)', () => {
    const level = 12;
    const targets = new Set(getBountyTargets(level));
    const inWindow = (name, map) => !nonWalkingEntryOf(name, map) && map.level !== 'infinite' && typeof map.level === 'number'
        && map.level <= level + 5 && map.level >= Math.max(1, level - 10);
    const regularIn = (map) => (map.monsters || []).filter((monster) => !isEncounterBoss(monster, map));
    Object.entries(DB.MAPS).forEach(([name, map]) => {
        if (map.seasonOnly || map.level === 'infinite' || typeof map.level !== 'number') return;
        if (inWindow(name, map)) {
            for (const monster of regularIn(map)) assert.ok(targets.has(monster), `${name}의 ${monster}는 포함돼야 한다`);
            return;
        }
        const exclusive = (map.monsters || []).filter((m) => !Object.entries(DB.MAPS).some(
            ([otherName, other]) => other !== map && inWindow(otherName, other) && regularIn(other).includes(m),
        ));
        for (const monster of exclusive) {
            assert.ok(!targets.has(monster), `${name}의 ${monster}는 창 밖이라 제외돼야 한다`);
        }
    });
    // Lv12 창에는 구역 보스 이름이 있는 지역이 있다 — 이전 규칙은 그 지역의 일반 몬스터까지 뺐다.
    assert.ok(Object.entries(DB.MAPS).some(([name, map]) => inWindow(name, map) && typeof map.boss === 'string' && regularIn(map).length > 0));
});
