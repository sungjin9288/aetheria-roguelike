import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 437: EventPanel default `mobileFocused = false` redundant 정리
 *   (cycle 222-436 silent dead config 시리즈 196번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-434 패턴).
 *
 * 발견 (1 redundant default value):
 * - src/components/EventPanel.tsx:
 *     `({ currentEvent, actions, mobileFocused = false }: EventPanelProps) => { ... }`
 * - 호출 사이트 분석 (1곳, mobileFocused 명시 전달):
 *     ControlPanel.tsx:192: `<EventPanel currentEvent={currentEvent} actions={actions}
 *                            mobileFocused={mobileFocused} />`
 *   → 호출자 명시 → default false 도달 불가.
 *
 * 패턴 (cycle 222-436 시리즈 196번째):
 * - cycle 364-368/428-434: redundant default annotation 시리즈.
 * - cycle 437: EventPanel default mobileFocused — 동일 lens 회귀.
 *
 * 수정 (src/components/EventPanel.tsx):
 * - destructure에서 `mobileFocused = false` → `mobileFocused`.
 *
 * 회귀 가드:
 * - 1 호출자 명시 mobileFocused 전달 → 동작 그대로.
 * - currentEvent / actions 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 437: EventPanel mobileFocused cycle 489 cascade로 prop 자체 제거', async () => {
    // cycle 489가 EventPanel mobileFocused prop 자체를 cascade로 제거.
    // 이전 default 가드 → cascade 보존 가드로 약화.
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.ok(!/mobileFocused/.test(source), 'cycle 489 cascade로 mobileFocused 제거 보존');
});

test('cycle 437: ControlPanel <EventPanel> mobileFocused 전달 cascade 제거', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    const callMatch = source.match(/<EventPanel[^/]*\/>/);
    assert.ok(callMatch, 'EventPanel 호출 발견');
    assert.ok(!/mobileFocused/.test(callMatch[0]), 'cycle 489 cascade로 mobileFocused 전달 제거');
});

test('cycle 436 회귀 가드: getDailyDeals isDailyDeal 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnIdx = source.indexOf('export const getDailyDeals');
    const fnEnd = source.indexOf('export const getWeeklySpecial');
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/isDailyDeal:/.test(block), 'cycle 436 isDailyDeal 마커 0건 보존');
});
