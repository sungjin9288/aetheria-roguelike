import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { computeSignatureSetBonus, getSignatureSetProgress, getSignatureSetDefinitions } from '../src/utils/signatureSetBonus.js';
import { findItemByName } from '../src/utils/gameUtils.js';
import { MSG } from '../src/data/messages.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/**
 * fix/signature-set-two-hand
 *
 * 2H 시그니처 무기는 offhand 슬롯을 봉쇄하므로 weapon+offhand 두 슬롯을 혼자
 * 점유한다. 1H 유저가 무기+방패 두 슬롯으로 2피스를 채울 수 있는 것과 형평을
 * 맞추기 위해, 2H 무기는 세트 카운트 2로 취급한다. 이 규칙 이전에는:
 *   - 모든 세트가 3피스+ 티어에 영원히 도달 불가 (무기 1개 + 갑옷 1개 = 최대 2)
 *   - dimension 세트는 낫(2H)이 방패 슬롯을 막아 2세트조차 영원히 발동 불가
 *
 * 실제 DB 아이템(items.ts)으로 equip 객체를 구성해 회귀를 검증한다.
 */

// 실제 DB 원본을 그대로 사용 (hands 필드 등 실제 shape 보존).
const ragnarok = findItemByName('라그나로크'); // dragon-lord, 2H weapon
const dragonLordArmor = findItemByName('드래곤로드 갑주'); // dragon-lord, armor
const dimensionScythe = findItemByName('차원 마왕의 낫'); // dimension, 2H weapon
const dimensionShield = findItemByName('차원 방패 이지스'); // dimension, offhand(shield)
const holySword = findItemByName('성검 에테르니아'); // celestial, 1H weapon
const holyRelic = findItemByName('천공 성전'); // celestial, offhand(focus shield)

test('sanity: fixtures resolved from real DB with hands field intact', () => {
    assert.ok(ragnarok, '라그나로크 must exist in DB');
    assert.equal(ragnarok.hands, 2);
    assert.ok(dragonLordArmor);
    assert.ok(dimensionScythe);
    assert.equal(dimensionScythe.hands, 2);
    assert.ok(dimensionShield);
    assert.ok(holySword);
    assert.ok(holyRelic);
    assert.notEqual(holySword.hands, 2, '성검 에테르니아 is 1H');
});

// ① 2H 시그 무기 단독(라그나로크) → 2세트 발동 (기존엔 미발동이었음 — 무기 1개뿐이라 groups.length < 2)
test('2H signature weapon alone (라그나로크) triggers dragon-lord 2-set (previously inert: single item, no 2nd slot)', () => {
    const result = computeSignatureSetBonus({
        weapon: ragnarok,
        armor: null,
        offhand: null,
    });
    assert.ok(result.activeSet, '2H weapon alone must count as 2 pieces and activate the set');
    assert.equal(result.activeSet.key, 'dragon-lord');
    assert.equal(result.activeSet.count, 2);
    assert.equal(result.activeSet.tier, 2);
    assert.ok(result.atkMult > 1);
});

