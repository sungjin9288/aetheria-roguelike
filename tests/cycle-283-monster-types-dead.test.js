import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 283: Monster 타입의 9 dead 필드 cleanup
 *   (cycle 222-282 silent dead config 시리즈 53번째 — cleanup lens 연속, 대량).
 *
 * 발견 (3 interfaces, 9 dead 필드):
 * - MonsterBase 4 dead 필드:
 *   - elem?: string (line 21): monster.elem access 0건. 속성 시스템은 weakness/resistance.
 *   - dropTable?: string (line 29): 어디서도 read 0건.
 *   - prefix?: string (line 31): MONSTER_PREFIXES는 mStats.name에 직접 string 합치는 방식 사용.
 *   - signatureDrops?: Array<...> (line 34): bossSignatureHint은 local variable 사용, monster
 *     필드에는 set 안 함.
 * - BossPhase 3 dead 필드:
 *   - atkMult?: number (line 41): 활성은 atkBonus.
 *   - defMult?: number (line 42): 활성은 defBonus (cycle 228).
 *   - skills?: string[] (line 44): phase2/phase3에 skills 설정 0건.
 * - BossMonster 2 dead 필드:
 *   - phases?: BossPhase[] (line 56): 활성은 phase2/phase3 singular.
 *   - onDeath?: string (line 59): 어디서도 read 0건.
 *
 * 패턴 (cycle 222-282 silent dead config 시리즈 53번째):
 * - cycle 280-282: types/player.ts dead fields cleanup 3사이클.
 * - cycle 283: types/monster.ts dead fields cleanup (대량, 9 필드).
 *
 * 수정 (src/types/monster.ts):
 * - 9 dead 필드 제거.
 *
 * 회귀 가드:
 * - 활성 필드 (name/baseName/hp/maxHp/atk/def/exp/gold/weakness/resistance/isBoss/isElite/dropMod/
 *   pattern/phase2/phase3/atkBonus/defBonus/threshold/log/statusEffect) 모두 유지.
 * - [key: string]: any index signature로 동적 필드 호환.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 283: MonsterBase 4 dead 필드 제거 (elem/dropTable/prefix/signatureDrops)', async () => {
    const source = await readSrc('src/types/monster.ts');
    const baseBlock = source.match(/export interface MonsterBase \{[\s\S]+?\n\}/);
    assert.ok(baseBlock, 'MonsterBase interface 발견');
    assert.ok(!/elem\?:\s*string;/.test(baseBlock[0]), 'elem 제거됨');
    assert.ok(!/dropTable\?:\s*string;/.test(baseBlock[0]), 'dropTable 제거됨');
    assert.ok(!/prefix\?:\s*string;/.test(baseBlock[0]), 'prefix 제거됨');
    assert.ok(!/signatureDrops\?:/.test(baseBlock[0]), 'signatureDrops 제거됨');
});

test('cycle 283: BossPhase 3 dead 필드 제거 (atkMult/defMult/skills)', async () => {
    const source = await readSrc('src/types/monster.ts');
    const phaseBlock = source.match(/export interface BossPhase \{[\s\S]+?\n\}/);
    assert.ok(phaseBlock, 'BossPhase interface 발견');
    assert.ok(!/atkMult\?:\s*number;/.test(phaseBlock[0]), 'atkMult 제거됨');
    assert.ok(!/defMult\?:\s*number;/.test(phaseBlock[0]), 'defMult 제거됨');
    assert.ok(!/skills\?:\s*string\[\];/.test(phaseBlock[0]), 'skills 제거됨');
});

test('cycle 283: BossMonster 2 dead 필드 제거 (phases/onDeath)', async () => {
    const source = await readSrc('src/types/monster.ts');
    // cycle 298: BossMonster export 제거 (private downgrade) → 정의 자체는 유지.
    const bossBlock = source.match(/(?:export )?interface BossMonster[\s\S]+?\n\}/);
    assert.ok(bossBlock, 'BossMonster interface 발견');
    assert.ok(!/phases\?:\s*BossPhase\[\];/.test(bossBlock[0]), 'phases (array) 제거됨');
    assert.ok(!/onDeath\?:\s*string;/.test(bossBlock[0]), 'onDeath 제거됨');
});

test('cycle 283: 활성 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/types/monster.ts');
    const activeFields = [
        'name', 'baseName', 'hp', 'maxHp', 'atk', 'def', 'exp', 'gold',
        'weakness', 'resistance', 'isBoss', 'isElite', 'dropMod',
        'phase2', 'phase3', 'atkBonus', 'defBonus', 'threshold', 'log', 'statusEffect',
    ];
    activeFields.forEach((field) => {
        const re = new RegExp(`${field}\\??:\\s*`);
        assert.ok(re.test(source), `${field} 필드 유지`);
    });
});
