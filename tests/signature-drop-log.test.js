import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Signature 아이템 획득 시 Terminal에 전용 legendary 로그가 출력되는
 * 전체 흐름을 텍스트 기반 가드로 고정 (runtime 임포트는 db.js extensionless
 * import 때문에 Node strict resolver와 충돌 — Vite에서만 해결됨).
 *
 * 체크 포인트:
 *   1. MSG.SIGNATURE_DISCOVERED 포매터 정의
 *   2. useLegendaryDropDetector가 legendary 로그 type + MSG formatter 사용
 *   3. TerminalView가 legendary 스타일/뱃지/COMBAT_LOG_TYPES 등록
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('MSG.SIGNATURE_DISCOVERED formatter exists in messages.js', async () => {
    const source = await readSrc('src/data/messages.js');
    assert.ok(
        /SIGNATURE_DISCOVERED:\s*\(.*?\)\s*=>/.test(source),
        'messages.js should define SIGNATURE_DISCOVERED arrow formatter'
    );
});

test('useLegendaryDropDetector emits legendary log via MSG + ADD_LOG', async () => {
    const source = await readSrc('src/hooks/useLegendaryDropDetector.js');
    assert.ok(source.includes('MSG.SIGNATURE_DISCOVERED'), 'should use MSG.SIGNATURE_DISCOVERED');
    assert.ok(source.includes('AT.ADD_LOG'), 'should dispatch ADD_LOG');
    assert.ok(source.includes("type: 'legendary'"), 'should tag log with type=legendary');
});

test('TerminalView registers legendary log style + badge + combat visibility', async () => {
    const source = await readSrc('src/components/TerminalView.jsx');
    assert.ok(/legendary:\s*\{/.test(source), 'LOG_STYLES should define legendary style');
    assert.ok(source.includes("label: 'LEGEND'"), 'MOBILE_LOG_BADGES should label legendary as LEGEND');
    assert.ok(
        /COMBAT_LOG_TYPES[\s\S]*?'legendary'/.test(source),
        'legendary should be in COMBAT_LOG_TYPES so summary mode shows it'
    );
});
