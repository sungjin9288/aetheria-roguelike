import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 271: 4 dead exports cleanup — getClassBuildIdentity / getClassBuildCompatibility /
 *   getClassBuildBonus / getRunDiagnostics
 *   (cycle 222-270 silent dead config 시리즈 42번째 — cleanup lens 연속, 큰 cleanup).
 *
 * 발견 (4 dead exports — 미완성 diagnostics 기능):
 * - src/utils/runProfile.ts에 4 함수 정의 + export:
 *   - getClassBuildIdentity (line 34): job → preferred build tags 매핑.
 *   - getClassBuildCompatibility (line 38): job + buildProfile → 적합도 라벨.
 *   - getClassBuildBonus (line 59): job + buildProfile → atk/def mult 보너스.
 *   - getRunDiagnostics (line 415): 50줄 함수, winRate / pacingLabel / recommendations 등 계산.
 * - 그러나 src/ 전체 검색에서 production code 호출 0건 — tests/ 외 어디에도 사용 안 함.
 * - getRunDiagnostics만 내부에서 다른 3 함수 호출. 즉, 4종 모두 dead 한 묶음 (incomplete
 *   diagnostics 기능, 시작했지만 UI 와이어 안 됨).
 *
 * 패턴 (cycle 222-270 silent dead config 시리즈 42번째):
 * - cycle 267: skillLabel 1 필드 cleanup.
 * - cycle 268: buildProfile.secondary 1 필드 cleanup.
 * - cycle 270: getEnemyTacticalProfile 12 필드 cleanup.
 * - cycle 271: 4 dead exports cleanup (가장 큰 단일 cleanup).
 *
 * 수정:
 * - src/utils/runProfile.ts: 4 dead exports 제거 (~70 lines).
 * - tests/run-profile-utils.test.js: 2 dead tests 제거 + import 정리.
 *
 * 회귀 가드:
 * - getRunBuildProfile / getTraitProfile / getEnemyTacticalProfile 등 active exports 유지.
 * - 다른 runProfile consumer (combatVictory / SmartInventory / ShopPanel 등) 변화 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 271: getClassBuildIdentity export 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getClassBuildIdentity/.test(source),
        'getClassBuildIdentity export 제거됨');
});

test('cycle 271: getClassBuildCompatibility export 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getClassBuildCompatibility/.test(source),
        'getClassBuildCompatibility export 제거됨');
});

test('cycle 271: getClassBuildBonus export 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getClassBuildBonus/.test(source),
        'getClassBuildBonus export 제거됨');
});

test('cycle 271: getRunDiagnostics export 제거', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/export const getRunDiagnostics/.test(source),
        'getRunDiagnostics export 제거됨');
});

test('cycle 271: active exports 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const activeExports = [
        'getRunBuildProfile',
        'getTraitProfile',
        'getTraitBonus',
        'getTraitSkill',
        'getTraitItemResonance',
        'getTraitFeaturedItems',
        'getTraitLootHint',
        'getTraitQuestResonance',
        'getEnemyTacticalProfile',
    ];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 271: 다른 consumer 변화 없음 (회귀 가드)', async () => {
    const sources = await Promise.all([
        readSrc('src/components/SmartInventory.tsx'),
        readSrc('src/components/ShopPanel.tsx'),
        readSrc('src/hooks/combatActions/combatVictory.ts'),
    ]);
    sources.forEach((src) => {
        // 이 컴포넌트들은 dead 함수들 호출 안 하므로 변화 없음.
        assert.ok(!/getRunDiagnostics|getClassBuildBonus|getClassBuildIdentity|getClassBuildCompatibility/.test(src),
            'consumer 컴포넌트는 dead 함수 호출 안 함 (회귀 가드)');
    });
});
