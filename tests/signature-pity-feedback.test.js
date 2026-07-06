import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Pity counter 피드백 — boss 조우 hint 옆에 공명(resonance) 상태를 노출.
 *
 * 이전 사이클에서 pity는 silent mercy로 구현됐으나 플레이어가 시스템을
 * 지각할 수 없어 "운이 좋았다"로 오인하기 쉬웠다. boss 조우 시점에
 * 별도 legendary 로그 라인으로 "공명 +XX%"를 emit해서 persistence가
 * 보상받는다는 느낌을 준다.
 *
 * 계약:
 *   1. MSG.SIGNATURE_PITY_RESONANCE(pct, pity) 함수 존재
 *   2. exploreActions가 getSignaturePityMultiplier를 import
 *   3. isBoss + 해당 보스가 signature 드롭 가능할 때만 pity 로그 emit
 *   4. pityMult <= 1.0일 때는 emit 안 함 (스팸 방지)
 *   5. pity 로그도 legendary 타입 사용 (Terminal에서 gold 스타일 재사용)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('MSG.SIGNATURE_PITY_RESONANCE is defined as a function in messages.js', async () => {
    const source = await readSrc('src/data/messages.ts');
    assert.ok(
        /SIGNATURE_PITY_RESONANCE\s*:\s*\(/.test(source),
        'SIGNATURE_PITY_RESONANCE should be a function in MSG'
    );
});

test('exploreActions imports getSignaturePityMultiplier', async () => {
    // 탐험 스카우팅(2026-07): 로직이 exploreUtils.ts의 runQuietRollAndCombat으로 이동
    // (exploreActions.ts와 eventActions.ts "짙은 안개" 카드가 공유) — 경로만 갱신.
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(
        source.includes('getSignaturePityMultiplier'),
        'exploreActions should import getSignaturePityMultiplier'
    );
});

test('exploreActions emits pity resonance log as legendary type', async () => {
    // 탐험 스카우팅(2026-07): 로직이 exploreUtils.ts의 runQuietRollAndCombat으로 이동
    // (exploreActions.ts와 eventActions.ts "짙은 안개" 카드가 공유) — 경로만 갱신.
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(
        /SIGNATURE_PITY_RESONANCE/.test(source),
        'should reference MSG.SIGNATURE_PITY_RESONANCE'
    );
    // legendary 로그 타입으로 emit
    assert.ok(
        /addLog\(\s*'legendary'\s*,\s*MSG\.SIGNATURE_PITY_RESONANCE/.test(source),
        'pity resonance should be emitted as legendary log'
    );
});

test('exploreActions gates pity log behind pityMult > 1 AND boss signature available', async () => {
    // 탐험 스카우팅(2026-07): 로직이 exploreUtils.ts의 runQuietRollAndCombat으로 이동
    // (exploreActions.ts와 eventActions.ts "짙은 안개" 카드가 공유) — 경로만 갱신.
    const source = await readSrc('src/utils/exploreUtils.ts');
    // pityMult > 1 가드
    assert.ok(
        /pityMult\s*>\s*1/.test(source) || /signaturePityMult\s*>\s*1/.test(source),
        'should only emit pity log when multiplier > 1.0'
    );
    // boss signature 리스트가 있을 때만 (hint와 동일 블럭 안에서 emit)
    assert.ok(
        /sigDrops\.length\s*>\s*0/.test(source),
        'pity log should be inside the sigDrops.length > 0 block'
    );
});

test('exploreActions computes pity multiplier from player.stats.signaturePity', async () => {
    // 탐험 스카우팅(2026-07): 로직이 exploreUtils.ts의 runQuietRollAndCombat으로 이동
    // (exploreActions.ts와 eventActions.ts "짙은 안개" 카드가 공유) — 경로만 갱신.
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(
        /getSignaturePityMultiplier\(\s*player\.stats\??\.?signaturePity/.test(source)
            || /getSignaturePityMultiplier\(\s*player\?\.\s*stats\?\.\s*signaturePity/.test(source),
        'should call getSignaturePityMultiplier with player.stats.signaturePity'
    );
});
