import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { glob } from 'node:fs/promises';

import { CONSTANTS, BALANCE } from '../src/data/constants.js';

/**
 * cycle 138: CONSTANTS/BALANCE namespace 정합성 회귀 가드.
 *
 * cycle 137에서 발견:
 * - combatBossHandlers.ts:17 → `CONSTANTS.PRIMAL_SHARD_DROP_CHANCE`
 *   (실제론 BALANCE에 있음 → undefined → shard never drops)
 * - useInventoryActions.ts:489 → `CONSTANTS.DAILY_INVADE_LIMIT`
 *   (실제론 BALANCE에 있음 → undefined → invade 무제한)
 *
 * 두 버그 모두 잘못된 namespace 참조로 인한 게임 핵심 메커니즘 비활성. 이번
 * 사이클은 이런 mismatch가 미래에 다시 생기지 않도록 자동화된 회귀 가드를
 * 도입한다.
 *
 * 검증:
 * src/ 전체에서 `BALANCE.X` 또는 `CONSTANTS.X` 형태의 참조를 추출하고, 각
 * 키가 해당 객체에 정의되어 있는지 확인. 정의되지 않은 참조는 즉시 실패.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

async function listSrcFiles() {
    const files = [];
    for await (const file of glob(path.join(ROOT, 'src/**/*.{ts,tsx}'))) {
        files.push(file);
    }
    return files;
}

async function collectRefs(prefix) {
    const re = new RegExp(`\\b${prefix}\\.([A-Z][A-Z0-9_]+)`, 'g');
    const refs = new Set();
    const files = await listSrcFiles();
    for (const file of files) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(re)) {
            refs.add(match[1]);
        }
    }
    return refs;
}

test('CONSTANTS.X 참조 — 모든 키가 CONSTANTS 객체에 정의됨', async () => {
    const refs = await collectRefs('CONSTANTS');
    const broken = [...refs].filter((key) => CONSTANTS[key] === undefined);
    assert.deepEqual(broken, [], `broken CONSTANTS refs: ${broken.join(', ')}`);
});

test('BALANCE.X 참조 — 모든 키가 BALANCE 객체에 정의됨', async () => {
    const refs = await collectRefs('BALANCE');
    const broken = [...refs].filter((key) => BALANCE[key] === undefined);
    assert.deepEqual(broken, [], `broken BALANCE refs: ${broken.join(', ')}`);
});

test('cycle 137 회귀 가드: PRIMAL_SHARD_* 가 BALANCE에만 있고 CONSTANTS엔 없음', () => {
    assert.equal(typeof BALANCE.PRIMAL_SHARD_DROP_CHANCE, 'number');
    assert.equal(typeof BALANCE.PRIMAL_SHARD_REQUIRED, 'number');
    assert.equal(CONSTANTS.PRIMAL_SHARD_DROP_CHANCE, undefined);
    assert.equal(CONSTANTS.PRIMAL_SHARD_REQUIRED, undefined);
});

test('cycle 137 회귀 가드: DAILY_INVADE_LIMIT 이 BALANCE에만 있고 CONSTANTS엔 없음', () => {
    assert.equal(typeof BALANCE.DAILY_INVADE_LIMIT, 'number');
    assert.equal(CONSTANTS.DAILY_INVADE_LIMIT, undefined);
});
