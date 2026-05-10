import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 456: ControlPanel `renderResetControl` 3 default annotation redundant 정리
 *   (cycle 486 cascade로 helper 자체 제거됨 — 보존 가드로 약화).
 *
 * cycle 486 paired completion: ControlPanel mobileFocused cascade가 두
 * `!mobileFocused && renderResetControl(...)` callsite를 unreachable로 만들고
 * helper 자체를 제거했으므로, 이 테스트는 cascade 보존 가드만 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 456: renderResetControl helper cycle 486 cascade로 제거 보존', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(!/renderResetControl/.test(source), 'cycle 486 cascade로 helper 제거 보존');
});
