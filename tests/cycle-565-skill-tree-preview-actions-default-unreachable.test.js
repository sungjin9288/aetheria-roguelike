import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 565: SkillTreePreview `actions = null` default unreachable
 *   (cycle 222-564 silent dead config 시리즈 305번째 — redundant default annotation
 *   청소 메가 시리즈 58번째). component prop default cleanup.
 *
 * 발견 (1 default unreachable):
 * - src/components/SkillTreePreview.tsx (line 120):
 *     const SkillTreePreview = ({ player, actions = null }: SkillTreePreviewProps) => {
 *         ...
 *     };
 * - 호출 사이트 (1 caller):
 *     · Dashboard.tsx:188 — <SkillTreePreview player={player} actions={actions} />
 *     · 다른 caller 0건 (test caller 0건).
 * - 결과: actions 항상 명시 전달. default null 도달 불가.
 *
 * 패턴 (cycle 222-564 시리즈 305번째):
 * - cycle 502-564: default 청소 메가 시리즈 63사이클.
 * - cycle 565: component prop default cleanup — cycle 499 PixelCharacter
 *   Avatar / cycle 533 RelicChoicePanel 등에 이은 동일 lens.
 *
 * 수정 (src/components/SkillTreePreview.tsx):
 * - signature에서 actions = null → actions.
 * - SkillTreePreviewProps interface 보존 (actions?: any).
 * - body의 actions 사용처 보존.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로.
 * - body actions 호출 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 565: SkillTreePreview signature에서 actions default 0건', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    const fnIdx = source.indexOf('const SkillTreePreview = ');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/actions\s*=\s*null/.test(sig),
        'SkillTreePreview actions default null 제거');
    assert.ok(/\bactions\b/.test(sig),
        'actions 파라미터 자체는 보존');
});

test('cycle 565: 정합성 가드 — Dashboard callsite 보존', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    assert.ok(/<SkillTreePreview player=\{player\} actions=\{actions\} \/>/.test(source),
        'Dashboard <SkillTreePreview> callsite 보존');
});

test('cycle 565: SkillTreePreviewProps interface 보존', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    assert.ok(/actions\?:\s*any/.test(source),
        'SkillTreePreviewProps actions?: any 보존');
});

test('cycle 565: cycle 502-564 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ap = await readSrc('src/utils/avatarEquipmentPreview.ts');
    assert.ok(!/const withVariant[^=]*overrides:\s*any\s*=\s*\{\}/.test(ap),
        'cycle 564 withVariant overrides default 0건');

    const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(!/useLegendaryDropDetector[^=]*dispatch:\s*any\s*=\s*null/.test(ld),
        'cycle 563 useLegendaryDropDetector dispatch default 0건');
});
