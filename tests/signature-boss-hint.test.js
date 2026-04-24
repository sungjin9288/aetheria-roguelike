import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getBossSignatureDrops } from '../src/utils/bossSignatureHint.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * Boss 조우 시 signature 각인 드롭 가능성을 미리 예고하는 "anticipate" 레이어.
 *
 * 계약:
 *   1. getBossSignatureDrops는 DROP_TABLES 엔트리 중 SIGNATURE_ITEM_REGISTRY에 등록된 것만 반환
 *   2. rate 내림차순 정렬 (최고 확률 먼저)
 *   3. 존재하지 않는 몬스터/null/undefined 입력은 빈 배열
 *   4. exploreActions가 boss 등장 시 hint를 legendary 로그로 emit
 *   5. MSG.SIGNATURE_BOSS_HINT가 존재하고 함수형
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('getBossSignatureDrops returns signature drops for 마왕', () => {
    const drops = getBossSignatureDrops('마왕');
    assert.ok(drops.length >= 2, 'expected at least 2 signature drops for 마왕');
    const names = drops.map((d) => d.name);
    assert.ok(names.includes('마왕의 대낫'));
    assert.ok(names.includes('성검 에테르니아'));
    for (const drop of drops) {
        assert.ok(drop.rate > 0, 'each signature drop must have positive rate');
        assert.ok(SIGNATURE_ITEM_REGISTRY[drop.name], `${drop.name} must be in signature registry`);
    }
});

test('getBossSignatureDrops sorts by rate descending', () => {
    const drops = getBossSignatureDrops('마왕');
    for (let i = 1; i < drops.length; i += 1) {
        assert.ok(drops[i - 1].rate >= drops[i].rate, 'drops should be rate-descending');
    }
});

test('getBossSignatureDrops ignores non-signature drops (e.g. 엘릭서, 마왕의 혼)', () => {
    const drops = getBossSignatureDrops('마왕');
    const names = drops.map((d) => d.name);
    assert.ok(!names.includes('엘릭서'), '엘릭서 is not a signature — should be excluded');
    assert.ok(!names.includes('마왕의 혼'), '마왕의 혼 is not a signature — should be excluded');
});

test('getBossSignatureDrops returns empty array for unknown/null monsters', () => {
    assert.deepEqual(getBossSignatureDrops('슬라임'), []); // signature 없음
    assert.deepEqual(getBossSignatureDrops('유령 몬스터'), []); // 없는 이름
    assert.deepEqual(getBossSignatureDrops(null), []);
    assert.deepEqual(getBossSignatureDrops(undefined), []);
    assert.deepEqual(getBossSignatureDrops(''), []);
});

test('getBossSignatureDrops covers major signature-dropping bosses', () => {
    const bosses = ['마왕', '레드 드래곤', '아이스 드래곤', '차원 파쇄자', '에테르 드래곤', '혼돈의 화신'];
    for (const name of bosses) {
        const drops = getBossSignatureDrops(name);
        assert.ok(drops.length > 0, `${name} should have at least one signature drop`);
    }
});

test('MSG.SIGNATURE_BOSS_HINT is a function returning Korean hint string', async () => {
    const source = await readSrc('src/data/messages.js');
    assert.ok(
        /SIGNATURE_BOSS_HINT\s*:\s*\(/.test(source),
        'SIGNATURE_BOSS_HINT should be defined as a function in MSG'
    );
});

test('exploreActions wires signature boss hint before ENEMY_APPEAR log', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.js');
    assert.ok(
        source.includes("import { getBossSignatureDrops }"),
        'exploreActions should import getBossSignatureDrops'
    );
    assert.ok(
        /getBossSignatureDrops\(mStats\.baseName\)/.test(source),
        'should call getBossSignatureDrops with mStats.baseName'
    );
    assert.ok(
        /SIGNATURE_BOSS_HINT/.test(source),
        'should emit MSG.SIGNATURE_BOSS_HINT'
    );
    // legendary 로그 타입을 재사용 (Terminal에서 골드 스타일로 렌더)
    assert.ok(
        /addLog\(\s*'legendary'\s*,\s*MSG\.SIGNATURE_BOSS_HINT/.test(source),
        'hint should be emitted as legendary log type'
    );
    // boss 여부 가드 (일반 몬스터 미포함)
    assert.ok(
        /mStats\.isBoss/.test(source),
        'should guard hint emission behind mStats.isBoss'
    );
});
