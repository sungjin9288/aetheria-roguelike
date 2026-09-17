import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 현상수배 대상 풀 계약 (2026-09 Wave 3 L 후속)
 * - seasonOnly 지역(level 범위 배열)은 시즌이 닫혀 있으면 갈 수 없으므로 풀에서 제외한다.
 *   이전에는 범위 배열이 number 비교에서 NaN이 되어 우연히 빠졌다 — 이제 명시적 조건이다.
 * - 숫자 레벨 지역은 [level-10, level+5] 창 안에서 포함되고 보스 지역은 제외된다.
 */
const { getBountyTargets } = await import('../src/reducers/handlers/questHandlers.ts');
const { DB } = await import('../src/data/db.ts');

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

test('숫자 레벨 지역은 [level-10, level+5] 창 안에서 포함되고 보스 지역은 제외된다', () => {
    const level = 12;
    const targets = new Set(getBountyTargets(level));
    Object.entries(DB.MAPS).forEach(([name, map]) => {
        if (map.seasonOnly || map.level === 'infinite' || typeof map.level !== 'number') return;
        const inWindow = map.level <= level + 5 && map.level >= Math.max(1, level - 10) && !map.boss;
        for (const monster of map.monsters || []) {
            if (inWindow) assert.ok(targets.has(monster), `${name}의 ${monster}는 포함돼야 한다`);
        }
        if (!inWindow) {
            const exclusive = (map.monsters || []).filter((m) => !Object.values(DB.MAPS).some(
                (other) => other !== map && !other.seasonOnly && other.level !== 'infinite'
                    && typeof other.level === 'number' && !other.boss
                    && other.level <= level + 5 && other.level >= Math.max(1, level - 10)
                    && (other.monsters || []).includes(m),
            ));
            for (const monster of exclusive) {
                assert.ok(!targets.has(monster), `${name}의 ${monster}는 창 밖이라 제외돼야 한다`);
            }
        }
    });
});
