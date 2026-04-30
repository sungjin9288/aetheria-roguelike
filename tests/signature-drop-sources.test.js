import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    getSignatureDropSources,
    getAllSignatureDropSourceIndex,
} from '../src/utils/signatureDropSources.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * 역 인덱스 — signature 이름 → 드롭 몬스터 + 확률 목록.
 * LegendaryCodex detail 패널에서 "어디서 얻지?" 질문에 즉답하기 위함.
 *
 * 계약:
 *   1. getSignatureDropSources(itemName) → [{ monster, rate }], rate 내림차순
 *   2. 미등록/null/빈 문자열 → []
 *   3. getAllSignatureDropSourceIndex() → 전체 registry에 대한 맵 (완전성 보장)
 *   4. LegendaryCodex가 helper를 detail 패널에 연결
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('getSignatureDropSources returns boss drops for 마왕의 대낫', () => {
    const sources = getSignatureDropSources('마왕의 대낫');
    assert.ok(sources.length >= 1);
    const monsters = sources.map((s) => s.monster);
    assert.ok(monsters.includes('마왕'));
    for (const src of sources) {
        assert.ok(src.rate > 0, 'every source must have positive rate');
        assert.ok(typeof src.monster === 'string' && src.monster.length > 0);
    }
});

test('getSignatureDropSources sorts by rate descending', () => {
    // 성검 에테르니아 드롭 소스: 마왕(0.10), 마왕의 사도(0.02) → 내림차순
    const sources = getSignatureDropSources('성검 에테르니아');
    assert.ok(sources.length >= 2, 'should appear under at least 마왕 and 마왕의 사도');
    for (let i = 1; i < sources.length; i += 1) {
        assert.ok(sources[i - 1].rate >= sources[i].rate);
    }
    assert.equal(sources[0].monster, '마왕', 'highest rate should be 마왕');
});

test('getSignatureDropSources returns [] for unknown/null names', () => {
    assert.deepEqual(getSignatureDropSources('유령 전설'), []);
    assert.deepEqual(getSignatureDropSources(null), []);
    assert.deepEqual(getSignatureDropSources(undefined), []);
    assert.deepEqual(getSignatureDropSources(''), []);
});

test('every signature in SIGNATURE_ITEM_REGISTRY has at least one drop source', () => {
    // Codex에 등록되어 있지만 드롭 경로가 없으면 플레이어가 영원히 못 얻음 → 강한 보장.
    const missing = [];
    for (const name of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
        const sources = getSignatureDropSources(name);
        if (sources.length === 0) missing.push(name);
    }
    assert.deepEqual(missing, [], `signatures without drop source: ${missing.join(', ')}`);
});

test('getAllSignatureDropSourceIndex returns a map with every signature as key', () => {
    const index = getAllSignatureDropSourceIndex();
    for (const name of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
        assert.ok(Array.isArray(index[name]), `index[${name}] should be an array`);
    }
});

test('getAllSignatureDropSourceIndex results are consistent with getSignatureDropSources', () => {
    const index = getAllSignatureDropSourceIndex();
    const sampleName = '마왕의 대낫';
    assert.deepEqual(index[sampleName], getSignatureDropSources(sampleName));
});

test('LegendaryCodex wires drop sources into detail panel', async () => {
    const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
    assert.ok(
        source.includes("import { getSignatureDropSources }"),
        'LegendaryCodex should import getSignatureDropSources'
    );
    assert.ok(
        /getSignatureDropSources\(selectedEntry\.item\.name\)/.test(source),
        'should call helper with selected item name'
    );
    // 획득처/DROP 레이블이 detail 패널에 등장해야 함
    assert.ok(
        /획득처|DROP FROM|drops from/i.test(source),
        'detail panel should display a "획득처" / "DROP FROM" label'
    );
});
