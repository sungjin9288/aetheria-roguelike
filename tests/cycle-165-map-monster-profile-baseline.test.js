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
 * 1. KNOWN_MISSING_MAP_MONSTERS Set (42종) — 현재 누락 명시 인정.
 * 2. NEW dead 가드: baseline 외 추가되면 즉시 실패 — 새 map 추가 시 monster
 *    profile 누락 catch.
 * 3. baseline 좁히기 가드: monster profile 추가됐으면 baseline에서도 제거.
 *
 * 향후 사이클에서 MONSTERS에 profile 추가할 때마다 KNOWN_MISSING_MAP_MONSTERS
 * Set이 줄어들어 0이 될 때까지 진행도 추적.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

// cycle 165 baseline — 42종 누락에서 화염/얼음 테마 8종 같은 사이클에서 추가 (-8).
// 잔존 34종은 향후 사이클에서 monster profile 점진 추가.
const KNOWN_MISSING_MAP_MONSTERS = new Set([
    '공허 감시병', '공허 마법사', '공허의 파편', '광풍의 원소',
    '꽃 골렘', '꽃잎 슬라임', '뇌운 와이번', '동굴 박쥐',
    // '마그마 슬라임', ← cycle 165: 화염 테마 batch.
    '망자의 사제', '묘지 구울', '바람 추적자',
    '번개 정령', '봄의 정령', '붕괴한 수호자', '생체 병기',
    // '서리 골렘', ← cycle 165: 얼음 테마 batch.
    // '서리 마법사', ← cycle 165: 얼음 테마 batch.
    '실험실 수호자', '심연의 눈',
    // '얼음 기사', ← cycle 165: 얼음 테마 batch.
    '에테르 잔류체', '에테르 흡수체', '오염된 연구원',
    // '용암 거북', ← cycle 165: 화염 테마 batch.
    '유령 군단', '저주받은 기사', '정원 요정',
    '종말의 마법사', '종말의 전령', '차원 방랑자', '최후의 수호자',
    '타락한 용사', '파멸의 기사', '폭주 자동인형', '폭풍 그리핀',
    '해골 마법사', '허무 집행관', '혼돈의 추종자',
    // '화산 정령', ← cycle 165: 화염 테마 batch.
    // '화산재 골렘', ← cycle 165: 화염 테마 batch.
    // '화염 비룡', ← cycle 165: 화염 테마 batch.
]);

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
