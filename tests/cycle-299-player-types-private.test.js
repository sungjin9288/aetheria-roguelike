import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 299: player.ts 8 sub-interfaces export → private downgrade
 *   (cycle 222-298 silent dead config 시리즈 69번째 — cleanup lens 연속).
 *
 * 발견 (8 sub-interfaces, 모두 외부 import 0건, Player 인터페이스 composition 전용):
 * - PlayerStats / PlayerCodex / SkillLoadout / TempBuff / PlayerMeta /
 *   CombatFlags / SeasonPassState / WeeklyProtocol.
 *
 * 외부 (src/, tests/) `import { PlayerStats }` 등 0건. 모두 같은 파일에서
 * Player 인터페이스 필드 타입으로만 사용.
 *
 * 패턴 (cycle 222-298 silent dead config 시리즈 69번째):
 * - cycle 298: 5 type exports private (item/monster).
 * - cycle 299: 8 sub-interface exports private (player composition).
 *
 * 수정:
 * - src/types/player.ts: 8 export 제거 (정의 자체는 유지).
 * - tests/cycle-280/281/282/284: regex `(?:export )?interface PlayerStats|PlayerMeta`
 *   패턴으로 private downgrade 호환 갱신.
 *
 * 회귀 가드:
 * - Player active export 유지 — 모든 hook/util/component가 import.
 * - 8 sub-interface 정의 그대로 — Player 필드 타입 유효.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 299: 8 sub-interface exports 제거 (private)', async () => {
    const source = await readSrc('src/types/player.ts');
    const deadExports = ['PlayerStats', 'PlayerCodex', 'SkillLoadout', 'TempBuff', 'PlayerMeta', 'CombatFlags', 'SeasonPassState', 'WeeklyProtocol'];
    deadExports.forEach((name) => {
        const re = new RegExp(`export interface ${name}\\b`);
        assert.ok(!re.test(source), `${name} export 제거됨`);
        const defRe = new RegExp(`interface ${name}\\b`);
        assert.ok(defRe.test(source), `${name} 정의 유지 (private)`);
    });
});

test('cycle 299: Player active export 유지', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(/export interface Player\b/.test(source),
        'Player export 유지 (모든 hook/util/component import)');
});

test('cycle 298 회귀 가드: 5 type private 유지', async () => {
    const itemSrc = await readSrc('src/types/item.ts');
    const monsterSrc = await readSrc('src/types/monster.ts');
    assert.ok(!/export interface WeaponItem\b/.test(itemSrc), 'cycle 298 WeaponItem private');
    assert.ok(!/export interface BossMonster\b/.test(monsterSrc), 'cycle 298 BossMonster private');
});
