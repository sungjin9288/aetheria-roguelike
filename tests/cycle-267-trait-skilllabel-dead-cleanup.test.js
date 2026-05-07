import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 267: getTraitProfile의 skillLabel 필드 dead config 정리
 *   (cycle 222-266 silent dead config 시리즈 38번째 — cleanup lens).
 *
 * 발견 (dead config 단순 cleanup):
 * - src/utils/runProfile.ts getTraitProfile (line 250)이 `skillLabel` 필드 계산:
 *   `skill ? '${skill.name} · MP ${skill.mp}' : '특수 스킬 없음'`.
 * - 그러나 src/ 어디에도 `skillLabel` consume 안 됨 — 검색 결과 정의 1건뿐.
 * - BuildAdvicePanel.tsx (line 95-96)는 trait.skill.name / .mp / .cooldown을 직접 사용
 *   (cooldown까지 포함된 더 풍부한 표시 — skillLabel은 cooldown 없음).
 * - StatsPanel.tsx도 trait.skill 직접 접근.
 * - 결과: skillLabel 계산 로직과 fallback 텍스트('특수 스킬 없음') 모두 dead — 메모리/CPU 낭비.
 *
 * 패턴 (cycle 222-266 silent dead config 시리즈 38번째):
 * - 이전 사이클들은 dispatch 누락 fix 위주.
 * - cycle 267: 반대 방향 — 정의되었지만 dispatch 0건인 dead 필드 제거.
 *
 * 수정 (src/utils/runProfile.ts getTraitProfile):
 * - skillLabel 필드 제거.
 *
 * 회귀 가드:
 * - getTraitProfile 다른 필드 (skill, bonus, reasons 등) 동작 유지.
 * - BuildAdvicePanel / StatsPanel display 변화 없음 (trait.skill 직접 접근).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 267: getTraitProfile의 skillLabel 필드 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    // 필드 정의 라인 (`skillLabel:` colon)만 검색 — 주석에 단어 언급은 허용.
    assert.ok(!/^\s*skillLabel:/m.test(source),
        'skillLabel 필드 정의 제거됨 (dead config cleanup)');
});

test('cycle 267: getTraitProfile의 skill / bonus / reasons 필드 유지 (회귀 가드)', async () => {
    const { getTraitProfile } = await import('../src/utils/runProfile.js');
    const player = {
        name: 'Test', job: '전사', level: 30,
        hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
        atk: 50, def: 20,
        equip: {}, relics: [], skillChoices: {}, titles: [],
        stats: { kills: 10, bossKills: 1 },
    };
    const profile = getTraitProfile(player, { maxHp: 1000 });
    assert.ok(profile, 'getTraitProfile 정상 반환');
    assert.ok(profile.bonus, 'bonus 필드 유지');
    assert.ok(Array.isArray(profile.reasons), 'reasons 필드 유지');
    // skill은 null일 수 있음 (특정 trait는 미정의).
    assert.ok(profile.skill !== undefined, 'skill 필드 유지 (null 허용)');
});

test('cycle 267: BuildAdvicePanel은 trait.skill 직접 접근 (회귀 가드)', async () => {
    const source = await readSrc('src/components/BuildAdvicePanel.tsx');
    assert.ok(/trait\.skill\.name/.test(source), 'trait.skill.name 직접 접근 유지');
    assert.ok(/trait\.skill\.mp/.test(source), 'trait.skill.mp 직접 접근 유지');
    assert.ok(/trait\.skill\.cooldown/.test(source), 'trait.skill.cooldown 직접 접근 유지');
});

test('cycle 267: skillLabel 컴포넌트 consume 0건 (회귀 가드)', async () => {
    const sources = await Promise.all([
        readSrc('src/components/BuildAdvicePanel.tsx'),
        readSrc('src/components/StatsPanel.tsx'),
    ]);
    sources.forEach((src, i) => {
        assert.ok(!/skillLabel/.test(src),
            `[component ${i}] skillLabel 참조 0건 (dead cleanup 후)`);
    });
});
