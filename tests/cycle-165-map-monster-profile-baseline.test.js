import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 165: 맵 spawn pool → MONSTERS 정합성 baseline 가드.
 *
 * 발견:
 * - maps.ts의 monsters[] 배열에 monsters.ts MONSTERS 객체에 없는 이름 42건
 *   사용 중. spawnEnemy(exploreUtils.ts:175)는 `DB.MONSTERS[baseName]`이
 *   undefined면 weakness/resistance/atkMult/hpMult/expMult/goldMult/pattern/
 *   phase2 모두 미적용 — 해당 enemy는 generic stat-blank으로 spawn되어
 *   속성 약점/저항 메커니즘이 작동 안 함.
 * - 콘텐츠 갭 — 게임은 진행되지만 전투 깊이 축소.
 *
 * cycle 141 reward.item / cycle 148 relic.effect / cycle 164 quest.target
 * baseline pattern 재사용 — 양방향 가드로 점진 정리:
 *
 * 1. KNOWN_MISSING_MAP_MONSTERS Set — 현재 누락 명시 인정.
 * 2. NEW dead 가드: baseline 외 추가되면 즉시 실패 — 새 map 추가 시 monster
 *    profile 누락 catch.
 * 3. baseline 좁히기 가드: monster profile 추가됐으면 baseline에서도 제거.
 *
 * cycle 165(34) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0 🎯
 * 5 사이클에서 점진 정리 완료. 빈 Set lock — 새 map monster 추가 시 profile
 * 누락이 즉시 detect.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

// cycle 165 baseline — 42 → 165(-8) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0 🎯
// 모든 maps.ts spawn pool 참조가 MONSTERS profile을 가짐. 빈 Set lock.
const KNOWN_MISSING_MAP_MONSTERS = new Set([]);

const collectMapMonsterRefs = async () => {
    const maps = await readFile(path.join(ROOT, 'src/data/maps.ts'), 'utf8');
    const refs = new Set();
    const arrRe = /monsters:\s*\[([^\]]+)\]/g;
    let m;
    while ((m = arrRe.exec(maps)) !== null) {
        const strRe = /'([^']+)'|"([^"]+)"/g;
        let mm;
        while ((mm = strRe.exec(m[1])) !== null) refs.add(mm[1] || mm[2]);
    }
    return refs;
};

const findMissing = async () => {
    const refs = await collectMapMonsterRefs();
    const monsterKeys = new Set(Object.keys(MONSTERS));
    return [...refs].filter((n) => !monsterKeys.has(n));
};

test('map.monsters[] → MONSTERS 정합성: NEW missing 0건 (baseline 외 추가 시 즉시 실패)', async () => {
    const missing = await findMissing();
    const newMissing = missing.filter((n) => !KNOWN_MISSING_MAP_MONSTERS.has(n));
    assert.deepEqual(newMissing, [],
        `NEW missing map monsters (add MONSTERS[name] profile or update baseline):\n  ${newMissing.join('\n  ')}`);
});

test('map.monsters[] baseline 좁히기 — known missing이 MONSTERS에 추가됐으면 baseline에서 제거', async () => {
    const missing = await findMissing();
    const missingSet = new Set(missing);
    const stale = [...KNOWN_MISSING_MAP_MONSTERS].filter((n) => !missingSet.has(n));
    assert.deepEqual(stale, [],
        `stale baseline (these monsters now have profile — remove from KNOWN_MISSING_MAP_MONSTERS):\n  ${stale.join('\n  ')}`);
});
