import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * StatusBar — 항상 보이는 sticky HUD에 signature 칩 노출.
 *
 * StatusBar는 모든 화면(map / combat / menu / shop)에서 sticky top으로
 * 상주한다. 현재는 killStreak ≥ 3일 때만 🔥 칩을 띄우는 패턴이 유일한
 * "조건부 자랑" 신호이고, signature 장착 사실은 HUD에 반영되지 않는다.
 * 다른 surfaces(EquipmentPanel, Inventory 등)는 메뉴를 열어야만 보이지만
 * StatusBar의 ✦N 칩은 화면 전환 사이마다 매 시선에 들어온다.
 *
 * 계약:
 *   1. StatusBar가 isSignatureItem import
 *   2. equip.weapon/armor/offhand 중 signature 개수 집계
 *   3. count > 0일 때만 "✦ 전설 각인 N" 칩 렌더 (count === 0이면 silence)
 *   4. data-testid="status-signature-chip" + data-signature-count 속성
 *   5. gold 팔레트 (#f6e7a2 또는 246,231,162)
 *   6. ✦ 마커 사용 (다른 signature surface와 일관)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('StatusBar imports isSignatureItem', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'StatusBar should import isSignatureItem from signatureItems'
    );
});

test('StatusBar aggregates equipped signature count from weapon/armor/offhand', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    // 세 슬롯 모두 한 번씩은 isSignatureItem에 통과돼야 함
    assert.ok(/equip\?\.weapon|equip\.weapon/.test(source), 'weapon slot read missing');
    assert.ok(/equip\?\.armor|equip\.armor/.test(source), 'armor slot read missing');
    assert.ok(/equip\?\.offhand|equip\.offhand/.test(source), 'offhand slot read missing');
});

test('StatusBar exposes status-signature-chip testid', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(
        /status-signature-chip/.test(source),
        'should expose data-testid="status-signature-chip" for the persistent signature signal'
    );
});

test('StatusBar exposes data-signature-count attribute', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(
        /data-signature-count/.test(source),
        'should expose data-signature-count attribute for debugging/integration tests'
    );
});

test('StatusBar uses ✦ marker for signature chip', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    // ✦ 마커가 chip JSX 근처에 있어야 함
    assert.ok(
        /✦/.test(source),
        'signature chip should use ✦ glyph (consistent with other signature surfaces)'
    );
});

test('StatusBar explains the signature count in player-facing language', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.match(source, /✦ 전설 각인 \{equippedSignatureCount\}/);
    assert.doesNotMatch(source, />\s*✦\{equippedSignatureCount\}/);
});

test('StatusBar uses gold palette for signature chip', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.ok(
        /#f6e7a2|246,\s*231,\s*162/.test(source),
        'signature chip should reuse #f6e7a2 / rgba(246,231,162) gold palette'
    );
});
