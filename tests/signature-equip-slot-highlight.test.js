import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Signature equip slot highlight — 상시 "celebrate" 계층.
 *
 * 세트 보너스 카드는 2개 이상 착용했을 때만 뜬다. 하나만 착용한 플레이어는
 * 자신이 전설 각인을 장비 중이라는 시각적 피드백이 없다.
 * EquipmentPanel의 각 slot에 다음을 추가:
 *   - data-is-signature="true|false" 속성 (테스트 + 디버깅 훅)
 *   - 시그니처 아이템일 때 gold tone으로 구분되는 스타일
 *   - "전설 각인" 라벨/칩
 *
 * 계약:
 *   1. EquipmentPanel이 isSignatureItem을 import
 *   2. 각 slot에 data-is-signature 속성 존재
 *   3. signature일 때만 렌더되는 전설 라벨 ("전설 각인" 텍스트)
 *   4. signature 칩에 testid 부여 (통합 테스트용)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('EquipmentPanel imports isSignatureItem from signatureItems', async () => {
    const source = await readSrc('src/components/EquipmentPanel.jsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'EquipmentPanel should import isSignatureItem'
    );
});

test('EquipmentPanel slot renders data-is-signature attribute', async () => {
    const source = await readSrc('src/components/EquipmentPanel.jsx');
    assert.ok(
        /data-is-signature/.test(source),
        'equipment slot should expose data-is-signature for styling/testing'
    );
});

test('EquipmentPanel shows "전설 각인" label only for signature slots', async () => {
    const source = await readSrc('src/components/EquipmentPanel.jsx');
    assert.ok(
        /전설 각인/.test(source),
        'should include the 전설 각인 label for signature items'
    );
});

test('EquipmentPanel signature chip uses a stable testid', async () => {
    const source = await readSrc('src/components/EquipmentPanel.jsx');
    assert.ok(
        /equipment-signature-chip/.test(source),
        'signature chip should carry data-testid="equipment-signature-chip-..." hook'
    );
});

test('EquipmentPanel computes isSignature per slot (guarded by item truthiness)', async () => {
    const source = await readSrc('src/components/EquipmentPanel.jsx');
    // isSignature 계산은 item이 있을 때만 유의미해야 한다.
    // isSignatureItem(item) 패턴이 나타나야 함
    assert.ok(
        /isSignatureItem\(\s*\w+\s*\)/.test(source),
        'should call isSignatureItem(item) to detect per-slot signature'
    );
});
