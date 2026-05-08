import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 327: JOB_TYPICAL_LOADOUT dead data export 제거 (paired test cleanup)
 *   (cycle 222-326 silent dead config 시리즈 96번째 — cleanup lens 연속).
 *
 * 발견 (dead data):
 * - src/utils/avatarSpriteCandidates.ts: JOB_TYPICAL_LOADOUT export — 13 직업 × 무기 매핑.
 *   - cycle 43-46 시점 outfit affinity 표시용으로 보존했으나 그 dispatch path 미구현.
 *   - getAvatarSpriteCandidates 등 내부 다른 함수에서도 사용 0건.
 *   - 테스트 (avatar-sprite-priority.test.js)만이 유일한 consumer.
 *
 * 패턴 (cycle 222-326 silent dead config 시리즈 96번째):
 * - cycle 326: TokenQuotaManager.getRemainingCalls dead method.
 * - cycle 327: JOB_TYPICAL_LOADOUT dead data + paired test 정리.
 *
 * 수정:
 * - src/utils/avatarSpriteCandidates.ts: JOB_TYPICAL_LOADOUT 정의 + export 제거.
 * - tests/avatar-sprite-priority.test.js: import에서 JOB_TYPICAL_LOADOUT 제거 +
 *   "보존 가드" 테스트 케이스 제거.
 *
 * 회귀 가드:
 * - JOB_SPRITE_SLUG_MAP / getAvatarSpriteCandidates / getAvatarEquipmentPreviewCandidates
 *   active export 유지.
 * - sprite 결정 로직 (cycle 46 단순화) 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 327: JOB_TYPICAL_LOADOUT export 제거', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    assert.ok(!/export const JOB_TYPICAL_LOADOUT\b/.test(source),
        'JOB_TYPICAL_LOADOUT export 제거됨');
});

test('cycle 327: avatar-sprite-priority.test.js JOB_TYPICAL_LOADOUT import 제거', async () => {
    const source = await readSrc('tests/avatar-sprite-priority.test.js');
    assert.ok(!/import.*JOB_TYPICAL_LOADOUT/.test(source),
        'JOB_TYPICAL_LOADOUT import 제거됨');
});

test('cycle 327: avatarSpriteCandidates active exports 유지', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    const aliveExports = ['JOB_SPRITE_SLUG_MAP', 'getAvatarSpriteCandidates', 'getAvatarEquipmentPreviewCandidates'];
    aliveExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 327: getAvatarSpriteCandidates 동작 보존 (회귀 가드)', async () => {
    const { getAvatarSpriteCandidates } = await import('../src/utils/avatarSpriteCandidates.js');
    const candidates = getAvatarSpriteCandidates({ job: '???', armorStyle: 'plate', loadoutStyle: 'sword' });
    assert.ok(Array.isArray(candidates), 'array 반환');
    assert.ok(candidates.length > 0, '최소 1개 sprite 후보 (adventurer fallback)');
});

test('cycle 326 회귀 가드: TokenQuotaManager.getRemainingCalls 제거 보존', async () => {
    const source = await readSrc('src/systems/TokenQuotaManager.ts');
    assert.ok(!/getRemainingCalls\s*\(/.test(source),
        'cycle 326 getRemainingCalls 제거 보존');
});
