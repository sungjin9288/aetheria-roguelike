import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 398: DashboardMobileSummary `trait.label` silent gate fix
 *   (cycle 222-397 silent dead config 시리즈 161번째 — silent dispatch lens 회귀).
 *
 * 발견 (1 silent gate + dispatch):
 * - src/components/DashboardMobileSummary.tsx line 36-38:
 *   `const trait = getTraitProfile(player);
 *    if (trait?.label) {
 *        pills.push({ key: 'trait', label: trait.label, tone: 'recommended' });
 *    }`
 * - getTraitProfile은 TRAIT_DEFINITIONS entry spread 후 반환 — 구조:
 *   `{ id, name, title, accent, chipClass, desc, passiveLabel, unlockHint,
 *     rewardFocus, questFocus, bossDirective, bonus, skill }`. **`label` 필드 없음**.
 * - 결과: `trait?.label`은 항상 undefined → 가드 false → trait pill 영원히 미표시.
 * - cycle 396 (StatsPanel syn.name silent UI 결손)과 동일 패턴 — schema 미스매치로
 *   silent UI 결손.
 *
 * 패턴 (cycle 222-397 시리즈 161번째):
 * - cycle 396: StatsPanel `syn.name` → `syn.label` schema 미스매치 fix.
 * - cycle 398: DashboardMobileSummary `trait.label` → `trait.title` schema 미스매치 fix.
 *   동일 silent dispatch lens 연속 회귀.
 *
 * 수정 (src/components/DashboardMobileSummary.tsx):
 * - `trait.label` → `trait.title` (가드 + dispatch 양쪽).
 *
 * 회귀 가드:
 * - getTraitProfile 동작 / TRAIT_DEFINITIONS schema 보존.
 * - DashboardMobileSummary trait pill이 trait.title (e.g. '유연한 방랑자') 표시.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 398: DashboardMobileSummary trait.label 0건 (silent undefined 제거)', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.tsx');
    assert.ok(!/trait\?\.label|trait\.label/.test(source),
        'trait.label / trait?.label 0건');
});

test('cycle 398: DashboardMobileSummary trait.title 사용 (fix 검증)', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.tsx');
    assert.ok(/trait\?\.title/.test(source) || /trait\.title/.test(source),
        'trait.title로 변경됨');
});

test('cycle 398: TRAIT_DEFINITIONS schema 보존 — title 필드 producer', async () => {
    const { TRAIT_DEFINITIONS } = await import('../src/data/traits.js');
    for (const [id, def] of Object.entries(TRAIT_DEFINITIONS)) {
        assert.ok(typeof def.title === 'string', `${id} title string`);
        assert.equal(def.label, undefined, `${id} label 미정의 (schema 정합성)`);
    }
});

test('cycle 398: getTraitProfile.title 동작 검증 (전 직업 fallback)', async () => {
    const { getTraitProfile } = await import('../src/utils/runProfile.js');
    // 모험가 기본 → 'balanced' trait
    const player = {
        name: 'test', job: '모험가', equip: {}, relics: [], stats: {},
    };
    const trait = getTraitProfile(player);
    assert.ok(typeof trait.title === 'string', 'trait.title string');
    assert.equal(trait.label, undefined, 'trait.label은 미정의');
});

test('cycle 397 회귀 가드: THEME_BY_TARGET abyssFloor 0건', async () => {
    const source = await readSrc('src/components/AchievementPanel.tsx');
    const blockStart = source.indexOf('const THEME_BY_TARGET');
    const blockEnd = source.indexOf('};', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/abyssFloor:/.test(block),
        'cycle 397 abyssFloor 0건 보존');
});
