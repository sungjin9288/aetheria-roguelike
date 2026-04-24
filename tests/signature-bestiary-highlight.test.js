import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Bestiary signature 드롭 노출 — "Plan" 계층 surface.
 *
 * 기존 Bestiary는 LOOT_TABLE만 참조해서 강화 DROP_TABLES에 등록된
 * signature 아이템이 전혀 노출되지 않았다. 플레이어는 monster별 고유
 * legendary 드롭 가능성을 짐작할 수단이 없었다.
 *
 * 계약:
 *   1. Bestiary가 getBossSignatureDrops(혹은 동등) import
 *   2. 몬스터별 signature 드롭 리스트 계산 (signatureDrops 필드)
 *   3. 각 몬스터 버튼/카드에 data-has-signature 속성
 *   4. 상세 패널에 "전설 각인" 섹션 + rate % 노출
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('Bestiary imports signature drop helper', async () => {
    const source = await readSrc('src/components/Bestiary.jsx');
    assert.ok(
        /getBossSignatureDrops/.test(source),
        'Bestiary should import a signature drop helper (e.g. getBossSignatureDrops)'
    );
});

test('Bestiary computes signatureDrops per monster', async () => {
    const source = await readSrc('src/components/Bestiary.jsx');
    assert.ok(
        /signatureDrops/.test(source),
        'Bestiary should expose signatureDrops on each monster entry'
    );
});

test('Bestiary monster button carries data-has-signature attribute', async () => {
    const source = await readSrc('src/components/Bestiary.jsx');
    assert.ok(
        /data-has-signature/.test(source),
        'monster entry should expose data-has-signature for styling/testing'
    );
});

test('Bestiary detail panel renders "전설 각인" label with rate %', async () => {
    const source = await readSrc('src/components/Bestiary.jsx');
    assert.ok(
        /전설 각인/.test(source),
        'detail panel should render a 전설 각인 section'
    );
    // Rate 계산 패턴 (% 표시)
    assert.ok(
        /Math\.round\([^)]*rate[^)]*\)/.test(source) || /rate\s*\*\s*100/.test(source),
        'detail panel should render drop rate as percentage'
    );
});

test('Bestiary uses stable testid for signature drops section', async () => {
    const source = await readSrc('src/components/Bestiary.jsx');
    assert.ok(
        /bestiary-signature-drops/.test(source),
        'signature drops section should carry a stable testid'
    );
});
