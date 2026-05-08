import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 367: maps.ts boss: false 4회 redundant 정리
 *   (cycle 222-366 silent dead config 시리즈 133번째 — cleanup lens 연속).
 *
 * 발견 (4 redundant default annotations):
 * - src/data/maps.ts에 4 맵이 `boss: false` 명시.
 * - 모든 boss 사용 사이트(`if (mapData.boss)`, `map?.boss ? ...`,
 *   `Boolean(mapData.boss)`, `typeof mapData.boss === 'string'`)가 falsy 체크.
 * - boss 필드 부재 = falsy = boss: false 효과 동일이라 명시 redundant.
 * - boss 값으로 보스 이름(string)을 가지는 맵 또는 boss: true(boolean)로
 *   추상 보스 표시하는 맵만 의미 있음. boss: false는 그냥 noise.
 *
 * 패턴 (cycle 222-366 silent dead config 시리즈 133번째):
 * - cycle 366: monster phase threshold default 7 redundant.
 * - cycle 367: maps boss: false 4 redundant.
 *
 * 수정 (src/data/maps.ts):
 * - 4 곳의 `boss: false,` (또는 `, boss: false`) 명시 제거.
 *
 * 회귀 가드:
 * - boss 필드가 string인 맵 (e.g. '고대 호수의 수호신') 보존.
 * - boss: true 명시 맵 보존 (추상 표시 — bossMonsters 분기 트리거).
 * - mapSignatureHints / explorationPacing / questOperations 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 367: maps.ts boss: false 0건', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/boss: false/g) || [];
    assert.equal(matches.length, 0,
        `maps.ts에서 boss: false 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 367: 활성 boss 필드 보존 (string + true)', async () => {
    const source = await readSrc('src/data/maps.ts');
    const stringBossMatches = source.match(/boss: '[^']+'/g) || [];
    const trueBossMatches = source.match(/boss: true/g) || [];
    assert.ok(stringBossMatches.length > 0,
        `boss string 필드 보존 (${stringBossMatches.length}건)`);
    assert.ok(trueBossMatches.length > 0,
        `boss true 필드 보존 (${trueBossMatches.length}건)`);
});

test('cycle 367: MAPS 동작 보존 (모든 맵 객체 정상)', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    const mapNames = Object.keys(MAPS);
    assert.ok(mapNames.length >= 30, `30+ 맵 보존 (${mapNames.length})`);
    for (const name of mapNames) {
        const m = MAPS[name];
        assert.ok(m, `${name} 맵 정의 존재`);
        // boss가 false였던 맵들은 이제 undefined여야 함
        if (m.boss === false) {
            assert.fail(`${name} 맵에 boss: false 잔존 (제거 누락)`);
        }
    }
});

test('cycle 366 회귀 가드: monster phase threshold 0.5/0.25 redundant 0건 보존', async () => {
    const source = await readSrc('src/data/monsters.ts');
    const phase2WithThreshold = source.match(/phase2:[^}]+threshold:/g) || [];
    const phase3WithThreshold025 = source.match(/phase3:[^}]+threshold: 0\.25/g) || [];
    assert.equal(phase2WithThreshold.length, 0, 'cycle 366 phase2 threshold 0건 보존');
    assert.equal(phase3WithThreshold025.length, 0, 'cycle 366 phase3 threshold 0.25 0건 보존');
});
