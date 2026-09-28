import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { BOSS_MONSTERS } from '../src/data/monsters.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { createDomainRandom } from '../src/utils/seededRandom.ts';
import { getMapRouteGate } from '../src/utils/mapRouteGate.ts';

/**
 * 2026-09 Wave 29 (소유자 결정 "전부 수정").
 *
 * 지역의 `boss` 문자열은 그 지역 **구역 보스의 이름**이다 — "이 지역의 조우는 전부 보스"라는 표시가 아니다.
 * `spawnEnemy`의 `(mapData.boss && bossMonsters 없음)` 분기가 둘을 섞어, `bossMonsters` 목록이 없는 14곳에서
 * 일반 스폰이 100% `isBoss`였다. 그 결과 일반 처치가 보스로 정산됐다: 보스 보너스 장비(Lv35 지역에서 처치당 0.25개,
 * tier 6 — 그 레벨에 장착 불가)가 판매 가치로 처치당 약 7,500골드(적 골드는 약 92)를 냈고, 마왕성 게이트(Lv48)까지
 * 보스 처치 수가 657회(수정 후 27회)로 부풀어 보스 업적·칭호·시즌 XP·서명 pity가 Lv34 전후에 포화됐다.
 * 성장 모델(EXP)은 이 분기를 거의 보지 못한다 — 64시드 체크포인트 평균 차이 ±0.1%(원장 §29).
 *
 * 계약: ① 일반 스폰은 몬스터 자신이 보스일 때만 보스다 ② 게이지 도전은 여전히 구역 보스를 보스로 스폰한다
 * ③ 일반 처치는 보스 정산(첫 토벌 보너스 · 보스 처치 수)을 타지 않는다 ④ 정예 도전과 정예 격노가 이 지역에서도 적용된다.
 */

const isBossMap = ([, map]) => typeof map.boss === 'string'
    && !(Array.isArray(map.bossMonsters) && map.bossMonsters.length > 0);
const BOSS_FIELD_MAPS = Object.entries(DB.MAPS).filter(isBossMap);

const playerAt = (name, overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    level: getMapRouteGate(DB.MAPS, name)?.routeGateLevel ?? 1,
    loc: name,
    ...overrides,
});

const spawn = (name, map, key, player = playerAt(name), options = {}) => spawnEnemy(
    map,
    player,
    [],
    { addLog: () => {} },
    { rng: createDomainRandom(20260928, 'boss-field-normal-spawn', 1, name, key), ...options },
).mStats;

test('[데이터] 대상은 구역 보스 이름만 있는 14곳이고, 그 구역 보스는 전부 보스 프로필을 가진다', () => {
    assert.deepEqual(BOSS_FIELD_MAPS.map(([name]) => name).sort(), [
        '고대 신전 도시', '고대 하수도', '몰락한 전초기지', '붕괴된 마법 요새', '세계수 숲', '신성한 호수', '심해 회랑',
        '암흑 성', '용암 지대', '저주받은 묘지', '종말의 전장', '차원의 균열 전초기지', '천공 정원', '폭풍의 고원',
    ].sort());
    // ②의 전제: 분기를 지워도 구역 보스는 자기 프로필로 보스다.
    for (const [name, map] of BOSS_FIELD_MAPS) {
        assert.ok(BOSS_MONSTERS.includes(map.boss), `${name}의 구역 보스 ${map.boss}`);
    }
});

test('[Wave 29 ①] 일반 스폰은 몬스터 자신이 보스일 때만 보스다 — 14곳 × 200회', () => {
    for (const [name, map] of BOSS_FIELD_MAPS) {
        let normal = 0;
        for (let index = 0; index < 200; index += 1) {
            const enemy = spawn(name, map, index);
            const ownBoss = BOSS_MONSTERS.includes(enemy.baseName);
            assert.equal(enemy.isBoss, ownBoss, `${name} ${enemy.name}`);
            if (!ownBoss) normal += 1;
        }
        assert.ok(normal > 0, `${name}: 일반 몬스터가 한 번도 안 나오면 이 행은 공허하다`);
    }
});

test('[Wave 29 ②] 게이지 도전은 여전히 구역 보스를 보스로 스폰한다', () => {
    for (const [name, map] of BOSS_FIELD_MAPS) {
        const enemy = spawn(name, map, 'area-boss', playerAt(name), { forceAreaBoss: true });
        assert.equal(enemy.baseName, map.boss, name);
        assert.equal(enemy.isBoss, true, name);
    }
});

test('[Wave 29 ③] 일반 처치는 첫 토벌 보너스와 보스 처치 수를 받지 않는다', () => {
    const [name, map] = BOSS_FIELD_MAPS.find(([mapName]) => mapName === '저주받은 묘지');
    const player = playerAt(name, { stats: { ...structuredClone(INITIAL_STATE.player.stats), killRegistry: {}, bossKills: 0 } });
    for (const monster of map.monsters) {
        const enemy = spawn(name, { ...map, monsters: [monster] }, `victory:${monster}`, player);
        const victory = CombatEngine.handleVictory(player, enemy, { activeSynergies: [] }, null);
        assert.equal(victory.bossClearBonus, null, monster);
        assert.equal(victory.updatedPlayer.stats.bossKills, 0, monster);
        assert.equal(victory.updatedPlayer.stats.killRegistry[monster], 1, `${monster}: 처치 자체는 기록된다`);
    }
});

test('[Wave 29 ④] 정예 도전(eliteOnly)과 정예 격노가 이 지역의 일반 몬스터에도 적용된다', () => {
    for (const [name, map] of BOSS_FIELD_MAPS) {
        const challenger = playerAt(name, { challengeModifiers: ['eliteOnly'] });
        let checked = 0;
        for (let index = 0; index < 40; index += 1) {
            const enemy = spawn(name, map, `elite:${index}`, challenger);
            if (enemy.isBoss) continue;
            assert.equal(enemy.isElite, true, `${name} ${enemy.name}: 정예 도전`);
            assert.ok(enemy.phase2, `${name} ${enemy.name}: 정예 격노 페이즈`);
            checked += 1;
        }
        assert.ok(checked > 0, `${name}: 일반 몬스터 표본 0이면 공허하다`);
    }
});
