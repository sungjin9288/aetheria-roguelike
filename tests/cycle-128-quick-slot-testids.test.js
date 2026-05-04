import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 128: QuickSlot testid 노출 — cycle 125-127 testid sweep 연장.
 *
 * QuickSlot은 모바일 게임 핵심 UX의 한 축 — 전투/탐험 중 빠른 회복/버프 아이템
 * 사용 슬롯 (1~3번 키 매핑). e2e가 quick slot 사용 / 할당 흐름을 자동화하려면
 * stable selector 필수.
 *
 * 추가 (cycle 18+ 명명 패턴 일관):
 * - data-testid={`quick-slot-${i}`} — QuickSlot 사용 버튼 (3개).
 * - data-testid={`quick-slot-assign-${i}`} — QuickSlotAssigner 할당 버튼.
 * - data-testid="quick-slot-unassign" — 할당 해제 버튼.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('QuickSlot: dynamic quick-slot-{i} testid 노출 (사용 버튼)', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    assert.match(source, /data-testid\s*=\s*\{`quick-slot-\$\{[^}]+\}`\}/);
});

test('QuickSlotAssigner: dynamic quick-slot-assign-{i} testid 노출', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    assert.match(source, /data-testid\s*=\s*\{`quick-slot-assign-\$\{[^}]+\}`\}/);
});

test('QuickSlot: quick-slot-unassign testid 노출', async () => {
    const source = await readSrc('src/components/QuickSlot.tsx');
    assert.match(source, /data-testid\s*=\s*["']quick-slot-unassign["']/);
});
