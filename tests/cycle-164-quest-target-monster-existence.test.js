import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';
import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 164: 퀘스트/업적 target → MONSTERS keys 정합성 가드.
 *
 * 발견:
 * - quests.ts의 target에 monsters.ts MONSTERS 객체에 없는 이름 10건 사용 중
 *   (가고일 / 고대 골렘 / 그림자 암살자 / 보물고 수호자 / 빙결 정령 /
 *    사막 도적 / 심해 대사 / 에테르 골렘 / 죽음의 기사 / 차원 보행자).
 * - 해당 퀘스트는 처치 진행도가 영원히 0 — target 이름이 실제 spawn enemy
 *   name과 매칭되지 않아 quest.progress 카운터 미증가.
 * - 사막 도적 vs 사막도적(공백 차이) 같은 텍스트 정합 누락 포함.
 *
 * 수정 (cycle 164 batch):
 * | 기존 missing target | → 교체 (실재 monsters.ts 키)        |
 * |---------------------|--------------------------------------|
 * | 사막 도적           | 사막도적                            |
 * | 가고일              | 유령 기사                           |
 * | 고대 골렘           | 황금 골렘                           |
 * | 그림자 암살자       | 다크 엘프                           |
 * | 보물고 수호자       | 황금 골렘                           |
 * | 빙결 정령           | 서리 정령                           |
 * | 심해 대사           | 심연의 파수꾼                        |
 * | 에테르 골렘         | 에테르 거인                          |
 * | 죽음의 기사         | 타락 기사                           |
 * | 차원 보행자         | 차원 보병                           |
 *
 * 가드 (cycle 141 reward.item / cycle 148 relic.effect baseline pattern 재사용):
 * 1. 비-system target(Korean monster name)이 모두 MONSTERS keys에 존재.
 * 2. baseline 0 lock — 새 quest 추가 시 target typo 즉시 detect.
 */

// 시스템 stats (몬스터가 아닌 진행도 키)
const SYSTEM_TARGETS = new Set([
    'Level', 'level',
    'abyssRecord', 'bossKills', 'bountiesCompleted', 'crafts',
    'deaths', 'demonKingSlain', 'discoveries', 'discoveryChains',
    'escapes', 'explores', 'kills', 'lowHpWins', 'maxKillStreak',
    'prestige', 'relicCount', 'rests', 'signatureSetsCompleted',
    'signaturesDiscovered', 'synths', 'total_gold',
    // 빌드 프로파일 / 직업 태그
    'arcane', 'crusher', 'dual', 'fortress',
]);

const collectMissingTargets = (entries, monsterKeys) => {
    const missing = [];
    for (const e of entries) {
        const t = e?.target;
        if (typeof t !== 'string') continue;
        if (SYSTEM_TARGETS.has(t)) continue;
        if (!monsterKeys.has(t)) missing.push({ id: e.id, target: t });
    }
    return missing;
};

test('quest/achievement target → MONSTERS keys 정합성: missing 0건 lock', () => {
    const monsterKeys = new Set(Object.keys(MONSTERS));
    const missing = [
        ...collectMissingTargets(QUESTS, monsterKeys),
        ...collectMissingTargets(ACHIEVEMENTS, monsterKeys),
    ];
    assert.deepEqual(missing, [],
        `dead targets (no matching monster name in MONSTERS):\n  ${missing.map(m => `id=${m.id} target='${m.target}'`).join('\n  ')}`);
});

test('SYSTEM_TARGETS 정합: 시스템 키가 quest target에서 실제로 사용됨 (whitelist 회귀 가드)', () => {
    const allTargets = new Set();
    for (const q of QUESTS) if (typeof q.target === 'string') allTargets.add(q.target);
    for (const a of ACHIEVEMENTS) if (typeof a.target === 'string') allTargets.add(a.target);

    const unusedSystemTargets = [...SYSTEM_TARGETS].filter((t) => !allTargets.has(t));
    // unused system target이 있을 수 있음 (코드 외부 사용) — 가드는 너무 엄격하지 않게
    // 다만 "예상치 못한 unused"가 너무 많으면 의심해야 함. 절반 미만 허용.
    assert.ok(unusedSystemTargets.length < SYSTEM_TARGETS.size / 2,
        `너무 많은 SYSTEM_TARGETS가 미사용 — whitelist 정리 필요? unused=${unusedSystemTargets.length}/${SYSTEM_TARGETS.size}`);
});
