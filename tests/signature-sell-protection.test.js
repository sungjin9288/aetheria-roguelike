import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * 전설 각인(signature) 아이템 판매 방지 — 우발적 판매로 인한 영구 손실 방지.
 *
 * 계약:
 *   1. MSG.SIGNATURE_SELL_BLOCKED 포매터 존재
 *   2. useInventoryActions.sell 핸들러가 isSignatureItem 가드 적용 (action-level safety net)
 *   3. ShopPanel 판매 탭에서 signature 아이템 버튼이 disabled 상태로 렌더링
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('MSG.SIGNATURE_SELL_BLOCKED formatter exists', async () => {
    const source = await readSrc('src/data/messages.js');
    assert.ok(
        /SIGNATURE_SELL_BLOCKED:\s*\(.*?\)\s*=>/.test(source),
        'messages.js should define SIGNATURE_SELL_BLOCKED arrow formatter'
    );
});

test('useInventoryActions sell handler guards signature items', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.js');
    assert.ok(source.includes("import { isSignatureItem }"), 'should import isSignatureItem');
    assert.ok(
        /type === 'sell'[\s\S]{0,300}?isSignatureItem/.test(source),
        'sell branch should call isSignatureItem guard before deleting'
    );
    assert.ok(
        /isSignatureItem[\s\S]{0,200}?SIGNATURE_SELL_BLOCKED/.test(source),
        'signature guard should emit SIGNATURE_SELL_BLOCKED warning'
    );
});

test('ShopPanel sell tab disables button for signature items', async () => {
    const source = await readSrc('src/components/ShopPanel.jsx');
    assert.ok(source.includes("import { isSignatureItem }"), 'should import isSignatureItem');
    assert.ok(source.includes('isSignatureLocked'), 'should derive isSignatureLocked flag');
    assert.ok(
        /disabled=\{isSignatureLocked\}/.test(source),
        'sell button should set disabled when signature-locked'
    );
    assert.ok(source.includes('✦ 보호됨'), 'locked button should show ✦ 보호됨 label');
});
