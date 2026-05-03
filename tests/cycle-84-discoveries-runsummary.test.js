import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildRunSummary } from '../src/utils/gameUtils.js';
import { buildRunShareText } from '../src/utils/runShareText.js';

/**
 * cycle 84: 'discoveries' 시맨틱 통일 마무리 — RunSummary/share에 맵 발견 수 노출 +
 * 잔존 dead write 제거.
 *
 * cycle 83에서 discoveries → visitedMaps.length로 의미를 통일했고,
 * 이번 사이클은 그 마무리:
 *   1. _shared.ts의 stats.discoveries 누적 (이제 dead write) 제거
 *   2. INITIAL_STATE.player.stats.discoveries 선언 제거
 *   3. buildRunSummary가 discoveries: visitedMaps.length 노출
 *   4. buildRunShareText가 discoveries > 0일 때 "🗺️ 지도 발견 N곳" 라인 추가
 *      (escapeLine과 동일한 silence-over-noise 패턴)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('buildRunSummary: discoveries = visitedMaps.length', () => {
    const player = {
        level: 30, job: '검사', stats: {
            kills: 100, deaths: 0, total_gold: 5000,
            visitedMaps: ['시작의 마을', '평원', '숲', '동굴', '사막', '오아시스', '피라미드'],
        }, equip: {}, inv: [], relics: [],
    };
    const summary = buildRunSummary(player, '시작의 마을');
    assert.equal(summary.discoveries, 7, 'summary.discoveries should be visitedMaps.length');
});

test('buildRunSummary: visitedMaps 미설정 → discoveries = 0', () => {
    const player = {
        level: 1, job: '모험가', stats: { kills: 0, deaths: 0, total_gold: 0 },
        equip: {}, inv: [], relics: [],
    };
    const summary = buildRunSummary(player, '시작의 마을');
    assert.equal(summary.discoveries, 0);
});

test('buildRunShareText: discoveries > 0 → 지도 발견 라인 노출', () => {
    const summary = {
        job: '검사', level: 30, loc: '심연', kills: 100, bossKills: 3,
        relicsFound: 2, totalGold: 50000, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 0, discoveries: 12,
    };
    const text = buildRunShareText(summary);
    assert.match(text, /🗺️.*12.*곳/, 'should include 지도 발견 line with count');
});

test('buildRunShareText: discoveries == 0 → silent', () => {
    const summary = {
        job: '검사', level: 5, loc: '평원', kills: 5, bossKills: 0,
        relicsFound: 0, totalGold: 100, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 0, discoveries: 0,
    };
    const text = buildRunShareText(summary);
    assert.doesNotMatch(text, /지도 발견/, 'should be silent when discoveries == 0');
});

test('buildRunShareText: 기존 escape line 회귀 보존 (cycle 78)', () => {
    const summary = {
        job: '검사', level: 10, loc: '평원', kills: 50, bossKills: 1,
        relicsFound: 1, totalGold: 1000, prestigeRank: 0,
        signaturesAcquired: 0, signatureNames: [],
        escapes: 7, discoveries: 0,
    };
    const text = buildRunShareText(summary);
    assert.match(text, /🏃 도주 7회.*위험 회피/, 'escape line preserved');
});

test('_shared.ts dead write 제거 — stats.discoveries 누적 제거', async () => {
    const source = await readSrc('src/hooks/gameActions/_shared.ts');
    assert.doesNotMatch(
        source,
        /discoveries:\s*\[/,
        '_shared.ts should no longer write to stats.discoveries (dead write after cycle 83)'
    );
});

test('INITIAL_STATE: stats.discoveries 선언 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    // 이전엔 'discoveries: 0' 이 INITIAL_STATE.player.stats에 선언되어 있었음.
    // cycle 84에서 dead field로 정리. 다른 'discoveries' 잔존 reference 없는지도 확인.
    assert.doesNotMatch(
        source,
        /\bdiscoveries:\s*0/,
        'INITIAL_STATE should no longer declare stats.discoveries'
    );
});
