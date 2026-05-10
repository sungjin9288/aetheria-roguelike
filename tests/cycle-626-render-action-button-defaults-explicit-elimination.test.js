import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 626: renderActionButton extraClass '' / outer {} explicit
 *   default-elimination paired batch
 *   (cycle 222-625 silent dead config 시리즈 364번째 — explicit
 *   default-elimination pattern 17번째 적용, paired batch 3번째 (cycle
 *   613/624 paired에 이은)).
 *
 * 발견 (2 defaults reachable → unreachable conversion):
 * - src/components/ControlPanel.tsx:76:
 *     const renderActionButton = (button: any, extraClass: any = '', { hideLabel = false }: any = {}) => {...}
 * - 호출 사이트 3개 모두 1 arg 전달 → 두 outer defaults 활성:
 *     · ControlPanel.tsx:284 — renderActionButton(button) (coreButtons map).
 *     · ControlPanel.tsx:285 — renderActionButton(button) (safeZoneButtons map).
 *     · ControlPanel.tsx:286 — renderActionButton(button) (auxiliaryButtons map).
 * - 3 callsite 모두 1 arg 전달이라 extraClass '' / outer {} default 활성.
 * - inner destructure default `hideLabel = false`는 별개 (caller가 {} 명시
 *   해도 그대로 기본값 적용). 보존.
 *
 * 패턴 (cycle 222-625 시리즈 364번째):
 * - cycle 502-625: default 청소 메가 시리즈 121사이클.
 * - cycle 626: explicit default-elimination 17번째.
 *   paired batch 3번째 (cycle 613 getTraitProfile/getTraitSkill, cycle 624
 *   handleVictory passiveBonus/liveConfig에 이은). 1 cycle에 2 outer default
 *   동시 정리 + inner destructure default 보존.
 *
 * 수정:
 * - ControlPanel.tsx:284/285/286 — 3 callsite 모두 (button, '', {}) 명시.
 * - ControlPanel.tsx:76 — extraClass '' / outer {} defaults 제거 (inner
 *   `hideLabel = false`는 보존).
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body className `${extraClass}` / `hideLabel ?` 처리 보존.
 * - inner destructure default 보존 (caller {} 시 hideLabel false 적용).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 626: renderActionButton signature outer defaults 0건", async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(source),
        "renderActionButton extraClass default '' 제거");
    assert.ok(!/const renderActionButton = \([^)]*\}:\s*any\s*=\s*\{\}/.test(source),
        'renderActionButton 3rd 파라미터 outer default {} 제거');
});

test('cycle 626: renderActionButton signature 파라미터 보존 (default 없이)', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/const renderActionButton = \(button: any, extraClass: any, \{ hideLabel = false \}: any\)/.test(source),
        'renderActionButton 3-arg 시그니처 보존 (outer defaults 없이, inner hideLabel = false 보존)');
});

test("cycle 626: 3 callsite 명시 추가 (button, '', {})", async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const matches = (source.match(/renderActionButton\(button,\s*'',\s*\{\}\)/g) || []).length;
    assert.equal(matches, 3, '3 callsite 모두 명시 (button, \'\', {})');
});

test('cycle 626: body extraClass / hideLabel 처리 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(/\$\{extraClass\}/.test(source),
        'className `${extraClass}` 보존');
    assert.ok(/hideLabel \?/.test(source),
        'hideLabel ? 분기 보존');
});

test('cycle 626: cycle 502-625 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(ai),
        "cycle 625 generateStory uid default 0건");
    const ce = await readSrc('src/systems/CombatEngine.ts');
    assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(ce),
        'cycle 624 handleVictory passiveBonus default 0건');
});
