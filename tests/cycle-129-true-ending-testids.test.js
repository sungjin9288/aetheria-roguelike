import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 129: TrueEndingScreen testid 노출 — testid sweep 연장.
 *
 * TrueEndingScreen은 진엔딩(원시의 신 격파 후) 시퀀스 + New Game+ 진입점.
 * 보기 드문 모먼트지만 e2e가 진엔딩 자동화를 시도할 때 필요한 selector.
 *
 * 추가 (cycle 18+ 명명 패턴 일관):
 * - data-testid="true-ending-screen" — 시퀀스 루트.
 * - data-testid="true-ending-confirm" — New Game+ 버튼.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('TrueEndingScreen: true-ending-screen root testid 노출', async () => {
    const source = await readSrc('src/components/TrueEndingScreen.tsx');
    assert.match(source, /data-testid\s*=\s*["']true-ending-screen["']/);
});

test('TrueEndingScreen: true-ending-confirm 버튼 testid 노출', async () => {
    const source = await readSrc('src/components/TrueEndingScreen.tsx');
    assert.match(source, /data-testid\s*=\s*["']true-ending-confirm["']/);
});
