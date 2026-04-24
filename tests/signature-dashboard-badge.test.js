import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Dashboard Codex 탭에 signature 도감 진행도 뱃지가 연결됐는지 텍스트 가드.
 *
 * React 컴포넌트 런타임 테스트는 JSX 변환 없이 불가능 — 소스 텍스트 기반으로
 * 계약을 잠근다. 계약 체크포인트:
 *   1. ArchiveTabButton이 badge prop을 받고 absolute 뱃지로 렌더링
 *   2. Dashboard가 getSignatureDiscoveryProgress를 사용해 codex 탭 badge 계산
 *   3. discovered=0 인 경우 뱃지 노출 안 함 (UI 노이즈 방지)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('ArchiveTabButton accepts badge prop and renders it', async () => {
    const source = await readSrc('src/components/ArchiveTabButton.jsx');
    assert.ok(source.includes('badge = null'), 'should default badge to null');
    assert.ok(source.includes('badgeTitle'), 'should accept badgeTitle for tooltip');
    assert.ok(/badge != null && \(/.test(source), 'should render badge only when not null');
    // absolute positioning으로 icon 위 floating
    assert.ok(source.includes('absolute'), 'badge should be absolutely positioned');
});

test('Dashboard wires getSignatureDiscoveryProgress to codex tab badge', async () => {
    const source = await readSrc('src/components/Dashboard.jsx');
    assert.ok(
        source.includes("import { getSignatureDiscoveryProgress } from '../data/signatureItems.js'"),
        'Dashboard should import getSignatureDiscoveryProgress'
    );
    assert.ok(source.includes('getSignatureDiscoveryProgress(player)'), 'should call helper with player');
    assert.ok(
        /tabId === 'codex'[\s\S]{0,120}?signatureBadge/.test(source),
        'getTabExtras should attach badge only for codex tab'
    );
    assert.ok(
        /signatureProgress\.discovered\s*>\s*0/.test(source),
        'should guard badge render when discovered === 0 (no noise before first drop)'
    );
});

test('all four ArchiveTabButton call sites spread getTabExtras', async () => {
    const source = await readSrc('src/components/Dashboard.jsx');
    const extrasSpread = (source.match(/\.\.\.getTabExtras\(tab\.id\)/g) || []).length;
    assert.ok(
        extrasSpread >= 4,
        `expected all 4 ArchiveTabButton usages to spread getTabExtras, got ${extrasSpread}`
    );
});
