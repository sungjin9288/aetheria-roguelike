import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * DashboardMobileSummary signature 하이라이트 — mobile viewport 파리티.
 *
 * EquipmentPanel / SmartInventory는 gold tone + 전설 각인 칩을 이미 렌더하는데,
 * 모바일 전용 DashboardMobileSummary의 loadout 타일은 일반 텍스트만 출력한다.
 * iOS/Android 플레이어(Capacitor 빌드)는 이 압축된 UI를 상시로 보게 되므로
 * 여기서 signature 신호가 빠지면 전체 피드백 체인이 모바일에서 끊긴다.
 *
 * 계약:
 *   1. DashboardMobileSummary가 isSignatureItem import
 *   2. 각 loadout 타일에 data-is-signature 속성
 *   3. isSignatureItem(item) per-tile 호출
 *   4. signature gold 팔레트(#f6e7a2) 참조
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('DashboardMobileSummary imports isSignatureItem', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.jsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'should import isSignatureItem'
    );
});

test('DashboardMobileSummary loadout tile exposes data-is-signature', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.jsx');
    assert.ok(
        /data-is-signature/.test(source),
        'loadout tile should expose data-is-signature attr'
    );
});

test('DashboardMobileSummary calls isSignatureItem per item', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.jsx');
    assert.ok(
        /isSignatureItem\(\s*\w+/.test(source),
        'should invoke isSignatureItem(item) per loadout entry'
    );
});

test('DashboardMobileSummary applies signature gold palette', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.jsx');
    assert.ok(
        /#f6e7a2/.test(source),
        'signature tile should use gold palette color token (#f6e7a2)'
    );
});

test('DashboardMobileSummary uses stable testid hook for signature loadout tile', async () => {
    const source = await readSrc('src/components/DashboardMobileSummary.jsx');
    assert.ok(
        /mobile-summary-signature/.test(source),
        'should expose a stable testid for the signature loadout cue'
    );
});
