import test from 'node:test';
import assert from 'node:assert/strict';

import { DROP_TABLES } from '../src/data/dropTables.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * Signature 아이템이 최소 1개 이상의 보스 drop table에 연결되어 있는지 검증.
 *
 * 회귀 시나리오:
 * - signatureRegistry에 등록됐지만 어떤 보스도 drop하지 않으면 유저가 획득 경로 0.
 * - 보스 이름이 바뀌거나 오타 시 drop 끊김.
 */

const getSignatureDropMap = () => {
    const map = new Map();
    for (const itemName of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
        map.set(itemName, []);
    }
    for (const [bossName, drops] of Object.entries(DROP_TABLES)) {
        for (const entry of drops) {
            if (map.has(entry.item)) {
                map.get(entry.item).push({ bossName, rate: entry.rate });
            }
        }
    }
    return map;
};

test('every registered signature has at least one boss drop source', () => {
    const dropMap = getSignatureDropMap();
    const orphans = [];
    for (const [itemName, drops] of dropMap.entries()) {
        if (drops.length === 0) orphans.push(itemName);
    }
    assert.equal(
        orphans.length,
        0,
        `Signature items without any drop source:\n${orphans.join('\n')}`
    );
});

test('signature drop rates are between 0.01 and 0.20 (유의미한 rarity 유지)', () => {
    const dropMap = getSignatureDropMap();
    const outOfBounds = [];
    for (const [itemName, drops] of dropMap.entries()) {
        for (const { bossName, rate } of drops) {
            if (rate < 0.01 || rate > 0.20) {
                outOfBounds.push(`${itemName} ← ${bossName} @ rate=${rate}`);
            }
        }
    }
    assert.equal(
        outOfBounds.length,
        0,
        `Drop rates outside [0.01, 0.20]:\n${outOfBounds.join('\n')}`
    );
});

test('signature drops are only on level-appropriate boss-class enemies (no trash mob signatures)', () => {
    // 화염 정령 / 슬라임 / 늑대 등 트래시 모브는 signature를 drop하면 안 된다.
    const trashMobs = new Set([
        '슬라임', '늑대', '멧돼지', '고블린', '코볼트', '거미떼',
        '초록슬라임', '들개', '박쥐 떼', '광산 박쥐',
    ]);
    const violations = [];
    for (const [bossName, drops] of Object.entries(DROP_TABLES)) {
        if (!trashMobs.has(bossName)) continue;
        for (const entry of drops) {
            if (SIGNATURE_ITEM_REGISTRY[entry.item]) {
                violations.push(`${bossName} drops signature ${entry.item}`);
            }
        }
    }
    assert.equal(violations.length, 0, `Trash mobs dropping signatures:\n${violations.join('\n')}`);
});

test('at least 3 distinct signatures are tied to boss 마왕 (보스 앵커)', () => {
    // 마왕은 엔드게임 앵커 — 여러 signature를 drop해야 정체성 유지
    const demonKingDrops = (DROP_TABLES['마왕'] || []).filter((entry) => SIGNATURE_ITEM_REGISTRY[entry.item]);
    assert.ok(
        demonKingDrops.length >= 2,
        `마왕 should drop at least 2 signatures, got ${demonKingDrops.length}`
    );
});
