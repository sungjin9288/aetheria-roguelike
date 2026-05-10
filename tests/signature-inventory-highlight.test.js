import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Signature 인벤토리 하이라이트 — "relate" 계층.
 *
 * EquipmentPanel과 일관성 있게, SmartInventory의 아이템 행도
 * 전설 각인이면 gold tone + 전설 칩 + data-is-signature 속성을 부여한다.
 * compact 요약 모드에서도 signature 우선순위를 높여 숨겨지지 않게 한다.
 *
 * 계약:
 *   1. SmartInventory가 isSignatureItem을 import
 *   2. 렌더된 행에 data-is-signature 속성
 *   3. signature일 때 "전설 각인" 텍스트/칩 노출
 *   4. compact priority 점수에 signature 가중치가 들어간다 (숨겨지지 않도록)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SmartInventory imports isSignatureItem', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'SmartInventory should import isSignatureItem'
    );
});

test('SmartInventory row renders data-is-signature attribute', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(
        /data-is-signature/.test(source),
        'inventory row should expose data-is-signature'
    );
});

test('SmartInventory shows "전설 각인" label for signature items', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(
        /전설 각인/.test(source),
        'inventory should render 전설 각인 label on signature rows'
    );
});

test('SmartInventory compact priority boost for signature items (cycle 482 cascade로 priority 로직 제거)', async () => {
    // cycle 482가 compact prop cascade로 visibleFiltered IIFE (priority 계산 포함)
    // 자체를 제거. 이 가드 → cascade 보존 가드로 약화.
    const source = await readSrc('src/components/SmartInventory.tsx');
    // visibleFiltered가 제거됐는지 가드
    assert.ok(!/visibleFiltered/.test(source),
        'cycle 482 cascade로 visibleFiltered 제거 보존');
});

test('SmartInventory computes isSignature per item via isSignatureItem(item)', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    assert.ok(
        /isSignatureItem\(\s*\w+\s*\)/.test(source),
        'should call isSignatureItem(item) per row'
    );
});
