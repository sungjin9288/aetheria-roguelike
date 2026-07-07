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
// 설계 보정(리뷰 피드백): "세트의 메리트는 모았을 때" — 2H 가중치(카운트 2)는
// 티어 도달 공정성용이고, 발동 자체는 서로 다른 세트 아이템 SIGNATURE_SET_MIN_ITEMS(2)개
// 이상을 요구한다. 따라서 2H 단독은 카운트 2여도 미발동.
test('2H signature weapon alone (라그나로크) does NOT activate — 세트는 모아야 메리트 (min-items 게이트)', () => {
    const result = computeSignatureSetBonus({
        weapon: ragnarok,
        armor: null,
        offhand: null,
    });
    assert.equal(result.activeSet, null, '2H 단독(아이템 1개)은 카운트 2여도 발동 불가');
    assert.equal(result.atkMult, 1);
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

// ⑤ dimension 부활: 낫(2H)이 방패 슬롯을 막아 영구 사망이었던 세트 —
//    갑옷 멤버(혼돈의 갑주) 승격으로 두 경로 확보.
test('dimension set revived: 낫(2H) + 혼돈의 갑주(armor) = count 3 → 3세트', () => {
    const voidCoat = findItemByName('혼돈의 갑주');
    assert.ok(voidCoat, '혼돈의 갑주 DB 존재');
    const result = computeSignatureSetBonus({
        weapon: dimensionScythe,
        armor: voidCoat,
        offhand: null,
    });
    assert.ok(result.activeSet, '낫+외투 (아이템 2개, 카운트 3) → 발동');
    assert.equal(result.activeSet.key, 'dimension');
    assert.equal(result.activeSet.count, 3);
    assert.equal(result.activeSet.tier, 3);
});

test('dimension: 이지스(shield) + 혼돈의 갑주(armor) = 2세트 (1H/방패 경로)', () => {
    const voidCoat = findItemByName('혼돈의 갑주');
    const result = computeSignatureSetBonus({
        weapon: null,
        armor: voidCoat,
        offhand: dimensionShield,
    });
    assert.ok(result.activeSet);
    assert.equal(result.activeSet.key, 'dimension');
    assert.equal(result.activeSet.count, 2);
    assert.equal(result.activeSet.tier, 2);
});

test('dimension: 낫 단독은 미발동 (min-items) — 세트는 모아야 메리트', () => {
    const result = computeSignatureSetBonus({
        weapon: dimensionScythe,
        armor: null,
        offhand: null,
    });
    assert.equal(result.activeSet, null);
});

// ⑥ getSignatureSetProgress: 2H 장착 시 equippedCount 2 반영
test('getSignatureSetProgress: 2H 단독 = equippedCount 2, 미발동, 다음 목표는 tier 3 안내', () => {
    const result = getSignatureSetProgress({
        weapon: ragnarok,
        armor: null,
        offhand: null,
    });
    assert.ok(result);
    assert.equal(result.key, 'dragon-lord');
    assert.equal(result.equippedCount, 2, '가중 카운트는 2 (진행도 표시용)');
    assert.equal(result.currentTier, null, 'min-items 미충족 — 발동 안 됨');
    assert.equal(result.isActive, false);
    assert.equal(result.twoHandCounted, true);
    // 아이템 1개만 더 모으면 카운트 3 → dragon-lord tier 3에 바로 도달함을 안내.
    assert.equal(result.nextTier, 3);
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

// ⑦ celestial: 합법 조합(2H는 shield offhand와 양립 불가) 기준 상한은
//    성검(1H)+성전(shield)=2피스 — 3·4티어 모두 제거됨. 2H 창/신전 지팡이는
//    세트 기여 대신 "그 자체로 강력한 단독 시그니처" 정체성 (설계 원칙).
test('celestial is a 2-tier set: unreachable 3/4 tiers removed', () => {
    const defs = getSignatureSetDefinitions();
    const celestial = defs.celestial;
    assert.ok(celestial);
    assert.equal(celestial.bonuses['4'], undefined, 'tier 4 removed');
    assert.equal(celestial.bonuses['3'], undefined,
        'tier 3 removed — 천공 성전(type shield)은 2H와 양립 불가 + 갑옷 멤버 부재라 합법 상한 2피스');
    assert.ok(celestial.bonuses['2'], 'tier 2 remains (성검+성전 경로)');
});

test('celestial 2H 창은 세트 기여 불가(단독 시그니처 정체성) — 창 단독 미발동', () => {
    const holySpear = findItemByName('성스러운 창'); // celestial, 2H weapon
    assert.equal(holySpear.hands, 2);
    const result = computeSignatureSetBonus({
        weapon: holySpear,
        offhand: null, // 2H가 shield offhand(천공 성전)를 봉쇄하므로 실전에서 함께 착용 불가
        armor: null,
    });
    assert.equal(result.activeSet, null, 'min-items 게이트 — 창 단독은 세트 미발동');
});

test('every signature set tier is reachable under LEGAL equips (2H blocks shield offhand, min 2 items)', () => {
    const defs = getSignatureSetDefinitions();
    for (const [key, def] of Object.entries(defs)) {
        const maxTier = Math.max(...Object.keys(def.bonuses).map(Number));
        // 합법 조합 모델: 무기 슬롯 1개(1H=1 or 2H=2 카운트), 갑옷 1, offhand(shield)는
        // 2H와 양립 불가. 발동엔 서로 다른 아이템 2개 이상 필요.
        const memberItems = def.members.map((name) => findItemByName(name)).filter(Boolean);
        const armors = memberItems.filter((i) => i.type === 'armor');
        const shields = memberItems.filter((i) => i.type === 'shield');
        const oneHanders = memberItems.filter((i) => i.type === 'weapon' && i.hands !== 2);
        const twoHanders = memberItems.filter((i) => i.type === 'weapon' && i.hands === 2);

        let maxLegal = 0;
        // 2H + 갑옷 (아이템 2, 카운트 3)
        if (twoHanders.length && armors.length) maxLegal = Math.max(maxLegal, 3);
        // 1H + 갑옷 + 방패 (최대 3슬롯)
        const flat = Math.min(1, oneHanders.length) + Math.min(1, armors.length) + Math.min(1, shields.length);
        if (flat >= 2) maxLegal = Math.max(maxLegal, flat);

        assert.ok(
            maxTier <= maxLegal,
            `${key}: max tier ${maxTier}가 합법 조합 상한 ${maxLegal}을 초과 — 도달 불가 티어(dead content)`
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
