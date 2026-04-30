import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildRunSummary } from '../src/utils/gameUtils.js';

/**
 * Run summary — 전설 각인 reflect closure.
 *
 * 각 런에서 획득한 signature를 death 직후 RunSummaryCard에 노출해야
 * "이 런에서 뭘 얻었나"의 감정적 마무리가 완성된다. 현재 요약은
 * kills/bosses/relics/gold만 추적하고 signature는 침묵.
 *
 * 계약:
 *   1. buildRunSummary가 signaturesAcquired 개수 필드를 노출
 *   2. buildRunSummary가 signatureNames 배열도 노출 (표시용)
 *   3. inventory + equipment 양쪽에서 집계 (equip.weapon / armor / offhand 모두)
 *   4. 중복(같은 이름) 제외 — 한 signature는 1회로 count
 *   5. RunSummaryCard가 signaturesAcquired를 참조
 *   6. RunSummaryCard가 전용 testid로 signature 섹션 노출
 */

test('buildRunSummary exposes signaturesAcquired and signatureNames on empty player', () => {
    const player = {
        level: 1, job: '전사',
        inv: [], equip: {},
        stats: {}, relics: [], meta: {},
    };
    const summary = buildRunSummary(player, '시작 마을');
    assert.equal(summary.signaturesAcquired, 0);
    assert.deepEqual(summary.signatureNames, []);
});

test('buildRunSummary counts signature in inventory', () => {
    const player = {
        level: 5, job: '전사',
        inv: [{ name: '성검 에테르니아', type: 'weapon' }, { name: '일반 나무검', type: 'weapon' }],
        equip: {},
        stats: {}, relics: [], meta: {},
    };
    const summary = buildRunSummary(player, '포레스트');
    assert.equal(summary.signaturesAcquired, 1);
    assert.deepEqual(summary.signatureNames, ['성검 에테르니아']);
});

test('buildRunSummary counts signature equipped in any slot', () => {
    const player = {
        level: 9, job: '성기사',
        inv: [],
        equip: {
            weapon: { name: '마왕의 대낫', type: 'weapon' },
            armor: { name: '천공 성전', type: 'armor' },
            offhand: { name: '평범한 방패', type: 'shield' },
        },
        stats: {}, relics: [], meta: {},
    };
    const summary = buildRunSummary(player, '마왕성');
    assert.equal(summary.signaturesAcquired, 2);
    assert.ok(summary.signatureNames.includes('마왕의 대낫'));
    assert.ok(summary.signatureNames.includes('천공 성전'));
});

test('buildRunSummary dedupes duplicate signature names across inv + equip', () => {
    const player = {
        level: 9, job: '전사',
        inv: [{ name: '성검 에테르니아', type: 'weapon' }],
        equip: { weapon: { name: '성검 에테르니아', type: 'weapon' } },
        stats: {}, relics: [], meta: {},
    };
    const summary = buildRunSummary(player, '???');
    assert.equal(summary.signaturesAcquired, 1);
    assert.equal(summary.signatureNames.length, 1);
});

// --- RunSummaryCard UI wiring (text-based guards) ---

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('RunSummaryCard references signaturesAcquired from run summary', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /signaturesAcquired/.test(source),
        'RunSummaryCard should read signaturesAcquired off runSummary'
    );
});

test('RunSummaryCard renders "전설 각인" section with stable testid', async () => {
    const source = await readSrc('src/components/RunSummaryCard.tsx');
    assert.ok(
        /run-summary-signatures/.test(source),
        'run summary should carry data-testid="run-summary-signatures" for the signature block'
    );
    assert.ok(
        /전설 각인/.test(source),
        'run summary should label the block "전설 각인"'
    );
});
