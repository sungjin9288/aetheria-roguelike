import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { validateSynthesis, getSynthesisGroups } from '../src/utils/synthesisUtils.js';
import { MSG } from '../src/data/messages.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * Synthesis는 sell보다 더 destructive — 3개를 한 번에 소비하고 결과는 확률.
 * 현재 sell은 SIGNATURE_SELL_BLOCKED로 보호하지만 synthesize는 어떤 보호도 없다.
 * 플레이어가 picker에서 signature를 다른 T-X 무기로 착각해 합성에 넣으면
 * pity 적립 + 발견 + drop overlay 모두 무의미해진다.
 *
 * 다층 방어 계약:
 *   1. validateSynthesis는 입력 중 1개라도 signature면 reason='SIGNATURE_INPUT' 반환
 *   2. getSynthesisGroups는 signature를 그룹에서 제외 (picker에 노출 X)
 *   3. MSG.SIGNATURE_SYNTH_BLOCKED(name)이 정의됨
 *   4. useInventoryActions의 synthesize가 SIGNATURE_INPUT reason을 처리해
 *      MSG.SIGNATURE_SYNTH_BLOCKED 로그 emit (defense in depth)
 */

// 합성 가능한 weapon T1 fixture를 만들어둔다 — DB.ITEMS.weapons에 분명히 존재.
import { DB } from '../src/data/db.js';

const findT1Weapon = () => DB.ITEMS.weapons.find((w) => w.tier === 1 && w.type === 'weapon');
const findFirstWeaponSignatureName = () => {
    for (const [name, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        if (meta.spriteKey?.startsWith('signature-weapon-')) return name;
    }
    return null;
};

test('validateSynthesis rejects when any input is a signature item', () => {
    const baseWeapon = findT1Weapon();
    const sigName = findFirstWeaponSignatureName();
    assert.ok(baseWeapon && sigName, 'fixtures present');

    const normal = { ...baseWeapon, id: 'a' };
    const dup = { ...baseWeapon, id: 'b' };
    const signature = { ...baseWeapon, id: 'c', name: sigName }; // signature는 type=weapon이라 picker 통과 가능

    const result = validateSynthesis([normal, dup, signature], 100000);
    assert.equal(result.valid, false);
    assert.equal(
        result.reason,
        'SIGNATURE_INPUT',
        `signature 입력 거부 reason은 SIGNATURE_INPUT이어야 함, got: ${result.reason}`
    );
});

test('validateSynthesis rejects when ALL inputs are signatures', () => {
    const baseWeapon = findT1Weapon();
    const sigName = findFirstWeaponSignatureName();
    if (!baseWeapon || !sigName) return;

    const sig = (id) => ({ ...baseWeapon, id, name: sigName });
    const result = validateSynthesis([sig('a'), sig('b'), sig('c')], 100000);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'SIGNATURE_INPUT');
});

test('validateSynthesis still passes for plain non-signature inputs', () => {
    const baseWeapon = findT1Weapon();
    if (!baseWeapon) return;

    const make = (id) => ({ ...baseWeapon, id });
    const result = validateSynthesis([make('a'), make('b'), make('c')], 100000);
    assert.equal(result.valid, true, `plain T1 weapons should still pass, got: ${JSON.stringify(result)}`);
});

test('getSynthesisGroups excludes signature items from the picker', () => {
    const baseWeapon = findT1Weapon();
    const sigName = findFirstWeaponSignatureName();
    if (!baseWeapon || !sigName) return;

    const inv = [
        { ...baseWeapon, id: 'p1' },
        { ...baseWeapon, id: 'p2' },
        { ...baseWeapon, id: 'p3' },
        { ...baseWeapon, id: 'sig', name: sigName },
    ];
    const groups = getSynthesisGroups(inv);
    const allItems = groups.flatMap((g) => g.items);
    assert.ok(
        !allItems.some((it) => it.name === sigName),
        'signature item should NOT appear in any synth group'
    );
    // 일반 3개는 그대로 그룹 안에 있어야 함
    assert.ok(allItems.length >= 3, 'normal items still grouped');
});

test('MSG.SIGNATURE_SYNTH_BLOCKED is a function returning the item name', () => {
    assert.equal(typeof MSG.SIGNATURE_SYNTH_BLOCKED, 'function');
    const text = MSG.SIGNATURE_SYNTH_BLOCKED('성검 에테르니아');
    assert.match(text, /성검 에테르니아/);
    assert.match(text, /합성|전설/);
});

// --- useInventoryActions defense-in-depth guard ---
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('useInventoryActions.synthesize handles SIGNATURE_INPUT reason', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.js');
    assert.ok(
        /SIGNATURE_INPUT/.test(source),
        'synthesize should reference the SIGNATURE_INPUT validation reason'
    );
    assert.ok(
        /MSG\.SIGNATURE_SYNTH_BLOCKED/.test(source),
        'synthesize should emit MSG.SIGNATURE_SYNTH_BLOCKED log on signature inputs'
    );
});