// ② 2H + 같은 세트 armor → 3세트
test('2H weapon + matching armor (라그나로크 + 드래곤로드 갑주) triggers dragon-lord 3-set', () => {
    const result = computeSignatureSetBonus({
        weapon: ragnarok,
        armor: dragonLordArmor,
        offhand: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'dragon-lord');
    assert.equal(result.activeSet.count, 3, '2H(2) + armor(1) = 3');
    assert.equal(result.activeSet.tier, 3);
});

// ③ 1H 시그 무기 단독 → 미발동 (회귀, 기존 동작 유지)
test('1H signature weapon alone (성검 에테르니아) still does NOT activate a set (regression)', () => {
    const result = computeSignatureSetBonus({
        weapon: holySword,
        armor: null,
        offhand: null,
    });
    assert.equal(result.activeSet, null);
});

// ④ 1H + armor → 2세트 (회귀)
test('1H signature weapon + offhand (성검 에테르니아 + 천공 성전) still triggers celestial 2-set (regression)', () => {
    const result = computeSignatureSetBonus({
        weapon: holySword,
        offhand: holyRelic,
        armor: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'celestial');
    assert.equal(result.activeSet.count, 2);
});

// ⑤ dimension: 차원 마왕의 낫 단독 → 2세트 발동 (사망 세트 부활)
test('dimension set revived: 차원 마왕의 낫 alone triggers the 2-set (was permanently dead before)', () => {
    const result = computeSignatureSetBonus({
        weapon: dimensionScythe,
        armor: null,
        offhand: null,
    });
    assert.ok(result.activeSet, 'dimension set must now be reachable with only the 2H scythe equipped');
    assert.equal(result.activeSet.key, 'dimension');
    assert.equal(result.activeSet.count, 2);
});

test('dimension set also triggers via shield + scythe together (still count 2, capped at only tier)', () => {
    const result = computeSignatureSetBonus({
        weapon: dimensionScythe,
        offhand: dimensionShield,
        armor: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'dimension');
    // NOTE: offhand is normally blocked by a 2H weapon in real equip flow (equipmentUtils
    // enforces this on equip actions); this fixture only exercises the pure calculation.
    assert.equal(result.activeSet.count, 3, '2H(2) + offhand(1) = 3, clamped to the only defined tier (2)');
    assert.equal(result.activeSet.tier, 2);
});

// ⑥ getSignatureSetProgress: 2H 장착 시 equippedCount 2 반영
test('getSignatureSetProgress reflects equippedCount=2 for a lone 2H weapon and flags twoHandCounted', () => {
    const result = getSignatureSetProgress({
        weapon: ragnarok,
        armor: null,
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.key, 'dragon-lord');
    assert.equal(result.equippedCount, 2);
    assert.equal(result.currentTier, 2);
    assert.equal(result.isActive, true);
    assert.equal(result.twoHandCounted, true);
});

test('getSignatureSetProgress twoHandCounted is false for 1H-only progress', () => {
    const result = getSignatureSetProgress({
        weapon: holySword,
        armor: null,
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.equippedCount, 1);
    assert.equal(result.twoHandCounted, false);
});

test('getSignatureSetProgress missingMembers still lists real member names once (not duplicated by weight)', () => {
    const result = getSignatureSetProgress({
        weapon: ragnarok,
        armor: null,
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.totalMembers, 3);
    // dragon-lord members: 드래곤로드 갑주, 용의 화염, 라그나로크 — 라그나로크는 장착 중이므로 제외한 2개만 missing
    assert.equal(result.missingMembers.length, 2);
    assert.ok(result.missingMembers.includes('드래곤로드 갑주'));
    assert.ok(result.missingMembers.includes('용의 화염'));
});

// ⑦ celestial 4티어 부재 + 3티어 도달 가능
test('celestial set no longer defines an unreachable 4-tier', () => {
    const defs = getSignatureSetDefinitions();
    const celestial = defs.celestial;
    assert.ok(celestial);
    assert.equal(celestial.bonuses['4'], undefined, 'tier 4 must be removed — unreachable even with 2H counted as 2');
    assert.ok(celestial.bonuses['3'], 'tier 3 must remain reachable');
});

test('celestial 3-tier is reachable: 2H weapon (성스러운 창) + offhand (천공 성전) = count 3', () => {
    const holySpear = findItemByName('성스러운 창'); // celestial, 2H weapon
    assert.equal(holySpear.hands, 2);
    const result = computeSignatureSetBonus({
        weapon: holySpear,
        offhand: holyRelic,
        armor: null,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'celestial');
    assert.equal(result.activeSet.count, 3);
    assert.equal(result.activeSet.tier, 3);
});

test('every signature set tier is reachable given 3 equip slots and 2H=2 weighting', () => {
    const defs = getSignatureSetDefinitions();
    for (const [key, def] of Object.entries(defs)) {
        const maxTier = Math.max(...Object.keys(def.bonuses).map(Number));
        // Best-case reachable count: 2 (if a 2H member exists) + 1 (armor/offhand) = 3, or 2 members flat.
        const hasTwoHandMember = def.members.some((name) => {
            const dbItem = findItemByName(name);
            return dbItem?.hands === 2;
        });
        const maxReachable = hasTwoHandMember ? 3 : 2;
        assert.ok(
            maxTier <= maxReachable,
            `${key}: max tier ${maxTier} must be <= max reachable count ${maxReachable}`
        );
    }
});

// --- MSG + EquipmentPanel wiring (컴포넌트에 로직 금지 — twoHandCounted 플래그만 렌더링) ---

test('MSG.SIGNATURE_SET_TWO_HAND_HINT is defined (no hardcoded Korean string in component)', () => {
    assert.equal(typeof MSG.SIGNATURE_SET_TWO_HAND_HINT, 'string');
    assert.ok(MSG.SIGNATURE_SET_TWO_HAND_HINT.length > 0);
});

test('EquipmentPanel renders the two-hand hint conditionally on setProgress.twoHandCounted (source guard)', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    assert.ok(/import \{ MSG \} from '\.\.\/data\/messages'/.test(source), 'MSG imported');
    assert.ok(/setProgress\.twoHandCounted/.test(source), 'reads setProgress.twoHandCounted (no re-derivation in component)');
    assert.ok(/MSG\.SIGNATURE_SET_TWO_HAND_HINT/.test(source), 'renders MSG.SIGNATURE_SET_TWO_HAND_HINT');
});
