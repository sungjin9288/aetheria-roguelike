import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Signature 묘비 하이라이트 — "invade" 경제에 bounty signal 부여.
 *
 * 다른 플레이어가 전설 각인을 장착한 채 사망하면 그 묘비는 이례적인 먹잇감이다.
 * GravePanel이 이 사실을 숨기면 invader 입장에서 매력적인 위험 대비 보상 판단이
 * 불가능해진다. 카드/아이템 칩 수준에서 gold 톤을 노출한다.
 *
 * 계약:
 *   1. GravePanel이 isSignatureItem을 import
 *   2. per-item 또는 per-grave 수준에서 isSignatureItem(...) 호출
 *   3. "전설" 라벨 노출
 *   4. 묘비 카드에 data-has-signature 속성 (0개일 때 'false', 있으면 'true')
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('GravePanel imports isSignatureItem from signatureItems', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'GravePanel should import isSignatureItem'
    );
});

test('GravePanel calls isSignatureItem on grave items', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(
        /isSignatureItem\(\s*\w+\s*\)/.test(source),
        'GravePanel should call isSignatureItem(item) to detect bounty graves'
    );
});

test('GravePanel renders "전설" label on signature bounty', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(
        /전설/.test(source),
        'GravePanel should show 전설 label when bounty signatures exist'
    );
});

test('GravePanel grave card exposes data-has-signature attribute', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(
        /data-has-signature/.test(source),
        'grave card should expose data-has-signature for styling/testing'
    );
});

test('GravePanel uses stable testid for signature bounty badge', async () => {
    const source = await readSrc('src/components/GravePanel.tsx');
    assert.ok(
        /grave-signature-bounty/.test(source),
        'signature bounty badge should carry a stable testid'
    );
});
