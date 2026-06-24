import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 270: getEnemyTacticalProfile의 12 dead 필드 cleanup
 *   (cycle 222-269 silent dead config 시리즈 41번째 — cycle 267-268 cleanup lens 연속).
 *
 * 발견 (대량 dead 필드):
 * - getEnemyTacticalProfile은 17 필드를 반환 (role / tier / guardChance / heavyChance /
 *   estimatedHit / estimatedHeavy / weakness / resistance / hint / entryHint / signature /
 *   counterHint / phaseHint / rewardHint / warningChips / recommendedBuilds / phaseTriggered).
 * - 그러나 src/ 전체 검색에서 단 5 필드만 consume (CombatPanel.tsx):
 *   entryHint / hint / phaseHint (cycle 245), signature / counterHint (cycle 269 추가).
 * - 12 필드가 dispatch 0건 — 매 보스 전투마다 계산되지만 사용 0.
 *
 * 패턴 (cycle 222-269 silent dead config 시리즈 41번째):
 * - cycle 267: skillLabel cleanup.
 * - cycle 268: buildProfile.secondary cleanup.
 * - cycle 270: tacticalProfile 12 dead 필드 cleanup (대량).
 *
 * 수정 (src/utils/runProfile.ts getEnemyTacticalProfile):
 * - 12 dead 필드 제거: role, tier, guardChance, heavyChance, estimatedHit, estimatedHeavy,
 *   weakness, resistance, rewardHint, warningChips, recommendedBuilds, phaseTriggered.
 * - 5 사용 필드 유지: hint, entryHint, signature, counterHint, phaseHint.
 *
 * 회귀 가드:
 * - CombatPanel display 변화 없음 (사용 필드 유지).
 * - bossBriefLine (entryHint || hint || phaseHint) 동작 유지.
 * - cycle 269 signature/counterHint 동작 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 270: getEnemyTacticalProfile에서 12 dead 필드 제거', async () => {
    const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
    const enemy = {
        name: 'TestBoss', baseName: 'TestBoss', isBoss: true,
        hp: 100, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0.2, heavyChance: 0.3 },
    };
    const profile = getEnemyTacticalProfile(enemy, { def: 10 });
    assert.ok(profile, 'getEnemyTacticalProfile 정상 반환');
    // 12 dead 필드 모두 제거됨.
    const deadFields = [
        'role', 'tier', 'guardChance', 'heavyChance', 'estimatedHit', 'estimatedHeavy',
        'weakness', 'resistance', 'rewardHint', 'warningChips', 'recommendedBuilds', 'phaseTriggered',
    ];
    deadFields.forEach((field) => {
        assert.equal(profile[field], undefined, `dead field '${field}' 제거됨`);
    });
});

test('cycle 270: 사용 필드 5종 유지 (회귀 가드)', async () => {
    const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
    const enemy = {
        name: 'TestBoss', baseName: 'TestBoss', isBoss: true,
        hp: 100, maxHp: 100, atk: 50, def: 5,
        pattern: { guardChance: 0.2, heavyChance: 0.3 },
    };
    const profile = getEnemyTacticalProfile(enemy, { def: 10 });
    // hint는 항상 정의됨 (heavyChance 30% 임계로 텍스트 결정).
    assert.ok(typeof profile.hint === 'string', 'hint 필드 유지');
    // 나머지 4종은 BOSS_BRIEFS 매칭 시에만 정의됨 — 가상 보스라 null 가능.
    assert.ok('entryHint' in profile, 'entryHint 필드 키 유지');
    assert.ok('phaseHint' in profile, 'phaseHint 필드 키 유지');
    assert.ok('signature' in profile, 'signature 필드 키 유지');
    assert.ok('counterHint' in profile, 'counterHint 필드 키 유지');
});

test('cycle 270: 실제 BOSS_BRIEFS 매칭 보스에서 5 필드 동작', async () => {
    const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
    const enemy = {
        name: '화염의 군주', baseName: '화염의 군주', isBoss: true,
        hp: 1000, maxHp: 1000, atk: 50, def: 5,
        pattern: { guardChance: 0.2, heavyChance: 0.3 },
    };
    const profile = getEnemyTacticalProfile(enemy, { def: 10 });
    assert.ok(profile.entryHint, '화염의 군주 entryHint 정의');
    assert.ok(profile.signature, '화염의 군주 signature 정의');
    assert.ok(profile.counterHint, '화염의 군주 counterHint 정의');
});

test('cycle 270: enemy null 시 null 반환 (회귀 가드)', async () => {
    const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
    assert.equal(getEnemyTacticalProfile(null, {}), null, 'enemy null → null');
});

test('cycle 270: CombatPanel display 변화 없음 (회귀 가드)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    // 리팩토링: bossBriefLine(entryHint/hint/phaseHint) 계산은 combatView.ts로 분리,
    //   signature/counterHint 조건부 렌더는 CombatPanel JSX에 잔존.
    const view = await readSrc('src/utils/combatView.ts');
    assert.ok(/tacticalProfile\?.entryHint|tacticalProfile\.entryHint/.test(view),
        'entryHint 처리 유지');
    assert.ok(/tacticalProfile\?.hint|tacticalProfile\.hint/.test(view),
        'hint 처리 유지');
    assert.ok(/tacticalProfile\?.phaseHint|tacticalProfile\.phaseHint/.test(view),
        'phaseHint 처리 유지');
    assert.ok(/tacticalProfile\?\.signature/.test(source),
        'cycle 269 signature dispatch 유지');
    assert.ok(/tacticalProfile\?\.counterHint/.test(source),
        'cycle 269 counterHint dispatch 유지');
});
