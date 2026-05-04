import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 126: EventPanel testid 노출 — cycle 125 AchievementPanel testid의 자매.
 *
 * 발견:
 * - EventPanel은 AI 이벤트 / fallback 이벤트의 핵심 의사결정 UI지만 testid 0건.
 * - smoke / e2e가 이벤트 선택지를 자동 클릭하려면 stable selector 필요.
 *
 * 추가 (cycle 18+ 명명 패턴 일관):
 * - data-testid="event-panel" — 패널 루트.
 * - data-testid={`event-choice-${idx}`} — 각 선택지 버튼.
 * - data-testid="event-dismiss" — choices 0건일 때 dismiss 버튼.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('EventPanel: event-panel root testid 노출', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.match(source, /data-testid\s*=\s*["']event-panel["']/);
});

test('EventPanel: dynamic event-choice-{idx} testid 노출', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.match(source, /data-testid\s*=\s*\{`event-choice-\$\{[^}]+\}`\}/);
});

test('EventPanel: event-dismiss testid 노출', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    assert.match(source, /data-testid\s*=\s*["']event-dismiss["']/);
});
