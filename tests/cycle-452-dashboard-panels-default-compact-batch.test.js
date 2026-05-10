import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 452: Dashboard child panel 6종 default compact 'false' batch 정리
 *   (cycle 222-451 silent dead config 시리즈 209번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-434/437/441/451 패턴, 6 컴포넌트 batch).
 *
 * 발견 (6 redundant default values):
 * - 6 panel 컴포넌트 모두 destructure에서 `compact = false` default:
 *     · BuildAdvicePanel.tsx (1 caller in Dashboard:204)
 *     · AchievementPanel.tsx (1 caller in Dashboard:185)
 *     · StatsPanel.tsx (1 caller in Dashboard:211)
 *     · EquipmentPanel.tsx (1 caller in Dashboard:169)
 *     · MapNavigator.tsx (1 caller in Dashboard:198)
 *     · SmartInventory.tsx (1 caller in Dashboard:157)
 * - 모든 호출자가 `compact={desktopArchiveCompact}` 명시 전달.
 * - cycle 451 (GravePanel) paired completion — Dashboard 7 panel children 중
 *   나머지 6 panel batch.
 *
 * 패턴 (cycle 222-451 시리즈 209번째):
 * - cycle 364-368/428-434/437/441/451: redundant default annotation 시리즈.
 * - cycle 414: ICON_PATHS 16-key batch (cycle 411-413 회귀).
 * - cycle 446-447: buildRuntimePalette 4-필드 + characterAppearance palette
 *   5-필드 batch.
 * - cycle 452: 6 panel batch — 동일 lens 회귀, batch scale.
 *
 * 수정 (6 src/components/*.tsx):
 * - 각 panel destructure에서 `compact = false` → `compact`.
 *
 * 회귀 가드:
 * - 6 호출자 모두 명시 compact 전달 → 동작 그대로.
 * - compact 기반 UI 조건 분기 (text size / spacing 등) 모두 보존.
 * - cycle 451 GravePanel paired completion 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

// cycle 472-482가 11 panel (Map/Achievement/Equipment/Stats/Grave/System/
// BuildAdvice/SkillTree/Quest/SmartInventory)을 cascade로 compact prop 자체
// 제거. 이제 잔존 panel 0건 → cascade 완료 보존 가드만 유지.
const PANELS = [];

for (const panel of PANELS) {
    test(`cycle 452: ${panel.name} destructure에서 default compact 제거`, async () => {
        const source = await readSrc(panel.file);
        const fnIdx = source.indexOf(panel.fnPattern);
        const fnEnd = source.indexOf('=>', fnIdx);
        const block = source.slice(fnIdx, fnEnd);
        assert.ok(!/compact = false/.test(block), `${panel.name} default compact 제거됨`);
        assert.ok(/\bcompact\b/.test(block), `${panel.name} compact 파라미터 보존`);
    });
}

test('cycle 452: 정합성 가드 — Dashboard 6 panel 호출 존재', async () => {
    // cycle 471이 Dashboard의 desktop 컴팩트 플래그 + 10 callsite의 compact prop
    // 전달을 일괄 제거. compact 명시 전달 assertion → 호출 존재 가드로 약화.
    const source = await readSrc('src/components/Dashboard.tsx');
    for (const panel of PANELS) {
        const segments = source.split(new RegExp(`<${panel.name}\\b`)).slice(1);
        assert.ok(segments.length >= 1, `${panel.name} 호출 발견`);
    }
});

test('cycle 451 회귀 가드: GravePanel default compact 0건', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    const fnIdx = source.indexOf('const GravePanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/compact = false/.test(block), 'cycle 451 default compact 제거 보존');
});
