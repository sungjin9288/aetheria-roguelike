import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 431: AvatarEquipmentOverlay default `layer = 'front'` redundant 정리
 *   (cycle 222-430 silent dead config 시리즈 190번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-429 패턴).
 *
 * 발견 (1 redundant default value):
 * - src/components/icons/AvatarEquipmentOverlay.tsx:
 *     `({ appearance, className = '', dataTestId = null, layer = 'front' }: any) => { ... }`
 * - 호출 사이트 분석 (2곳, layer 명시 전달):
 *     EquipmentAvatarPreview.tsx:47: `<AvatarEquipmentOverlay appearance={...} layer="back" />`
 *     EquipmentAvatarPreview.tsx:68: `<AvatarEquipmentOverlay appearance={...} layer="front" />`
 *   → 모든 호출자가 layer 명시 → default 'front'는 도달 불가.
 * - 다른 default(`className=''`, `dataTestId=null`)는 호출자에서 누락이라 도달
 *   가능 → 보존.
 *
 * 패턴 (cycle 222-430 시리즈 190번째):
 * - cycle 364-368 시리즈: redundant default annotation.
 * - cycle 428-429: RewardChips/QuestRewardChips default accent paired completion.
 * - cycle 431: AvatarEquipmentOverlay default layer — 동일 lens 회귀.
 *
 * 수정 (src/components/icons/AvatarEquipmentOverlay.tsx):
 * - destructure에서 `layer = 'front'` → `layer` (default 제거).
 *
 * 회귀 가드:
 * - 2 호출자 명시 layer 전달 → 동작 그대로.
 * - className/dataTestId default는 호출자 누락 path 활성이라 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 431: AvatarEquipmentOverlay destructure에서 default layer 값 제거", async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/layer = 'front'/.test(block),
        "AvatarEquipmentOverlay destructure default 제거됨");
    assert.ok(/\blayer\b/.test(block), 'layer 파라미터 보존');
});

test('cycle 431: 2 호출자 모두 layer 명시 전달 (정합성 가드)', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    const calls = source.match(/<AvatarEquipmentOverlay[^>]*\/?>/g) || [];
    assert.equal(calls.length, 2, 'EquipmentAvatarPreview에 2 호출');
    for (const call of calls) {
        assert.ok(/layer=/.test(call), `호출 "${call.slice(0, 60)}"에 layer 명시`);
    }
});

test('cycle 431: 보존 default — className / dataTestId (호출자 누락 path 활성)', async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/className = ''/.test(block), "className default '' 보존");
    assert.ok(/dataTestId = null/.test(block), 'dataTestId default null 보존');
});

test('cycle 429 회귀 가드: QuestRewardChips default accent 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const fnIdx = source.indexOf('const QuestRewardChips');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/accent = 'blue'/.test(block), 'cycle 429 default accent 제거 보존');
});
