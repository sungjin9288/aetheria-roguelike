import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 471: Dashboard `desktopArchiveCompact = false` const + 10 callsite
 *   `compact={desktopArchiveCompact}` attribute unreachable 정리
 *   (cycle 222-470 silent dead config 시리즈 224번째 — unreachable / redundant
 *   default attr cleanup lens, cycle 452/457 통합 변형).
 *
 * 발견 (1 dead const + 10 redundant attribute):
 * - src/components/Dashboard.tsx (line 147):
 *     const desktopArchiveCompact = false;
 * - 사용 분석: 10곳 callsite에서 `compact={desktopArchiveCompact}`로 전달.
 *     · SmartInventory / EquipmentPanel / QuestTab / AchievementPanel /
 *       SkillTreePreview / MapNavigator / BuildAdvicePanel / StatsPanel /
 *       GravePanel / SystemTab.
 * - 타깃 컴포넌트 분석:
 *     · cycle 452가 6 panel(BuildAdvice/Achievement/Stats/Equipment/MapNavigator/
 *       SmartInventory)에서 `compact = false` 기본값 제거. 이 panel들은
 *       compact prop을 직접 destructure하지만 default 없음 → undefined 수용 가능.
 *     · 다른 4 panel (QuestTab/SkillTreePreview/GravePanel/SystemTab)도 `compact`
 *       prop을 받지만 caller가 `false`만 전달이라 undefined 수용 가능.
 * - 결과:
 *     · const는 reassign 0건의 unchanging false → dead config flag.
 *     · 10 callsite의 `compact={desktopArchiveCompact}` 전달은 false → 각 panel의
 *       compact가 undefined가 되어도 `compact ? X : Y` ternary는 Y 가지로 동일.
 *
 * 패턴 (cycle 222-470 시리즈 224번째):
 * - cycle 452: Dashboard 6 panel default `compact = false` 일괄 정리.
 * - cycle 457: ControlPanel <CombatPanel compact={false} dense={false}> 명시
 *   redundant attr 정리.
 * - cycle 471: Dashboard 10 callsite `compact={desktopArchiveCompact}` 명시
 *   redundant attr + dead const 통합 정리. cycle 452+457 lens 결합.
 *
 * 수정 (src/components/Dashboard.tsx):
 * - line 147 `const desktopArchiveCompact = false;` 제거.
 * - 10 callsite에서 `compact={desktopArchiveCompact}` attr 제거.
 *
 * 회귀 가드:
 * - 다른 props (player/actions/stats/runtime/quickSlots 등) 보존.
 * - 각 panel의 compact ternary는 undefined일 때도 동일하게 false 가지 선택.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 471: desktopArchiveCompact const 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    assert.ok(!/const\s+desktopArchiveCompact\s*=/.test(source),
        'desktopArchiveCompact const 선언 0건');
    assert.ok(!/desktopArchiveCompact/.test(source),
        'desktopArchiveCompact 식별자 0건 (선언 + 참조)');
});

test('cycle 471: 정합성 가드 — Dashboard 핵심 props 보존', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    // 주요 자식 컴포넌트 호출이 그대로 있는지 (다른 props 보존 확인)
    assert.ok(/<SmartInventory[\s\S]*?player=\{player\}/.test(source), 'SmartInventory player prop 보존');
    assert.ok(/<EquipmentPanel[\s\S]*?player=\{player\}/.test(source), 'EquipmentPanel player prop 보존');
    assert.ok(/<SystemTab[\s\S]*?runtime=\{runtime\}/.test(source), 'SystemTab runtime prop 보존');
});

test('cycle 471: cycle 452 회귀 가드 — 6 panel default compact 0건', async () => {
    // cycle 452가 정리한 6 panel default가 보존되어 있는지
    const equipmentPanel = await readSrc('src/components/EquipmentPanel.tsx');
    const equipFnIdx = equipmentPanel.indexOf('const EquipmentPanel =');
    const equipFnEnd = equipmentPanel.indexOf('=>', equipFnIdx);
    assert.ok(!/compact = false/.test(equipmentPanel.slice(equipFnIdx, equipFnEnd)),
        'cycle 452 EquipmentPanel default compact 제거 보존');
});
