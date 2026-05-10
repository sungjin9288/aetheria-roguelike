import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 399: QuickSlotProps `onAssign` / `onUnassign` dead props 정리
 *   (cycle 222-398 silent dead config 시리즈 162번째 — interface dead lens 변형).
 *
 * 발견 (2 dead 인터페이스 필드 + 2 doc 코멘트):
 * - src/components/QuickSlot.tsx QuickSlotProps interface:
 *   `onAssign?: (slotIdx: number, item: any) => void;`
 *   `onUnassign?: (slotIdx: number) => void;`
 * - QuickSlot 본체 destructure 라인은 `{ slots, onUse, gameState, dense }`만 사용 —
 *   onAssign/onUnassign 본체 사용 0건.
 * - 유일 consumer (TerminalView.tsx:336)는 `slots/onUse/gameState`만 prop pass —
 *   onAssign/onUnassign 외부에서 pass 0건.
 * - 같은 파일의 QuickSlotAssigner는 별개 컴포넌트(props: any)로 onAssign 사용.
 *   QuickSlotProps와 무관.
 * - JSDoc 코멘트 line 10-11도 onAssign/onUnassign 시그니처 명시 — 동시 정리.
 *
 * 패턴 (cycle 222-398 시리즈 162번째):
 * - cycle 270/278/279/333/336/352/353/354: 함수 출력 dead 필드 정리.
 * - cycle 391: DEFAULT_COMBAT_FLAGS export → private downgrade.
 * - cycle 399: QuickSlotProps interface dead props (interface dead 변형 — props 정의는
 *   있으나 본체 destructure / 외부 pass 모두 0건).
 *
 * 수정 (src/components/QuickSlot.tsx):
 * - QuickSlotProps에서 onAssign / onUnassign 2 필드 제거.
 * - JSDoc 코멘트 line 10-11 onAssign / onUnassign 라인 제거.
 *
 * 회귀 가드:
 * - QuickSlotProps의 slots / onUse / onAssign / gameState / dense — 활성 필드 유지.
 * - QuickSlotAssigner (별개 컴포넌트) onAssign 동작 보존.
 * - TerminalView QuickSlot prop pass (slots/onUse/gameState) 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 399: QuickSlotProps에서 onAssign / onUnassign 0건', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    const ifaceStart = source.indexOf('interface QuickSlotProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/onAssign\?:/.test(ifaceBlock),
        'QuickSlotProps에서 onAssign 0건');
    assert.ok(!/onUnassign\?:/.test(ifaceBlock),
        'QuickSlotProps에서 onUnassign 0건');
});

test('cycle 399: QuickSlotProps 활성 필드 보존 (cycle 494가 dense cascade로 정리)', async () => {
    // cycle 494가 dense prop cascade로 정리. 잔존 활성 필드만 가드.
    const source = await readSrc('src/components/QuickSlot.tsx');
    const ifaceStart = source.indexOf('interface QuickSlotProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    const activeFields = ['slots', 'onUse', 'gameState'];
    for (const field of activeFields) {
        const re = new RegExp(`${field}\\?:`);
        assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
    }
});

test('cycle 399: QuickSlotAssigner onAssign 동작 보존', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    assert.ok(/QuickSlotAssigner.*\bonAssign\b/.test(source),
        'QuickSlotAssigner onAssign prop 사용 보존');
});

test('cycle 398 회귀 가드: trait.label silent gate fix 보존', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.tsx');
    assert.ok(!/trait\?\.label|trait\.label/.test(source),
        'cycle 398 trait.label 0건 보존');
    assert.ok(/trait\?\.title|trait\.title/.test(source),
        'cycle 398 trait.title 보존');
});
